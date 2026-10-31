// Section 5: sign-up, the two logins, me, change / forgot / reset password, /meta, /health.
import crypto from 'node:crypto';
import { Router } from 'express';
import { db, byId, insert } from '../store.js';
import { errors, send, Validator } from '../http.js';
import { nowIso } from '../dates.js';
import { config } from '../config.js';
import {
  authenticate,
  hashPassword,
  verifyPassword,
  passwordProblems,
  issueToken,
  bumpTokenEpoch,
  serializeUser,
  STAFF_ROLES,
} from '../auth.js';
import { sendPasswordReset } from '../mailer.js';
import { serializeCustomer } from './customers.js';

const router = Router();
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const findByEmail = (email) => db.users.find((u) => u.email === email) || null;

function meResponse(user) {
  const out = serializeUser(user);
  if (user.role === 'customer') {
    const c = byId('customers', user.customerId);
    out.customer = c ? serializeCustomer(c, { withStats: false }) : null;
  }
  return out;
}
const session = (user) => ({ token: issueToken(user), user: serializeUser(user) });

// ---------------------------------------------------------------- sign-up (customers only)

router.post('/auth/customer/signup', (req, res) => {
  const v = new Validator(req.body);
  const name = v.str('name', { required: true, min: 2, max: 80 });
  const companyName = v.str('companyName', { max: 120, nullable: true });
  const email = v.email('email', { required: true });
  const pwIssues = passwordProblems(req.body?.password, 'password');
  v.details.push(...pwIssues);
  v.done();
  if (findByEmail(email)) throw errors.emailTaken();

  // Ignore any `role` in the body: sign-up always creates a customer.
  const user = insert('users', {
    name,
    email,
    passwordHash: hashPassword(req.body.password),
    role: 'customer',
    status: 'active',
    mustChangePassword: false,
    passwordChangedAt: null,
    tokenEpoch: 0,
    createdVia: 'signup',
    createdBy: null,
    customerId: null,
    lastLoginAt: nowIso(),
    resetTokenHash: null,
    resetTokenExpiresAt: null,
  });
  // Link to a customer that staff already created with this email (and no login), else create one.
  let customer = db.customers.find((c) => c.email === email && !c.userId);
  if (customer) {
    customer.userId = user.id;
    customer.updatedAt = nowIso();
  } else {
    customer = insert('customers', {
      name: companyName || name,
      contactName: name,
      email,
      phone: '',
      billingAddress: { line1: '', line2: '', city: '', state: '', postalCode: '', country: 'IN' },
      taxId: '',
      notes: '',
      userId: user.id,
      isActive: true,
    });
  }
  user.customerId = customer.id;
  send(res, session(user), 201);
});

// ---------------------------------------------------------------- logins

function login(req, res, roles) {
  const v = new Validator(req.body);
  v.str('email', { required: true });
  v.str('password', { required: true });
  v.done();
  const user = findByEmail(String(req.body.email).trim().toLowerCase());
  // Wrong password, unknown email and "wrong login page" all look the same.
  if (!user || !roles.includes(user.role) || !verifyPassword(req.body.password, user.passwordHash)) {
    throw errors.invalidCredentials();
  }
  if (user.status === 'disabled') throw errors.accountDisabled();
  user.lastLoginAt = nowIso();
  send(res, session(user));
}

router.post('/auth/customer/login', (req, res) => login(req, res, ['customer']));
router.post('/auth/staff/login', (req, res) => login(req, res, STAFF_ROLES));

// ---------------------------------------------------------------- me

router.get('/auth/me', authenticate({ allowPasswordChange: true }), (req, res) => {
  send(res, meResponse(req.user));
});

