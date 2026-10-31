// Response envelopes, the error type + codes (spec section 2), input validation and list helpers.
import crypto from 'node:crypto';
import { byId } from './store.js';
import { isValidDate } from './dates.js';

// ---------------------------------------------------------------- errors

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  validation: (details, message = 'Some fields are invalid') => new ApiError(400, 'VALIDATION_ERROR', message, details),
  importInvalid: (message, details) => new ApiError(400, 'IMPORT_INVALID', message, details),
  tokenInvalid: () => new ApiError(400, 'TOKEN_INVALID', 'This reset link is invalid, already used or expired'),
  unauthenticated: (message = 'Please log in again') => new ApiError(401, 'UNAUTHENTICATED', message),
  invalidCredentials: () => new ApiError(401, 'INVALID_CREDENTIALS', 'Wrong email or password'),
  forbidden: (message = "You don't have permission to do this") => new ApiError(403, 'FORBIDDEN', message),
  accountDisabled: () => new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been disabled by an admin'),
  passwordChangeRequired: () =>
    new ApiError(403, 'PASSWORD_CHANGE_REQUIRED', 'Set a new password before continuing'),
  notFound: (what = 'Record') => new ApiError(404, 'NOT_FOUND', `${what} not found`),
  emailTaken: () => new ApiError(409, 'EMAIL_TAKEN', 'This email already has an account'),
  invalidTransition: (message) => new ApiError(409, 'INVALID_TRANSITION', message),
  notEditable: (message) => new ApiError(409, 'NOT_EDITABLE', message),
  alreadyInvoiced: (message = 'This subscription period already has an invoice') =>
    new ApiError(409, 'ALREADY_INVOICED', message),
  overpayment: (message) => new ApiError(409, 'OVERPAYMENT', message),
  hasPayments: () => new ApiError(409, 'HAS_PAYMENTS', "Can't cancel an invoice that has payments"),
  planRule: (message) => new ApiError(409, 'PLAN_RULE', message),
  belowMinQuantity: (message) => new ApiError(409, 'BELOW_MIN_QUANTITY', message),
  planNotAvailable: (message) => new ApiError(409, 'PLAN_NOT_AVAILABLE', message),
  lastAdmin: () => new ApiError(409, 'LAST_ADMIN', 'This would leave the system with no active admin'),
};

export function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    const error = { code: err.code, message: err.message };
    if (err.details && err.details.length) error.details = err.details;
    return res.status(err.status).json({ error });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Body is not valid JSON' } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Body is too large' } });
  }
  if (err?.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 1 MB' : `Upload problem: ${err.message}`;
    return res.status(400).json({ error: { code: 'IMPORT_INVALID', message } });
  }
  const requestId = crypto.randomUUID();
  console.error(`[${requestId}]`, err);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong', requestId } });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}

// ---------------------------------------------------------------- envelopes

export const send = (res, data, status = 200) => res.status(status).json({ data });

/** Load a record by id or throw 404. */
export function load(collection, id, label = 'Record') {
  const r = byId(collection, id);
  if (!r) throw errors.notFound(label);
  return r;
}

// ---------------------------------------------------------------- validation

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Tiny body validator. Each method reads one field, records a `details` entry if it is
 * wrong, and stores the cleaned value in `out`. Call `done()` to throw VALIDATION_ERROR.
 * With `partial: true` (PATCH) required fields may be absent.
 */
