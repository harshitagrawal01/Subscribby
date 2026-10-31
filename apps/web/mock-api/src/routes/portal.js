// Section 13: customer portal. Every query is scoped to the logged-in user's customerId;
// another customer's record (or a draft) is 404, never 403.
import { Router } from 'express';
import { db } from '../store.js';
import { errors, send, sendList, queryBool, queryEnum } from '../http.js';
import { allow } from '../auth.js';
import { config } from '../config.js';
import {
  serializeSubListItem,
  serializeSubDetail,
  isQuotationExpired,
  actConfirm,
  actReject,
  actPause,
  actResume,
  actRenew,
  actClose,
} from '../domain/subscriptions.js';
import { isOverdue, serializeInvoiceListItem, serializeInvoiceDetail } from '../domain/invoices.js';
import { Validator } from '../http.js';

const router = Router();
const CUSTOMER = allow('customer');

const ownSubs = (user) => db.subscriptions.filter((s) => s.customerId === user.customerId && s.status !== 'draft');
const ownInvoices = (user) => db.invoices.filter((i) => i.customerId === user.customerId && i.status !== 'draft');

function ownSub(req) {
  const sub = ownSubs(req.user).find((s) => s.id === req.params.id);
  if (!sub) throw errors.notFound('Subscription');
  return sub;
}

router.get('/portal/summary', CUSTOMER, (req, res) => {
  const subs = ownSubs(req.user);
  const invoices = ownInvoices(req.user);
  const confirmed = invoices.filter((i) => i.status === 'confirmed');
  const next = subs
    .filter((s) => s.status === 'active' && s.nextInvoiceDate && s.nextInvoiceDate <= s.expiryDate)
    .sort((a, b) => (a.nextInvoiceDate < b.nextInvoiceDate ? -1 : 1))[0];
  send(res, {
    activeSubscriptions: subs.filter((s) => s.status === 'active').length,
    pendingQuotations: subs
      .filter((s) => s.status === 'quotation' && !isQuotationExpired(s))
      .map((s) => {
        const item = serializeSubListItem(s);
        return { id: s.id, number: s.number, plan: { id: item.plan.id, name: item.plan.name }, quotationValidUntil: s.quotationValidUntil, recurringTotal: s.recurringTotal };
      }),
    outstandingAmount: confirmed.reduce((s, i) => s + i.balance, 0),
    overdueCount: confirmed.filter((i) => isOverdue(i)).length,
    nextInvoice: next ? { subscriptionNumber: next.number, date: next.nextInvoiceDate, amount: next.recurringTotal } : null,
  });
});

router.get('/portal/subscriptions', CUSTOMER, (req, res) => {
  const status = queryEnum(req.query, 'status', ['quotation', 'confirmed', 'active', 'paused', 'closed']);
  const items = ownSubs(req.user)
    .filter((s) => !status || s.status === status)
    .map(serializeSubListItem);
  sendList(res, items, req.query, { defaultSort: '-createdAt' });
});

router.get('/portal/subscriptions/:id', CUSTOMER, (req, res) => {
  send(res, serializeSubDetail(ownSub(req), req.user, { portal: true }));
});

const noteOf = (req) => (typeof req.body?.note === 'string' ? req.body.note.trim() || null : null);

router.post('/portal/subscriptions/:id/accept', CUSTOMER, (req, res) => {
  const sub = ownSub(req);
  actConfirm(sub, req.user.id, noteOf(req) || 'Accepted in portal', 'accept');
  send(res, serializeSubDetail(sub, req.user, { portal: true }));
});

router.post('/portal/subscriptions/:id/reject', CUSTOMER, (req, res) => {
  const sub = ownSub(req);
  actReject(sub, req.user.id, { note: noteOf(req) });
  send(res, serializeSubDetail(sub, req.user, { portal: true }));
});

// Self-service, behind CUSTOMER_SELF_SERVICE (default false → 403 FORBIDDEN).
function selfService(path, fn) {
  router.post(`/portal/subscriptions/:id/${path}`, CUSTOMER, (req, res) => {
    if (!config.customerSelfService) throw errors.forbidden('Self-service changes are turned off; contact Brightloop');
    const sub = ownSub(req);
    fn(sub, req);
    send(res, serializeSubDetail(sub, req.user, { portal: true }));
  });
}
selfService('pause', (sub, req) => actPause(sub, req.user.id, noteOf(req)));
selfService('resume', (sub, req) => actResume(sub, req.user.id, noteOf(req)));
selfService('renew', (sub, req) => {
  const v = new Validator(req.body);
  v.date('newExpiryDate', { nullable: true });
  const { newExpiryDate } = v.done();
  actRenew(sub, req.user.id, { newExpiryDate: newExpiryDate ?? undefined, note: noteOf(req) });
});
selfService('close', (sub, req) => actClose(sub, req.user.id, { note: noteOf(req) }));

router.get('/portal/invoices', CUSTOMER, (req, res) => {
  const status = queryEnum(req.query, 'status', ['confirmed', 'paid', 'cancelled']);
  const unpaid = queryBool(req.query, 'unpaid');
  const items = ownInvoices(req.user)
    .filter((i) => (!status || i.status === status) && (unpaid === undefined || (i.status === 'confirmed' && i.balance > 0) === unpaid))
    .map(serializeInvoiceListItem);
  sendList(res, items, req.query, { defaultSort: '-invoiceDate,-number' });
});

router.get('/portal/invoices/:id', CUSTOMER, (req, res) => {
  const inv = ownInvoices(req.user).find((i) => i.id === req.params.id);
  if (!inv) throw errors.notFound('Invoice');
  send(res, serializeInvoiceDetail(inv, req.user, { portal: true }));
});

export default router;