router.patch('/auth/me', authenticate(), (req, res) => {
  const user = req.user;
  const v = new Validator(req.body, { partial: true });
  v.str('name', { min: 2, max: 80 });
  let customerFields = {};
  if (user.role === 'customer') {
    // Contact fields may be sent at the top level or inside `customer`.
    const nested = req.body?.customer && typeof req.body.customer === 'object' ? req.body.customer : {};
    const cv = new Validator({ ...nested, ...req.body }, { partial: true });
    cv.str('companyName', { min: 1, max: 120 });
    cv.str('contactName', { max: 80 });
    cv.str('phone', { max: 40 });
    cv.str('taxId', { max: 20 });
    cv.object('billingAddress');
    v.details.push(...cv.details);
    customerFields = cv.out;
  }
  v.done();
  if (v.out.name !== undefined) user.name = v.out.name;
  user.updatedAt = nowIso();
  if (user.role === 'customer') {
    const c = byId('customers', user.customerId);
    if (c) {
      if (customerFields.companyName !== undefined) c.name = customerFields.companyName;
      if (customerFields.contactName !== undefined) c.contactName = customerFields.contactName;
      if (customerFields.phone !== undefined) c.phone = customerFields.phone;
      if (customerFields.taxId !== undefined) c.taxId = customerFields.taxId;
      if (customerFields.billingAddress) {
        for (const k of ['line1', 'line2', 'city', 'state', 'postalCode', 'country']) {
          if (typeof customerFields.billingAddress[k] === 'string') c.billingAddress[k] = customerFields.billingAddress[k].trim();
        }
      }
      c.updatedAt = nowIso();
    }
  }
  send(res, meResponse(user));
});

// ---------------------------------------------------------------- passwords

router.post('/auth/change-password', authenticate({ allowPasswordChange: true }), (req, res) => {
  const user = req.user;
  const { currentPassword, newPassword } = req.body || {};
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    throw errors.validation([{ field: 'currentPassword', message: 'Current password is wrong' }]);
  }
  const issues = passwordProblems(newPassword, 'newPassword');
  if (!issues.length && newPassword === currentPassword) {
    issues.push({ field: 'newPassword', message: 'Must be different from the current password' });
  }
  if (issues.length) throw errors.validation(issues);
  user.passwordHash = hashPassword(newPassword);
  user.mustChangePassword = false;
  bumpTokenEpoch(user); // old tokens stop working
  user.updatedAt = nowIso();
  send(res, session(user));
});

router.post('/auth/forgot-password', (req, res) => {
  const v = new Validator(req.body);
  const email = v.str('email', { required: true });
  const portal = v.oneOf('portal', ['customer', 'staff'], { required: true });
  v.done();
  const user = findByEmail(email.toLowerCase());
  const roleMatches = user && (portal === 'customer' ? user.role === 'customer' : STAFF_ROLES.includes(user.role));
  const data = { ok: true };
  if (user && user.status === 'active' && roleMatches) {
    const token = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = sha256(token); // a new request replaces any older token
    user.resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const path = portal === 'customer' ? '/reset-password' : `${config.staffPortalPath}/reset-password`;
    const resetUrl = `${config.webUrl}${path}?token=${token}`;
    sendPasswordReset(user, resetUrl);
    data.devResetUrl = resetUrl; // development-mode extra, like EMAIL_PROVIDER=console
  }
  send(res, data);
});

router.post('/auth/reset-password', (req, res) => {
  const { token, newPassword } = req.body || {};
  const hash = typeof token === 'string' && token ? sha256(token) : null;
  const user = hash && db.users.find((u) => u.resetTokenHash === hash);
  if (!user || !user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt) < new Date()) {
    throw errors.tokenInvalid();
  }
  const issues = passwordProblems(newPassword, 'newPassword');
  if (issues.length) throw errors.validation(issues);
  user.passwordHash = hashPassword(newPassword);
  user.mustChangePassword = false;
  user.resetTokenHash = null; // works once
  user.resetTokenExpiresAt = null;
  bumpTokenEpoch(user);
  user.lastLoginAt = nowIso();
  user.updatedAt = nowIso();
  send(res, session(user));
});

// ---------------------------------------------------------------- meta + health

router.get('/meta', authenticate(), (req, res) => {
  send(res, {
    accessLevels: [
      { value: 'staff', label: 'Internal Staff' },
      { value: 'finance', label: 'Finance Lead' },
      { value: 'admin', label: 'Admin' },
    ],
    billingPeriods: ['daily', 'weekly', 'monthly', 'yearly'],
    productTypes: ['service', 'addon', 'physical'],
    paymentMethods: ['bank_transfer', 'card', 'cash', 'cheque', 'upi', 'other'],
    paymentTermDays: [0, 15, 30, 45],
    subscriptionStatuses: ['draft', 'quotation', 'confirmed', 'active', 'paused', 'closed'],
    invoiceStatuses: ['draft', 'confirmed', 'paid', 'cancelled'],
    currency: 'INR',
    company: { ...config.company },
  });
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', db: 'ok', time: nowIso() });
});

export default router;
