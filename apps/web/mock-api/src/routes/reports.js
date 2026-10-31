// Section 12: dashboard tiles, charts, aging and CSV export.
import { Router } from 'express';
import { db, byId } from '../store.js';
import { errors, send, queryDate, queryString } from '../http.js';
import { today, addMonths, addDays, diffDays } from '../dates.js';
import { allow } from '../auth.js';
import { isOverdue } from '../domain/invoices.js';
import { filterInvoices, filterPayments } from './invoices.js';
import { filterSubscriptions } from './subscriptions.js';

const router = Router();
const READ = allow('admin', 'staff', 'finance');
const MONTHLY_FACTOR = { daily: 365 / 12, weekly: 52 / 12, monthly: 1, yearly: 1 / 12 };

function sharedFilters(query) {
  const t = today();
  const from = queryDate(query, 'from') ?? `${t.slice(0, 7)}-01`;
  const to = queryDate(query, 'to') ?? addDays(addMonths(`${t.slice(0, 7)}-01`, 1), -1);
  if (to < from) throw errors.validation([{ field: 'to', message: 'Must be on or after from' }], 'Invalid query parameters');
  return { from, to, planId: queryString(query, 'planId'), customerId: queryString(query, 'customerId') };
}

const subMatches = (s, f) => (!f.planId || s.planId === f.planId) && (!f.customerId || s.customerId === f.customerId);
const invMatches = (i, f) => {
  if (f.customerId && i.customerId !== f.customerId) return false;
  if (f.planId && byId('subscriptions', i.subscriptionId)?.planId !== f.planId) return false;
  return true;
};
const payMatches = (p, f) => {
  if (f.customerId && p.customerId !== f.customerId) return false;
  if (f.planId && byId('subscriptions', p.subscriptionId)?.planId !== f.planId) return false;
  return true;
};
const monthlyNet = (s) => (s.recurringNet || 0) * MONTHLY_FACTOR[byId('plans', s.planId)?.billingPeriod ?? 'monthly'];

router.get('/reports/summary', READ, (req, res) => {
  const f = sharedFilters(req.query);
  const inRange = (d) => d && d >= f.from && d <= f.to;
  const subs = db.subscriptions.filter((s) => subMatches(s, f));
  const active = subs.filter((s) => s.status === 'active');
  const started = (s) =>
    ['active', 'paused'].includes(s.status) || (s.status === 'closed' && ['expired', 'closed_early'].includes(s.closeReason));
  const invoices = db.invoices.filter((i) => invMatches(i, f));
  const confirmed = invoices.filter((i) => i.status === 'confirmed');
  const overdue = confirmed.filter((i) => isOverdue(i));
  send(res, {
    range: { from: f.from, to: f.to },
    activeSubscriptions: active.length,
    newSubscriptions: subs.filter((s) => inRange(s.startDate) && started(s)).length,
    closedSubscriptions: subs.filter(
      (s) => s.status === 'closed' && ['expired', 'closed_early'].includes(s.closeReason) && inRange(s.closedAt && istDate(s.closedAt)),
    ).length,
    mrr: Math.round(active.reduce((sum, s) => sum + monthlyNet(s), 0)),
    revenueCollected: db.payments.filter((p) => payMatches(p, f) && inRange(p.paymentDate)).reduce((s, p) => s + p.amount, 0),
    invoicedAmount: invoices
      .filter((i) => ['confirmed', 'paid'].includes(i.status) && inRange(i.invoiceDate))
      .reduce((s, i) => s + i.total, 0),
    outstandingAmount: confirmed.reduce((s, i) => s + i.balance, 0),
    overdueAmount: overdue.reduce((s, i) => s + i.balance, 0),
    overdueCount: overdue.length,
  });
});

const istDate = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(iso));

function monthParam(query, name, fallback) {
  const v = query[name];
  if (v === undefined || v === '') return fallback;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.slice(0, 7);
  throw errors.validation([{ field: name, message: 'Must be a month as YYYY-MM' }], 'Invalid query parameters');
}

