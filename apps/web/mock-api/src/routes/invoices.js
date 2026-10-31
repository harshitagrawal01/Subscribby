// Section 10: invoices, bulk actions, billing run. Section 11: payments.
import { Router } from 'express';
import { db, byId } from '../store.js';
import { errors, send, load, Validator, sendList, queryBool, queryDate, queryEnum, queryString, matchesSearch, ApiError } from '../http.js';
import { today, nowIso } from '../dates.js';
import { allow } from '../auth.js';
import { runBilling } from '../billing.js';
import {
  isOverdue,
  confirmInvoice,
  cancelInvoice,
  sendInvoiceEmail,
  recordPayment,
  reversePayment,
  serializeInvoiceListItem,
  serializeInvoiceDetail,
  serializePayment,
} from '../domain/invoices.js';

const router = Router();
const READ = allow('admin', 'staff', 'finance');
const WRITE = allow('admin', 'staff');
const INVOICE_STATUSES = ['draft', 'confirmed', 'paid', 'cancelled'];
const METHODS = ['bank_transfer', 'card', 'cash', 'cheque', 'upi', 'other'];

// ================================================================ invoices

/** Filters shared by the list, the CSV export and reports. */
export function filterInvoices(query, { ignoreStatus = false } = {}) {
  const status = queryEnum(query, 'status', INVOICE_STATUSES);
  const overdue = queryBool(query, 'overdue');
  const customerId = queryString(query, 'customerId');
  const subscriptionId = queryString(query, 'subscriptionId');
  const search = queryString(query, 'search');
  const invoiceFrom = queryDate(query, 'invoiceFrom');
  const invoiceTo = queryDate(query, 'invoiceTo');
  const dueFrom = queryDate(query, 'dueFrom');
  const dueTo = queryDate(query, 'dueTo');
  return db.invoices.filter((i) => {
    if (!ignoreStatus && status && i.status !== status) return false;
    if (!ignoreStatus && overdue !== undefined && isOverdue(i) !== overdue) return false;
    if (customerId && i.customerId !== customerId) return false;
    if (subscriptionId && i.subscriptionId !== subscriptionId) return false;
    if (invoiceFrom && i.invoiceDate < invoiceFrom) return false;
    if (invoiceTo && i.invoiceDate > invoiceTo) return false;
    if (dueFrom && i.dueDate < dueFrom) return false;
    if (dueTo && i.dueDate > dueTo) return false;
    if (search && !matchesSearch(search, i.number, byId('customers', i.customerId)?.name)) return false;
    return true;
  });
}

router.get('/invoices', READ, (req, res) => {
  const items = filterInvoices(req.query).map(serializeInvoiceListItem);
  const statusCounts = { draft: 0, confirmed: 0, paid: 0, cancelled: 0, overdue: 0 };
  for (const i of filterInvoices(req.query, { ignoreStatus: true })) {
    statusCounts[i.status]++;
    if (isOverdue(i)) statusCounts.overdue++;
  }
  sendList(res, items, req.query, { defaultSort: '-invoiceDate,-number', meta: { statusCounts } });
});

// Bulk endpoints are declared before /invoices/:id so "bulk" isn't read as an id.
function bulk(path, roles, fn) {
  router.post(`/invoices/bulk/${path}`, allow(...roles), (req, res) => {
    const v = new Validator(req.body);
    const ids = v.array('ids', { required: true });
    v.done();
    if (!ids.length) throw errors.validation([{ field: 'ids', message: 'Pick at least one invoice' }]);
    const succeeded = [];
    const failed = [];
    for (const id of ids) {
      const inv = byId('invoices', id);
      try {
        if (!inv) throw errors.notFound('Invoice');
        fn(inv);
        succeeded.push(id);
      } catch (e) {
        if (!(e instanceof ApiError)) throw e;
        failed.push({ id, code: e.code, message: e.message });
      }
    }
    send(res, { succeeded, failed });
  });
}
bulk('confirm', ['admin', 'staff'], confirmInvoice);
bulk('send', ['admin', 'staff', 'finance'], sendInvoiceEmail);

router.get('/invoices/:id', READ, (req, res) => {
  send(res, serializeInvoiceDetail(load('invoices', req.params.id, 'Invoice'), req.user));
});

