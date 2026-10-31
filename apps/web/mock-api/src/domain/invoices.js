// Invoices and payments: creation from a subscription period, actions, serializers.
import { db, byId, newId, nextNumber } from '../store.js';
import { errors } from '../http.js';
import { today, addDays, diffDays, periodEndFor, nowIso } from '../dates.js';
import { priceLines } from '../pricing.js';
import { config } from '../config.js';
import { sendInvoice } from '../mailer.js';
import { customerRef, subscriptionRef, invoiceRef, userRef } from './refs.js';

// ------------------------------------------------------------ overdue (computed, never stored)

export function isOverdue(inv, on = today()) {
  return inv.status === 'confirmed' && inv.balance > 0 && inv.dueDate < on;
}
export function daysOverdue(inv, on = today()) {
  return isOverdue(inv, on) ? diffDays(on, inv.dueDate) : 0;
}

// ------------------------------------------------------------ creation

/** Build (but don't store) a Draft invoice for one period, snapshotting names, prices and rates. */
export function buildInvoice(sub, { periodStart, periodEnd, invoiceDate, pricing, createdBy, createdAt }) {
  const customer = byId('customers', sub.customerId);
  const ts = createdAt || nowIso();
  return {
    id: newId(),
    number: nextNumber('INV', invoiceDate.slice(0, 4)),
    subscriptionId: sub.id,
    customerId: sub.customerId,
    customerSnapshot: {
      name: customer.name,
      email: customer.email,
      billingAddress: { ...customer.billingAddress },
      taxId: customer.taxId,
    },
    periodStart,
    periodEnd,
    invoiceDate,
    dueDate: addDays(invoiceDate, sub.paymentTermDays),
    status: 'draft',
    isVoid: false,
    lines: pricing.lines.map((l) => ({
      ...structuredClone(l),
      id: newId(),
      description: l.variantLabel ? `${l.productName} · ${l.variantLabel}` : l.productName,
    })),
    orderDiscount: pricing.orderDiscount ? { ...pricing.orderDiscount } : null,
    ...pricing.totals,
    amountPaid: 0,
    balance: pricing.totals.total,
    appliedDiscountIds: [...pricing.appliedDiscountIds],
    sentAt: null,
    sentCount: 0,
    confirmedAt: null,
    paidAt: null,
    cancelledAt: null,
    createdBy,
    notes: '',
    createdAt: ts,
    updatedAt: ts,
  };
}

export function reserveDiscountUses(ids) {
  for (const id of ids) {
    const d = byId('discounts', id);
    if (d) d.usedCount += 1;
  }
}
export function releaseDiscountUses(ids) {
  for (const id of ids) {
    const d = byId('discounts', id);
    if (d) d.usedCount = Math.max(0, d.usedCount - 1);
  }
}

/**
 * Bill the subscription's next period (sub.nextInvoiceDate) with invoiceDate = the given date.
 * Same logic for the billing run and "Create invoice now". Never bills a period twice.
 */
export function billNextPeriod(sub, invoiceDate, createdBy) {
  const plan = byId('plans', sub.planId);
  const periodStart = sub.nextInvoiceDate;
  const periodEnd = periodEndFor(periodStart, plan.billingPeriod);
  const exists = db.invoices.some((i) => i.subscriptionId === sub.id && i.periodStart === periodStart && !i.isVoid);
  if (exists) throw errors.alreadyInvoiced(`Period starting ${periodStart} is already invoiced`);
  // Pricing uses current usedCount, so every discount it applies still has a use left;
  // reserving right away (single-threaded) is the in-memory version of the conditional update.
  const pricing = priceLines(sub.lines, invoiceDate);
  const inv = buildInvoice(sub, { periodStart, periodEnd, invoiceDate, pricing, createdBy });
  reserveDiscountUses(inv.appliedDiscountIds);
  db.invoices.push(inv);
  sub.nextInvoiceDate = addDays(periodEnd, 1);
  sub.updatedAt = nowIso();
  return inv;
}

// ------------------------------------------------------------ actions

export function confirmInvoice(inv) {
  if (inv.status !== 'draft') throw errors.invalidTransition(`Invoice is ${inv.status}`);
  inv.status = 'confirmed';
  inv.confirmedAt = nowIso();
  inv.updatedAt = inv.confirmedAt;
}

export function cancelInvoice(inv, { rebill = true } = {}) {
  if (!['draft', 'confirmed'].includes(inv.status)) throw errors.invalidTransition(`Invoice is ${inv.status}`);
  if (inv.amountPaid > 0) throw errors.hasPayments();
  const sub = byId('subscriptions', inv.subscriptionId);
  const latest = db.invoices
    .filter((i) => i.subscriptionId === inv.subscriptionId && !i.isVoid)
    .sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1))[0];
  inv.status = 'cancelled';
  inv.isVoid = true;
  inv.cancelledAt = nowIso();
  inv.updatedAt = inv.cancelledAt;
  releaseDiscountUses(inv.appliedDiscountIds);
  if (rebill && sub && latest?.id === inv.id && ['active', 'paused'].includes(sub.status)) {
    sub.nextInvoiceDate = inv.periodStart;
    sub.updatedAt = inv.cancelledAt;
  }
}