router.get('/reports/revenue-by-month', READ, (req, res) => {
  const current = today().slice(0, 7);
  const to = monthParam(req.query, 'to', current);
  const from = monthParam(req.query, 'from', addMonths(`${to}-01`, -5).slice(0, 7));
  if (from > to) throw errors.validation([{ field: 'from', message: 'Must be on or before to' }], 'Invalid query parameters');
  const months = [];
  for (let m = from; m <= to; m = addMonths(`${m}-01`, 1).slice(0, 7)) months.push(m);
  if (months.length > 24) throw errors.validation([{ field: 'from', message: 'At most 24 months' }], 'Invalid query parameters');
  const f = { planId: queryString(req.query, 'planId'), customerId: queryString(req.query, 'customerId') };
  const rows = new Map(months.map((m) => [m, { month: m, invoiced: 0, collected: 0 }]));
  for (const i of db.invoices) {
    const row = rows.get(i.invoiceDate.slice(0, 7));
    if (row && ['confirmed', 'paid'].includes(i.status) && invMatches(i, f)) row.invoiced += i.total;
  }
  for (const p of db.payments) {
    const row = rows.get(p.paymentDate.slice(0, 7));
    if (row && payMatches(p, f)) row.collected += p.amount;
  }
  send(res, [...rows.values()]);
});

router.get('/reports/subscriptions-by-plan', READ, (req, res) => {
  const f = sharedFilters(req.query);
  const groups = new Map();
  for (const s of db.subscriptions) {
    if (s.status !== 'active' || !subMatches(s, f)) continue;
    const plan = byId('plans', s.planId);
    if (!groups.has(plan.id)) groups.set(plan.id, { plan: { id: plan.id, name: plan.name }, count: 0, mrr: 0 });
    const g = groups.get(plan.id);
    g.count++;
    g.mrr += monthlyNet(s);
  }
  send(
    res,
    [...groups.values()].map((g) => ({ ...g, mrr: Math.round(g.mrr) })).sort((a, b) => b.count - a.count || b.mrr - a.mrr),
  );
});

router.get('/reports/aging', READ, (req, res) => {
  const f = sharedFilters(req.query);
  const t = today();
  const buckets = ['current', '1-30', '31-60', '61-90', '90+'].map((bucket) => ({ bucket, count: 0, amount: 0 }));
  for (const i of db.invoices) {
    if (i.status !== 'confirmed' || i.balance <= 0 || !invMatches(i, f)) continue;
    const days = i.dueDate < t ? diffDays(t, i.dueDate) : 0;
    const idx = days === 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
    buckets[idx].count++;
    buckets[idx].amount += i.balance;
  }
  send(res, buckets);
});

// ---------------------------------------------------------------- CSV export

const rupees = (paise) => (paise / 100).toFixed(2);
function toCsv(header, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

router.get('/reports/export', READ, (req, res) => {
  const type = req.query.type;
  let csv;
  if (type === 'invoices') {
    csv = toCsv(
      ['number', 'customer', 'subscription', 'status', 'invoiceDate', 'dueDate', 'periodStart', 'periodEnd', 'untaxedAmount', 'discountTotal', 'taxTotal', 'total', 'amountPaid', 'balance', 'isOverdue'],
      filterInvoices(req.query)
        .sort((a, b) => (a.number < b.number ? -1 : 1))
        .map((i) => [
          i.number, byId('customers', i.customerId)?.name, byId('subscriptions', i.subscriptionId)?.number, i.status,
          i.invoiceDate, i.dueDate, i.periodStart, i.periodEnd, rupees(i.untaxedAmount), rupees(i.discountTotal),
          rupees(i.taxTotal), rupees(i.total), rupees(i.amountPaid), rupees(i.balance), isOverdue(i),
        ]),
    );
  } else if (type === 'payments') {
    csv = toCsv(
      ['paymentDate', 'invoice', 'customer', 'method', 'amount', 'note', 'recordedBy'],
      filterPayments(req.query)
        .sort((a, b) => (a.paymentDate < b.paymentDate ? -1 : 1))
        .map((p) => [
          p.paymentDate, byId('invoices', p.invoiceId)?.number, byId('customers', p.customerId)?.name, p.method,
          rupees(p.amount), p.note, byId('users', p.recordedBy)?.name,
        ]),
    );
  } else if (type === 'subscriptions') {
    csv = toCsv(
      ['number', 'customer', 'plan', 'status', 'startDate', 'expiryDate', 'nextInvoiceDate', 'recurringTotal', 'recurringNet', 'closeReason'],
      filterSubscriptions(req.query)
        .sort((a, b) => (a.number < b.number ? -1 : 1))
        .map((s) => [
          s.number, byId('customers', s.customerId)?.name, byId('plans', s.planId)?.name, s.status, s.startDate,
          s.expiryDate, s.nextInvoiceDate, rupees(s.recurringTotal), rupees(s.recurringNet), s.closeReason,
        ]),
    );
  } else {
    throw errors.validation([{ field: 'type', message: 'Must be one of: invoices, payments, subscriptions' }], 'Invalid query parameters');
  }
  res
    .status(200)
    .type('text/csv')
    .set('Content-Disposition', `attachment; filename="${type}-${today()}.csv"`)
    .send(csv);
});

export default router;