router.patch('/invoices/:id', WRITE, (req, res) => {
  const inv = load('invoices', req.params.id, 'Invoice');
  const v = new Validator(req.body, { partial: true });
  v.forbid('status', 'Status changes only through the action endpoints');
  v.date('invoiceDate');
  v.date('dueDate');
  v.str('notes', { max: 4000 });
  const b = v.done();
  if (inv.status !== 'draft') throw errors.notEditable(`A ${inv.status} invoice can't be edited`);
  const invoiceDate = b.invoiceDate ?? inv.invoiceDate;
  const dueDate = b.dueDate ?? inv.dueDate;
  if (dueDate < invoiceDate) throw errors.validation([{ field: 'dueDate', message: 'Must be on or after the invoice date' }]);
  Object.assign(inv, { invoiceDate, dueDate });
  if (b.notes !== undefined) inv.notes = b.notes;
  inv.updatedAt = nowIso();
  send(res, serializeInvoiceDetail(inv, req.user));
});

router.post('/invoices/:id/confirm', WRITE, (req, res) => {
  const inv = load('invoices', req.params.id, 'Invoice');
  confirmInvoice(inv);
  send(res, serializeInvoiceDetail(inv, req.user));
});

router.post('/invoices/:id/cancel', WRITE, (req, res) => {
  const inv = load('invoices', req.params.id, 'Invoice');
  const v = new Validator(req.body);
  v.bool('rebill');
  const { rebill = true } = v.done();
  cancelInvoice(inv, { rebill });
  send(res, serializeInvoiceDetail(inv, req.user));
});

router.post('/invoices/:id/send', READ, (req, res) => {
  const inv = load('invoices', req.params.id, 'Invoice');
  sendInvoiceEmail(inv);
  send(res, serializeInvoiceDetail(inv, req.user));
});

// ================================================================ billing

router.post('/billing/run', READ, (req, res) => {
  const v = new Validator(req.body);
  v.date('asOfDate');
  v.bool('dryRun');
  const { asOfDate = today(), dryRun = false } = v.done();
  if (req.user.role === 'finance' && !dryRun) throw errors.forbidden('Finance can only preview billing (dryRun: true)');
  send(res, runBilling({ asOfDate, dryRun, userId: req.user.id }));
});

router.get('/billing/last-run', READ, (req, res) => {
  const last = db.billingRuns[db.billingRuns.length - 1];
  if (!last) return send(res, null);
  const { runBy, ...rest } = last;
  const by = runBy ? byId('users', runBy) : null;
  send(res, { ...rest, runBy: by ? { id: by.id, name: by.name } : null });
});

// ================================================================ payments

export function filterPayments(query) {
  const invoiceId = queryString(query, 'invoiceId');
  const customerId = queryString(query, 'customerId');
  const method = queryEnum(query, 'method', METHODS);
  const dateFrom = queryDate(query, 'dateFrom');
  const dateTo = queryDate(query, 'dateTo');
  const search = queryString(query, 'search');
  return db.payments.filter((p) => {
    if (invoiceId && p.invoiceId !== invoiceId) return false;
    if (customerId && p.customerId !== customerId) return false;
    if (method && p.method !== method) return false;
    if (dateFrom && p.paymentDate < dateFrom) return false;
    if (dateTo && p.paymentDate > dateTo) return false;
    if (search && !matchesSearch(search, byId('invoices', p.invoiceId)?.number, byId('customers', p.customerId)?.name)) return false;
    return true;
  });
}

router.get('/payments', READ, (req, res) => {
  const matching = filterPayments(req.query);
  const totalAmount = matching.reduce((s, p) => s + p.amount, 0);
  sendList(res, matching.map((p) => serializePayment(p)), req.query, { defaultSort: '-paymentDate,-createdAt', meta: { totalAmount } });
});

router.post('/payments', READ, (req, res) => {
  const v = new Validator(req.body);
  const invoiceId = v.str('invoiceId', { required: true });
  v.oneOf('method', METHODS, { required: true });
  v.int('amount', { required: true, min: 1, money: true });
  v.date('paymentDate');
  v.str('note', { max: 500 });
  const b = v.done();
  const paymentDate = b.paymentDate ?? today();
  if (paymentDate > today()) throw errors.validation([{ field: 'paymentDate', message: "Can't be in the future" }]);
  const inv = load('invoices', invoiceId, 'Invoice');
  const payment = recordPayment(inv, { ...b, paymentDate }, req.user);
  send(
    res,
    {
      payment: serializePayment(payment),
      invoice: { id: inv.id, number: inv.number, status: inv.status, amountPaid: inv.amountPaid, balance: inv.balance },
    },
    201,
  );
});

router.get('/payments/:id', READ, (req, res) => send(res, serializePayment(load('payments', req.params.id, 'Payment'))));

router.delete('/payments/:id', allow('admin'), (req, res) => {
  const p = load('payments', req.params.id, 'Payment');
  reversePayment(p);
  res.status(204).end();
});

export default router;
