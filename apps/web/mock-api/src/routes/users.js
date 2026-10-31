// Section 7 (part 2): users, single create, admin reset, and CSV bulk import.
import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { db, insert } from '../store.js';
import { errors, send, load, Validator, sendList, queryEnum, queryString, matchesSearch, EMAIL_RE } from '../http.js';
import { nowIso } from '../dates.js';
import { allow, hashPassword, passwordProblems, bumpTokenEpoch, serializeUser } from '../auth.js';

const router = Router();
const ADMIN = allow('admin');
const STAFF_ROLES = ['staff', 'finance', 'admin'];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024, files: 1 } });

const emailExists = (email) => db.users.some((u) => u.email === email);
const activeAdmins = () => db.users.filter((u) => u.role === 'admin' && u.status === 'active');

function createStaffUser({ name, email, role, password, createdVia, createdBy }) {
  return insert('users', {
    name,
    email,
    passwordHash: hashPassword(password),
    role,
    status: 'active',
    mustChangePassword: true,
    passwordChangedAt: null,
    tokenEpoch: 0,
    createdVia,
    createdBy,
    customerId: null,
    lastLoginAt: null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
  });
}

router.get('/users', ADMIN, (req, res) => {
  const role = queryEnum(req.query, 'role', ['admin', 'staff', 'finance', 'customer']);
  const status = queryEnum(req.query, 'status', ['active', 'disabled']);
  const search = queryString(req.query, 'search');
  const items = db.users
    .filter((u) => (!role || u.role === role) && (!status || u.status === status) && matchesSearch(search, u.name, u.email))
    .map(serializeUser);
  sendList(res, items, req.query, { defaultSort: 'name' });
});

router.post('/users', ADMIN, (req, res) => {
  const v = new Validator(req.body);
  v.str('name', { required: true, min: 2, max: 80 });
  v.email('email', { required: true });
  v.oneOf('role', STAFF_ROLES, { required: true });
  v.details.push(...passwordProblems(req.body?.temporaryPassword, 'temporaryPassword'));
  const b = v.done();
  if (emailExists(b.email)) throw errors.emailTaken();
  const u = createStaffUser({ ...b, password: req.body.temporaryPassword, createdVia: 'admin', createdBy: req.user.id });
  send(res, serializeUser(u), 201);
});

// ---------------------------------------------------------------- CSV import (declared before /users/:id)

router.get('/users/import/template', ADMIN, (req, res) => {
  res
    .status(200)
    .type('text/csv')
    .set('Content-Disposition', 'attachment; filename="users-import-template.csv"')
    .send('name,email,temporary_password,access_level\nRiya Sharma,riya.sharma@example.test,Welcome@2026!,Internal Staff\n');
});

const ACCESS_LEVELS = {
  'internal staff': 'staff',
  staff: 'staff',
  'finance lead': 'finance',
  finance: 'finance',
  admin: 'admin',
};
const REQUIRED_COLUMNS = ['name', 'email', 'temporary_password', 'access_level'];