export function sendInvoiceEmail(inv) {
  if (!['confirmed', 'paid'].includes(inv.status)) {
    throw errors.invalidTransition(inv.status === 'draft' ? 'Confirm the invoice before sending it' : `Invoice is ${inv.status}`);
  }
  if (!inv.customerSnapshot.email) throw errors.invalidTransition('Customer has no email');
  sendInvoice(inv);
  inv.sentAt = nowIso();
  inv.sentCount += 1;
  inv.updatedAt = inv.sentAt;
}

// ------------------------------------------------------------ payments

export function recordPayment(inv, { method, amount, paymentDate, note }, user) {
  if (inv.status !== 'confirmed') {
    throw errors.invalidTransition(
      inv.status === 'draft' ? 'Confirm the invoice before recording a payment' : `Invoice is ${inv.status}`,
    );
  }
  if (amount > inv.balance) {
    throw errors.overpayment(`Payment of ${amount} paise is larger than the balance of ${inv.balance} paise`);
  }
  const ts = nowIso();
  const payment = {
    id: newId(),
    invoiceId: inv.id,
    customerId: inv.customerId,
    subscriptionId: inv.subscriptionId,
    method,
    amount,
    paymentDate,
    note: note || '',
    recordedBy: user.id,
    createdAt: ts,
    updatedAt: ts,
  };
  db.payments.push(payment);
  inv.amountPaid += amount;
  inv.balance -= amount;
  if (inv.balance === 0) {
    inv.status = 'paid';
    inv.paidAt = ts;
  }
  inv.updatedAt = ts;
  return payment;
}

export function reversePayment(payment) {
  const inv = byId('invoices', payment.invoiceId);
  if (inv) {
    inv.amountPaid -= payment.amount;
    inv.balance += payment.amount;
    if (inv.status === 'paid') {
      inv.status = 'confirmed';
      inv.paidAt = null;
    }
    inv.updatedAt = nowIso();
  }
  db.payments.splice(db.payments.indexOf(payment), 1);
}

// ------------------------------------------------------------ serializers

export function invoiceAllowedActions(inv, user) {
  const role = user.role;
  if (role === 'customer') return [];
  const canManage = role === 'admin' || role === 'staff';
  const out = [];
  if (inv.status === 'draft' && canManage) out.push('edit', 'confirm', 'cancel');
  if (inv.status === 'confirmed') {
    if (canManage && inv.amountPaid === 0) out.push('cancel');
    out.push('send');
    if (inv.balance > 0) out.push('recordPayment');
  }
  if (inv.status === 'paid') out.push('send');
  return out;
}

export function serializeInvoiceListItem(inv) {
  return {
    id: inv.id,
    number: inv.number,
    customer: customerRef(inv.customerId),
    subscription: subscriptionRef(inv.subscriptionId),
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    total: inv.total,
    amountPaid: inv.amountPaid,
    balance: inv.balance,
    status: inv.status,
    isOverdue: isOverdue(inv),
    daysOverdue: daysOverdue(inv),
    sentAt: inv.sentAt,
    sentCount: inv.sentCount,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };
}

export function serializePayment(p, { portal = false } = {}) {
  const out = {
    id: p.id,
    invoice: invoiceRef(p.invoiceId),
    customer: customerRef(p.customerId),
    subscription: subscriptionRef(p.subscriptionId),
    method: p.method,
    amount: p.amount,
    paymentDate: p.paymentDate,
    note: p.note,
    recordedBy: userRef(p.recordedBy),
    createdAt: p.createdAt,
  };
  if (portal) delete out.recordedBy;
  return out;
}

export function serializeInvoiceDetail(inv, user, { portal = false } = {}) {
  const payments = db.payments
    .filter((p) => p.invoiceId === inv.id)
    .sort((a, b) => (a.paymentDate === b.paymentDate ? (a.createdAt < b.createdAt ? -1 : 1) : a.paymentDate < b.paymentDate ? -1 : 1))
    .map((p) => {
      const s = serializePayment(p, { portal });
      return { id: s.id, method: s.method, amount: s.amount, paymentDate: s.paymentDate, note: s.note, ...(portal ? {} : { recordedBy: s.recordedBy }), createdAt: s.createdAt };
    });
  const { name, address, taxId, email } = config.company;
  const out = {
    id: inv.id,
    number: inv.number,
    status: inv.status,
    subscription: subscriptionRef(inv.subscriptionId),
    customer: customerRef(inv.customerId),
    customerSnapshot: structuredClone(inv.customerSnapshot),
    company: { name, address, taxId, email },
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    lines: structuredClone(inv.lines),
    orderDiscount: inv.orderDiscount ? { ...inv.orderDiscount } : null,
    untaxedAmount: inv.untaxedAmount,
    discountTotal: inv.discountTotal,
    taxTotal: inv.taxTotal,
    total: inv.total,
    amountPaid: inv.amountPaid,
    balance: inv.balance,
    isOverdue: isOverdue(inv),
    daysOverdue: daysOverdue(inv),
    payments,
    allowedActions: invoiceAllowedActions(inv, user),
    sentAt: inv.sentAt,
    sentCount: inv.sentCount,
    confirmedAt: inv.confirmedAt,
    paidAt: inv.paidAt,
    cancelledAt: inv.cancelledAt,
    isVoid: inv.isVoid,
    notes: inv.notes,
    createdBy: inv.createdBy,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };
  if (portal) {
    delete out.notes;
    delete out.createdBy;
  }
  return out;
}
