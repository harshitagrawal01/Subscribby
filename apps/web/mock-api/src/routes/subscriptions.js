// Section 9: subscriptions — list, create, preview, detail, PATCH, delete, actions, "Create invoice now".
import { Router } from 'express';
import { db, byId, newId, nextNumber } from '../store.js';
import { errors, send, load, Validator, sendList, queryDate, queryEnum, queryString, matchesSearch } from '../http.js';
import { today, addDays, addYears, nowIso } from '../dates.js';
import { allow } from '../auth.js';
import { priceLines } from '../pricing.js';
import {
  SUB_STATUSES,
  buildLines,
  assertPlanLine,
  assertPlanAvailable,
  refreshRecurring,
  addHistory,
  serializeSubListItem,
  serializeSubDetail,
  actSend,
  actConfirm,
  actActivate,
  actPause,
  actResume,
  actRenew,
  actClose,
  actCancel,
} from '../domain/subscriptions.js';
import { billNextPeriod, serializeInvoiceDetail } from '../domain/invoices.js';

const router = Router();
const READ = allow('admin', 'staff', 'finance');
const WRITE = allow('admin', 'staff');
const isStaffUser = (u) => ['admin', 'staff', 'finance'].includes(u.role) || 'Must be a staff user';

// ---------------------------------------------------------------- list

/** Filters shared by the list and the CSV export. `ignoreStatus` for statusCounts. */
export function filterSubscriptions(query, { ignoreStatus = false } = {}) {
  const status = queryEnum(query, 'status', SUB_STATUSES);
  const customerId = queryString(query, 'customerId');
  const planId = queryString(query, 'planId');
  const search = queryString(query, 'search');
  const startFrom = queryDate(query, 'startFrom');
  const startTo = queryDate(query, 'startTo');
  const expiringBefore = queryDate(query, 'expiringBefore');
  return db.subscriptions.filter((s) => {
    if (!ignoreStatus && status && s.status !== status) return false;
    if (customerId && s.customerId !== customerId) return false;
    if (planId && s.planId !== planId) return false;
    if (startFrom && s.startDate < startFrom) return false;
    if (startTo && s.startDate > startTo) return false;
    if (expiringBefore && !(s.expiryDate < expiringBefore)) return false;
    if (search && !matchesSearch(search, s.number, byId('customers', s.customerId)?.name)) return false;
    return true;
  });
}

router.get('/subscriptions', READ, (req, res) => {
  const items = filterSubscriptions(req.query).map(serializeSubListItem);
  const statusCounts = Object.fromEntries(SUB_STATUSES.map((s) => [s, 0]));
  for (const s of filterSubscriptions(req.query, { ignoreStatus: true })) statusCounts[s.status]++;
  sendList(res, items, req.query, { defaultSort: '-createdAt', meta: { statusCounts } });
});

// ---------------------------------------------------------------- create / preview

/** Validate a create/preview body and resolve template defaults. Returns the would-be subscription fields. */
function resolveNewSubscription(body, user, { preview = false } = {}) {
  const v = new Validator(body);
  v.ref('customerId', 'customers', 'Customer', { required: !preview, activeOnly: true });
  const templateId = v.ref('templateId', 'templates', 'Quotation template', { nullable: true, activeOnly: true });
  const tpl = templateId ? byId('templates', templateId) : null;
  v.ref('planId', 'plans', 'Plan', { required: !tpl, activeOnly: true });
  v.date('startDate');
  v.date('expiryDate');
  v.oneOf('paymentTermDays', [0, 15, 30, 45]);
  v.ref('salespersonId', 'users', 'Salesperson', { nullable: true, check: (u) => (isStaffUser(u) === true ? null : 'Must be a staff user') });
  v.str('notes', { max: 4000 });
  v.array('lines');
  const b = v.done();

  const plan = byId('plans', b.planId ?? tpl.planId);
  const startDate = b.startDate ?? today();
  const expiryDate = b.expiryDate ?? addDays(addYears(startDate, 1), -1);
  if (expiryDate < startDate) throw errors.validation([{ field: 'expiryDate', message: 'Must be on or after the start date' }]);
  assertPlanAvailable(plan, startDate);

  let rawLines = b.lines && b.lines.length ? b.lines : null;
  if (!rawLines && tpl && tpl.planId === plan.id) rawLines = tpl.lines;
  if (!rawLines) rawLines = [{ productId: plan.productId, variantId: null, quantity: plan.minQuantity }];
  const lines = buildLines(rawLines, plan, { allowPriceOverride: true });
  assertPlanLine(lines, plan);

  return {
    customerId: b.customerId ?? null,
    planId: plan.id,
    templateId: tpl?.id ?? null,
    salespersonId: b.salespersonId !== undefined ? b.salespersonId : ['admin', 'staff'].includes(user.role) ? user.id : null,
    startDate,
    expiryDate,
    paymentTermDays: b.paymentTermDays ?? tpl?.paymentTermDays ?? 30,
    notes: b.notes ?? '',
    lines,
  };
}

