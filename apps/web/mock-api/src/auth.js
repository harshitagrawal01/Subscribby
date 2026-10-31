// Passwords, tokens and the auth / role middleware (spec sections 3 and 5).
//
// Tokens are opaque random strings kept in memory (not real JWTs). They are valid 7 days.
// Each user has a `tokenEpoch` that goes up on every password change / reset / admin reset;
// tokens issued under an older epoch are rejected ("issued before passwordChangedAt").
import crypto from 'node:crypto';
import { byId } from './store.js';
import { errors } from './http.js';

export const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const STAFF_ROLES = ['admin', 'staff', 'finance'];

// ------------------------------------------------------------ passwords

export function hashPassword(password) {
  const salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (typeof password !== 'string' || !stored) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.createHash('sha256').update(salt + password).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

/** One `details` entry per broken rule, so the form can show each. */
export function passwordProblems(password, field = 'password') {
  if (typeof password !== 'string' || password.length === 0) return [{ field, message: 'Required' }];
  const out = [];
  if (password.length < 9) out.push({ field, message: 'Must be more than 8 characters' });
  if (!/[A-Z]/.test(password)) out.push({ field, message: 'Must contain an uppercase letter' });
  if (!/[a-z]/.test(password)) out.push({ field, message: 'Must contain a lowercase letter' });
  if (!/[^A-Za-z0-9]/.test(password)) out.push({ field, message: 'Must contain a special character' });
  return out;
}

// ------------------------------------------------------------ tokens

// Kept outside the store so that POST /__mock/reset doesn't log everybody out.
const tokens = new Map(); // token -> { userId, epoch, expiresAt }

export function issueToken(user) {
  const token = `mock.${crypto.randomBytes(24).toString('hex')}`;
  tokens.set(token, { userId: user.id, epoch: user.tokenEpoch || 0, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

/** Invalidate every existing token for the user (password change, reset, admin reset). */
export function bumpTokenEpoch(user) {
  user.tokenEpoch = (user.tokenEpoch || 0) + 1;
  user.passwordChangedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ------------------------------------------------------------ middleware

/**
 * Requires a valid Bearer token. Users with a temporary password get 403
 * PASSWORD_CHANGE_REQUIRED unless the route opts in with `allowPasswordChange`.
 */
export function authenticate({ allowPasswordChange = false } = {}) {
  return (req, _res, next) => {
    const header = req.get('authorization') || '';
    const match = header.match(/^Bearer\s+(\S+)$/i);
    if (!match) throw errors.unauthenticated('Missing or malformed Authorization header');
    const entry = tokens.get(match[1]);
    if (!entry || entry.expiresAt < Date.now()) throw errors.unauthenticated('Token is invalid or expired');
    const user = byId('users', entry.userId);
    if (!user) throw errors.unauthenticated('Token is invalid or expired');
    if (entry.epoch < (user.tokenEpoch || 0)) throw errors.unauthenticated('Password was changed, log in again');
    if (user.status === 'disabled') throw errors.accountDisabled();
    if (user.mustChangePassword && !allowPasswordChange) throw errors.passwordChangeRequired();
    req.user = user;
    next();
  };
}

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw errors.forbidden();
    next();
  };

/** Shorthand: authenticate + role check, for use as route middleware. */
export const allow = (...roles) => [authenticate(), requireRole(...roles)];

// ------------------------------------------------------------ serializer

export function serializeUser(u) {
  const createdBy = u.createdBy ? byId('users', u.createdBy) : null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    mustChangePassword: u.mustChangePassword,
    customerId: u.customerId,
    createdVia: u.createdVia,
    createdBy: createdBy ? { id: createdBy.id, name: createdBy.name } : null,
    lastLoginAt: u.lastLoginAt,
    passwordChangedAt: u.passwordChangedAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}