router.post('/users/import', ADMIN, upload.single('file'), (req, res) => {
  const dryRunRaw = req.query.dryRun;
  if (dryRunRaw !== undefined && !['true', 'false'].includes(dryRunRaw)) {
    throw errors.validation([{ field: 'dryRun', message: 'Must be true or false' }], 'Invalid query parameters');
  }
  const dryRun = dryRunRaw !== 'false'; // default: preview
  const file = req.file;
  if (!file) throw errors.importInvalid('Attach a CSV file in the "file" field');
  if (!/\.csv$/i.test(file.originalname || '')) throw errors.importInvalid('Only .csv files are accepted');

  let records;
  try {
    records = parse(file.buffer, {
      bom: true,
      columns: (header) => header.map((h) => String(h).trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      info: true,
    });
  } catch (e) {
    throw errors.importInvalid(`The file couldn't be read as CSV: ${e.message}`);
  }
  if (!records.length) throw errors.importInvalid('The file has no data rows');
  const columns = Object.keys(records[0].record);
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length) {
    throw errors.importInvalid(
      `Missing columns: ${missing.join(', ')}`,
      missing.map((c) => ({ field: c, message: 'Column is missing' })),
    );
  }
  if (records.length > 200) throw errors.importInvalid(`Too many rows (${records.length}); the limit is 200`);

  const seen = new Map(); // email -> first row number
  const rows = records.map(({ record, info }) => {
    const row = info.lines; // line number in the file (header = 1, first person = 2)
    const name = record.name ?? '';
    const email = (record.email ?? '').toLowerCase();
    const errs = [];
    if (name.length < 2 || name.length > 80) errs.push({ field: 'name', message: 'Must be 2 to 80 characters' });
    if (!EMAIL_RE.test(email)) errs.push({ field: 'email', message: 'Not a valid email' });
    else if (emailExists(email)) errs.push({ field: 'email', message: 'Already has an account' });
    else if (seen.has(email)) errs.push({ field: 'email', message: `Repeats row ${seen.get(email)}` });
    if (EMAIL_RE.test(email) && !seen.has(email)) seen.set(email, row);
    errs.push(...passwordProblems(record.temporary_password, 'temporary_password'));
    const role = ACCESS_LEVELS[(record.access_level ?? '').toLowerCase()] ?? null;
    if (!role) errs.push({ field: 'access_level', message: 'Must be Internal Staff, Finance Lead or Admin' });
    return {
      row,
      name,
      email,
      role,
      status: errs.length ? 'invalid' : 'valid',
      errors: errs,
      _password: record.temporary_password,
    };
  });

  const invalid = rows.filter((r) => r.status === 'invalid').length;
  let created = 0;
  if (!dryRun && invalid === 0) {
    // All or nothing: every row is valid, so create them all.
    for (const r of rows) {
      createStaffUser({ name: r.name, email: r.email, role: r.role, password: r._password, createdVia: 'import', createdBy: req.user.id });
      r.status = 'created';
      created++;
    }
  }
  const data = {
    dryRun,
    total: rows.length,
    valid: rows.length - invalid,
    invalid,
    created,
    rows: rows.map(({ _password, ...r }) => r),
  };
  send(res, data, created > 0 ? 201 : 200);
});

// ---------------------------------------------------------------- update / reset

router.patch('/users/:id', ADMIN, (req, res) => {
  const u = load('users', req.params.id, 'User');
  const v = new Validator(req.body, { partial: true });
  v.str('name', { min: 2, max: 80 });
  const role = v.oneOf('role', STAFF_ROLES);
  v.oneOf('status', ['active', 'disabled']);
  const b = v.done();
  if (role && u.role === 'customer') {
    throw errors.validation([{ field: 'role', message: "A customer login can't be given a staff role" }]);
  }
  const willBeActiveAdmin = (b.role ?? u.role) === 'admin' && (b.status ?? u.status) === 'active';
  if (u.role === 'admin' && u.status === 'active' && !willBeActiveAdmin && activeAdmins().length <= 1) {
    throw errors.lastAdmin();
  }
  if (b.name !== undefined) u.name = b.name;
  if (b.role !== undefined) u.role = b.role;
  if (b.status !== undefined) u.status = b.status; // a disabled user's token fails on the next request
  u.updatedAt = nowIso();
  send(res, serializeUser(u));
});

router.post('/users/:id/reset-password', ADMIN, (req, res) => {
  const u = load('users', req.params.id, 'User');
  const issues = passwordProblems(req.body?.temporaryPassword, 'temporaryPassword');
  if (issues.length) throw errors.validation(issues);
  u.passwordHash = hashPassword(req.body.temporaryPassword);
  u.mustChangePassword = true;
  bumpTokenEpoch(u); // logs them out everywhere
  u.updatedAt = nowIso();
  send(res, serializeUser(u));
});

export default router;