router.post('/subscriptions/preview', WRITE, (req, res) => {
  const fields = resolveNewSubscription(req.body, req.user, { preview: true });
  const p = priceLines(fields.lines, today());
  send(res, { lines: p.lines, orderDiscount: p.orderDiscount, totals: p.totals });
});

router.post('/subscriptions', WRITE, (req, res) => {
  const fields = resolveNewSubscription(req.body, req.user);
  const ts = nowIso();
  const sub = {
    id: newId(),
    number: nextNumber('SUB', today().slice(0, 4)),
    ...fields,
    status: 'draft',
    quotationValidUntil: null,
    nextInvoiceDate: null,
    recurringTotal: 0,
    recurringNet: 0,
    pausedAt: null,
    closedAt: null,
    closeReason: null,
    history: [],
    createdAt: ts,
    updatedAt: ts,
  };
  refreshRecurring(sub);
  addHistory(sub, req.user.id, 'create', null, 'draft', null, ts);
  db.subscriptions.push(sub);
  send(res, serializeSubDetail(sub, req.user), 201);
});

// ---------------------------------------------------------------- detail / edit / delete

router.get('/subscriptions/:id', READ, (req, res) => {
  send(res, serializeSubDetail(load('subscriptions', req.params.id, 'Subscription'), req.user));
});

const ALL_FIELDS = ['customerId', 'planId', 'startDate', 'expiryDate', 'paymentTermDays', 'salespersonId', 'notes', 'lines'];
const EDITABLE = {
  draft: ALL_FIELDS,
  quotation: ALL_FIELDS,
  confirmed: ['startDate', 'expiryDate', 'salespersonId', 'notes', 'lines'],
  active: ['lines', 'salespersonId', 'notes'],
  paused: ['lines', 'salespersonId', 'notes'],
  closed: [],
};

