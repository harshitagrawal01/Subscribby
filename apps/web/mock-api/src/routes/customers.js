// Section 8: customers, with computed portalStatus and stats.
import { Router } from 'express';
import { db, byId, insert } from '../store.js';
import { errors, send, load, Validator, sendList, queryBool, queryString, matchesSearch } from '../http.js';
import { nowIso } from '../dates.js';
import { allow } from '../auth.js';
import { isOverdue } from '../domain/invoices.js';

const router = Router();
const ADDRESS_KEYS = ['line1', 'line2', 'city', 'state', 'postalCode', 'country'];

/** Stats for many customers in one pass (like one aggregation per page). */
export function customerStats() {
  const stats = new Map();
  const get = (id) => {
    if (!stats.has(id)) stats.set(id, { activeSubscriptions: 0, outstandingAmount: 0, overdueAmount: 0, paidToDate: 0 });
    return stats.get(id);
  };
  for (const s of db.subscriptions) if (s.status === 'active') get(s.customerId).activeSubscriptions++;
  for (const i of db.invoices) {
    if (i.status !== 'confirmed') continue;
    get(i.customerId).outstandingAmount += i.balance;
    if (isOverdue(i)) get(i.customerId).overdueAmount += i.balance;
  }
  for (const p of db.payments) get(p.customerId).paidToDate += p.amount;
  return (id) => stats.get(id) || { activeSubscriptions: 0, outstandingAmount: 0, overdueAmount: 0, paidToDate: 0 };
}

export function portalStatus(c) {
  if (!c.userId) return 'none';
  const u = byId('users', c.userId);
  if (!u) return 'none';
  return u.status === 'active' ? 'active' : 'disabled';
}

export function serializeCustomer(c, { withStats = true, statsFor } = {}) {
  const out = {
    id: c.id,
    name: c.name,
    contactName: c.contactName,
    email: c.email,
    phone: c.phone,
    billingAddress: { ...c.billingAddress },
    taxId: c.taxId,
    notes: c.notes,
    portalStatus: portalStatus(c),
    isActive: c.isActive,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
  if (withStats) out.stats = { ...(statsFor || customerStats())(c.id) };
  return out;
}

function readCustomerBody(body, { partial }) {
  const v = new Validator(body, { partial });
  v.str('name', { required: true, min: 1, max: 120 });
  v.str('contactName', { max: 80 });
  v.email('email', { required: true });
  v.str('phone', { max: 40 });
  v.str('taxId', { max: 20 });
  v.str('notes', { max: 2000 });
  const addr = v.object('billingAddress');
  if (addr) {
    for (const k of ADDRESS_KEYS) {
      if (addr[k] !== undefined && addr[k] !== null && typeof addr[k] !== 'string') {
        v.error(`billingAddress.${k}`, 'Must be text');
      }
    }
  }
  v.forbid('isActive', 'Use DELETE to archive a customer');
  return v.done();
}

const cleanAddress = (addr = {}, base = {}) =>
  Object.fromEntries(ADDRESS_KEYS.map((k) => [k, typeof addr[k] === 'string' ? addr[k].trim() : (base[k] ?? (k === 'country' ? 'IN' : ''))]));

router.get('/customers', allow('admin', 'staff', 'finance'), (req, res) => {
  const search = queryString(req.query, 'search');
  const hasOverdue = queryBool(req.query, 'hasOverdue');
  const hasActive = queryBool(req.query, 'hasActiveSubscription');
  const isActive = queryBool(req.query, 'isActive');
  const statsFor = customerStats();
  const items = db.customers
    .filter((c) => matchesSearch(search, c.name, c.email, c.contactName))
    .filter((c) => isActive === undefined || c.isActive === isActive)
    .filter((c) => hasOverdue === undefined || statsFor(c.id).overdueAmount > 0 === hasOverdue)
    .filter((c) => hasActive === undefined || statsFor(c.id).activeSubscriptions > 0 === hasActive)
    .map((c) => serializeCustomer(c, { statsFor }));
  sendList(res, items, req.query, { defaultSort: 'name' });
});

router.post('/customers', allow('admin', 'staff'), (req, res) => {
  const b = readCustomerBody(req.body, { partial: false });
  const c = insert('customers', {
    name: b.name,
    contactName: b.contactName || '',
    email: b.email,
    phone: b.phone || '',
    billingAddress: cleanAddress(b.billingAddress),
    taxId: b.taxId || '',
    notes: b.notes || '',
    userId: null, // no login is created; the customer signs up with this email
    isActive: true,
  });
  send(res, serializeCustomer(c), 201);
});

router.get('/customers/:id', allow('admin', 'staff', 'finance'), (req, res) => {
  send(res, serializeCustomer(load('customers', req.params.id, 'Customer')));
});

router.patch('/customers/:id', allow('admin', 'staff'), (req, res) => {
  const c = load('customers', req.params.id, 'Customer');
  const b = readCustomerBody(req.body, { partial: true });
  for (const k of ['name', 'contactName', 'email', 'phone', 'taxId', 'notes']) if (b[k] !== undefined) c[k] = b[k];
  if (b.billingAddress) c.billingAddress = cleanAddress(b.billingAddress, c.billingAddress);
  c.updatedAt = nowIso();
  send(res, serializeCustomer(c));
});

router.delete('/customers/:id', allow('admin', 'staff'), (req, res) => {
  const c = load('customers', req.params.id, 'Customer');
  if (db.subscriptions.some((s) => s.customerId === c.id && ['active', 'paused'].includes(s.status))) {
    throw errors.notEditable('Customer has active subscriptions; close them first');
  }
  c.isActive = false;
  c.updatedAt = nowIso();
  res.status(204).end();
});

export default router;