export class Validator {
  constructor(body, { partial = false } = {}) {
    this.body = isObj(body) ? body : {};
    this.partial = partial;
    this.details = [];
    this.out = {};
  }
  has(field) {
    return this.body[field] !== undefined;
  }
  error(field, message) {
    this.details.push({ field, message });
    delete this.out[field];
    return undefined;
  }
  #absent(field, required) {
    if (required && !this.partial) this.error(field, 'Required');
    return undefined;
  }
  #set(field, value) {
    this.out[field] = value;
    return value;
  }
  str(field, { required = false, min = 0, max = 1000, nullable = false } = {}) {
    if (!this.has(field)) return this.#absent(field, required);
    let v = this.body[field];
    if (v === null && nullable) return this.#set(field, null);
    if (typeof v !== 'string') return this.error(field, 'Must be text');
    v = v.trim();
    if (required && v.length === 0) return this.error(field, 'Required');
    if (v.length && v.length < min) return this.error(field, `Must be at least ${min} characters`);
    if (v.length > max) return this.error(field, `Must be at most ${max} characters`);
    return this.#set(field, v);
  }
  email(field, { required = false } = {}) {
    if (!this.has(field)) return this.#absent(field, required);
    const v = this.body[field];
    if (typeof v !== 'string' || !v.trim()) return this.error(field, 'Required');
    const e = v.trim().toLowerCase();
    if (!EMAIL_RE.test(e) || e.length > 254) return this.error(field, 'Not a valid email');
    return this.#set(field, e);
  }
  int(field, { required = false, min, max, nullable = false, money = false } = {}) {
    if (!this.has(field)) return this.#absent(field, required);
    const v = this.body[field];
    if (v === null && nullable) return this.#set(field, null);
    if (typeof v !== 'number' || !Number.isInteger(v)) {
      return this.error(field, money ? 'Must be a whole number of paise' : 'Must be a whole number');
    }
    if (min !== undefined && v < min) return this.error(field, `Must be ${min} or more`);
    if (max !== undefined && v > max) return this.error(field, `Must be ${max} or less`);
    return this.#set(field, v);
  }
  num(field, { required = false, min, max, decimals = 2 } = {}) {
    if (!this.has(field)) return this.#absent(field, required);
    const v = this.body[field];
    if (typeof v !== 'number' || !Number.isFinite(v)) return this.error(field, 'Must be a number');
    const scaled = v * 10 ** decimals;
    if (Math.abs(scaled - Math.round(scaled)) > 1e-9) return this.error(field, `At most ${decimals} decimals`);
    if (min !== undefined && v < min) return this.error(field, `Must be ${min} or more`);
    if (max !== undefined && v > max) return this.error(field, `Must be ${max} or less`);
    return this.#set(field, v);
  }
  bool(field, { required = false } = {}) {
    if (!this.has(field)) return this.#absent(field, required);
    if (typeof this.body[field] !== 'boolean') return this.error(field, 'Must be true or false');
    return this.#set(field, this.body[field]);
  }
  oneOf(field, values, { required = false } = {}) {
    if (!this.has(field)) return this.#absent(field, required);
    if (!values.includes(this.body[field])) return this.error(field, `Must be one of: ${values.join(', ')}`);
    return this.#set(field, this.body[field]);
  }
  date(field, { required = false, nullable = false } = {}) {
    if (!this.has(field)) return this.#absent(field, required);
    const v = this.body[field];
    if (v === null && nullable) return this.#set(field, null);
    if (!isValidDate(v)) return this.error(field, 'Must be a date as YYYY-MM-DD');
    return this.#set(field, v);
  }
  /** An id that must point at an existing record. */
  ref(field, collection, label, { required = false, nullable = false, activeOnly = false, check } = {}) {
    if (!this.has(field)) return this.#absent(field, required);
    const v = this.body[field];
    if (v === null && nullable) return this.#set(field, null);
    const rec = byId(collection, v);
    if (!rec) return this.error(field, `${label} not found`);
    if (activeOnly && rec.isActive === false) return this.error(field, `${label} is archived`);
    if (check) {
      const problem = check(rec);
      if (problem) return this.error(field, problem);
    }
    return this.#set(field, v);
  }
  array(field, { required = false } = {}) {
    if (!this.has(field)) return this.#absent(field, required);
    if (!Array.isArray(this.body[field])) return this.error(field, 'Must be a list');
    return this.#set(field, this.body[field]);
  }
  object(field, { required = false } = {}) {
    if (!this.has(field)) return this.#absent(field, required);
    if (!isObj(this.body[field])) return this.error(field, 'Must be an object');
    return this.#set(field, this.body[field]);
  }
  /** Reject a field outright (e.g. `status` in PATCH bodies). */
  forbid(field, message) {
    if (this.has(field)) this.error(field, message);
  }
  done(message) {
    if (this.details.length) throw errors.validation(this.details, message);
    return this.out;
  }
}

// ---------------------------------------------------------------- lists

export function queryBool(query, name) {
  const v = query[name];
  if (v === undefined || v === '') return undefined;
  if (v === 'true') return true;
  if (v === 'false') return false;
  throw errors.validation([{ field: name, message: 'Must be true or false' }], 'Invalid query parameters');
}

export function queryDate(query, name) {
  const v = query[name];
  if (v === undefined || v === '') return undefined;
  if (!isValidDate(v)) {
    throw errors.validation([{ field: name, message: 'Must be a date as YYYY-MM-DD' }], 'Invalid query parameters');
  }
  return v;
}

export function queryEnum(query, name, values) {
  const v = query[name];
  if (v === undefined || v === '') return undefined;
  if (!values.includes(v)) {
    throw errors.validation(
      [{ field: name, message: `Must be one of: ${values.join(', ')}` }],
      'Invalid query parameters',
    );
  }
  return v;
}

export function queryString(query, name) {
  const v = query[name];
  if (v === undefined || v === '') return undefined;
  return String(v);
}

/** Case-insensitive "contains" over any of the given strings. */
export function matchesSearch(search, ...values) {
  if (!search) return true;
  const s = search.toLowerCase().trim();
  return values.some((v) => typeof v === 'string' && v.toLowerCase().includes(s));
}

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

function compare(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls last
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : a ? -1 : 1;
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
}

/** `sort` = "field" or "-field" (comma separated for ties). Works on the response shape. */
export function sortItems(items, sort) {
  const keys = String(sort)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith('-') ? { path: s.slice(1), dir: -1 } : { path: s, dir: 1 }));
  return [...items].sort((x, y) => {
    for (const { path, dir } of keys) {
      const c = compare(getPath(x, path), getPath(y, path));
      if (c !== 0) {
        const nullInvolved = getPath(x, path) == null || getPath(y, path) == null;
        return nullInvolved ? c : c * dir;
      }
    }
    return compare(x.id, y.id);
  });
}

/** Build `{ data, meta }` from already-filtered, already-serialized items. */
export function paginate(items, query, { defaultSort = '-createdAt', meta = {} } = {}) {
  const details = [];
  const page = query.page === undefined || query.page === '' ? 1 : Number(query.page);
  const limitRaw = query.limit === undefined || query.limit === '' ? 20 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1) details.push({ field: 'page', message: 'Must be a whole number from 1' });
  if (!Number.isInteger(limitRaw) || limitRaw < 1) {
    details.push({ field: 'limit', message: 'Must be a whole number from 1 to 100' });
  }
  if (details.length) throw errors.validation(details, 'Invalid query parameters');
  const limit = Math.min(limitRaw, 100);
  const sorted = sortItems(items, query.sort || defaultSort);
  const total = sorted.length;
  return {
    data: sorted.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), ...meta },
  };
}

export function sendList(res, items, query, opts) {
  return res.json(paginate(items, query, opts));
}