router.patch('/subscriptions/:id', WRITE, (req, res) => {
  const sub = load('subscriptions', req.params.id, 'Subscription');
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (body.status !== undefined) {
    throw errors.validation([{ field: 'status', message: 'Status changes only through the action endpoints' }]);
  }
  if (sub.status === 'closed') throw errors.notEditable('A closed subscription can no longer be edited');

  const v = new Validator(body, { partial: true });
  v.ref('customerId', 'customers', 'Customer', { activeOnly: true });
  v.ref('planId', 'plans', 'Plan', { activeOnly: true });
  v.date('startDate');
  v.date('expiryDate');
  v.oneOf('paymentTermDays', [0, 15, 30, 45]);
  v.ref('salespersonId', 'users', 'Salesperson', { nullable: true, check: (u) => (isStaffUser(u) === true ? null : 'Must be a staff user') });
  v.str('notes', { max: 4000 });
  v.array('lines');
  const b = v.done();

  // Fields that are locked in this status may be sent back unchanged, but not changed.
  const allowed = EDITABLE[sub.status];
  for (const f of ALL_FIELDS) {
    if (b[f] === undefined || allowed.includes(f)) continue;
    if (b[f] !== sub[f]) throw errors.notEditable(`${f} can't be changed while the subscription is ${sub.status}`);
  }

  const plan = byId('plans', b.planId ?? sub.planId);
  const startDate = b.startDate ?? sub.startDate;
  const expiryDate = b.expiryDate ?? sub.expiryDate;
  if (expiryDate < startDate) throw errors.validation([{ field: 'expiryDate', message: 'Must be on or after the start date' }]);
  const planOrStartChanged = plan.id !== sub.planId || startDate !== sub.startDate;
  if (planOrStartChanged && ['draft', 'quotation', 'confirmed'].includes(sub.status)) assertPlanAvailable(plan, startDate);

  let lines = sub.lines;
  if (b.lines) {
    lines = buildLines(b.lines, plan, {
      existing: sub.lines,
      allowPriceOverride: ['draft', 'quotation'].includes(sub.status),
    });
  } else if (plan.id !== sub.planId && !lines.some((l) => l.productId === plan.productId)) {
    lines = [...lines, ...buildLines([{ productId: plan.productId, variantId: null, quantity: plan.minQuantity }], plan)];
  }
  assertPlanLine(lines, plan);

  const changed = ALL_FIELDS.filter((f) => b[f] !== undefined && (f === 'lines' || b[f] !== sub[f]));
  for (const f of ALL_FIELDS) if (f !== 'lines' && b[f] !== undefined) sub[f] = b[f];
  sub.lines = lines;
  refreshRecurring(sub);
  sub.updatedAt = nowIso();
  if (sub.status !== 'draft' && changed.length) {
    const note = `Edited: ${changed.join(', ')}${['active', 'paused'].includes(sub.status) && changed.includes('lines') ? ' (applies from the next invoice)' : ''}`;
    addHistory(sub, req.user.id, 'edit', sub.status, sub.status, note);
  }
  send(res, serializeSubDetail(sub, req.user));
});

router.delete('/subscriptions/:id', WRITE, (req, res) => {
  const sub = load('subscriptions', req.params.id, 'Subscription');
  if (sub.status !== 'draft') throw errors.notEditable('Only drafts can be deleted; cancel or close it instead');
  db.subscriptions.splice(db.subscriptions.indexOf(sub), 1);
  res.status(204).end();
});

// ---------------------------------------------------------------- actions

const noteOf = (req) => (typeof req.body?.note === 'string' ? req.body.note.trim() || null : null);

function action(path, fn) {
  router.post(`/subscriptions/:id/${path}`, WRITE, (req, res) => {
    const sub = load('subscriptions', req.params.id, 'Subscription');
    fn(sub, req);
    send(res, serializeSubDetail(sub, req.user));
  });
}

action('send', (sub, req) => actSend(sub, req.user.id));
action('confirm', (sub, req) => actConfirm(sub, req.user.id, noteOf(req)));
action('activate', (sub, req) => actActivate(sub, req.user.id, noteOf(req)));
action('pause', (sub, req) => actPause(sub, req.user.id, noteOf(req)));
action('resume', (sub, req) => actResume(sub, req.user.id, noteOf(req)));
action('renew', (sub, req) => {
  const v = new Validator(req.body);
  v.date('newExpiryDate', { nullable: true });
  const { newExpiryDate } = v.done();
  actRenew(sub, req.user.id, { newExpiryDate: newExpiryDate ?? undefined, note: noteOf(req) });
});
action('close', (sub, req) => actClose(sub, req.user.id, { note: noteOf(req) }));
action('cancel', (sub, req) => actCancel(sub, req.user.id, { note: noteOf(req) }));

// "Create invoice now": bill the next period immediately, exactly like the billing run.
router.post('/subscriptions/:id/invoices', WRITE, (req, res) => {
  const sub = load('subscriptions', req.params.id, 'Subscription');
  if (sub.status !== 'active') throw errors.invalidTransition(`Can't invoice a subscription that is ${sub.status}`);
  if (!sub.nextInvoiceDate || sub.nextInvoiceDate > sub.expiryDate) {
    throw errors.invalidTransition(`The next period starts after the expiry date (${sub.expiryDate}); renew it first`);
  }
  const inv = billNextPeriod(sub, today(), req.user.id);
  send(res, serializeInvoiceDetail(inv, req.user), 201);
});

export default router;
