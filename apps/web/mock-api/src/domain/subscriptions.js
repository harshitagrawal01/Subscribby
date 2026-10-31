// Subscriptions: line building, plan rules, status actions, allowedActions, serializers (spec section 9).
import { db, byId, newId } from '../store.js';
import { errors } from '../http.js';
import { today, addDays, addMonths, diffDays, maxDate, nowIso } from '../dates.js';
import { priceLines, recurringAmounts } from '../pricing.js';
import { config } from '../config.js';
import { sendQuotation } from '../mailer.js';
import { userRef, actorRef, variantLabel } from './refs.js';

export const SUB_STATUSES = ['draft', 'quotation', 'confirmed', 'active', 'paused', 'closed'];

// ------------------------------------------------------------ pricing helpers

/** Default unit price (section 14): plan product = plan.price + extra; others = salesPrice + extra. */
export function defaultUnitPrice(product, variant, plan) {
  const extra = variant ? variant.extraPrice : 0;
  return (plan && product.id === plan.productId ? plan.price : product.salesPrice) + extra;
}

export function planAvailableOn(plan, date) {
  return plan.availableFrom <= date && (!plan.availableUntil || date <= plan.availableUntil);
}

export function assertPlanAvailable(plan, date) {
  if (!planAvailableOn(plan, date)) {
    const until = plan.availableUntil ? ` to ${plan.availableUntil}` : ' onwards';
    throw errors.planNotAvailable(`${plan.name} is only available from ${plan.availableFrom}${until}`);
  }
}

/**
 * Turn request lines into stored lines.
 * - A line with `id` updates that existing line; without `id` it is new.
 * - `unitPrice` omitted = default price; sent = override (only when allowPriceOverride).
 */
export function buildLines(input, plan, { existing = [], allowPriceOverride = true, field = 'lines' } = {}) {
  if (!Array.isArray(input)) throw errors.validation([{ field, message: 'Must be a list of lines' }]);
  const details = [];
  const out = [];
  input.forEach((raw, i) => {
    const f = `${field}[${i}]`;
    if (!raw || typeof raw !== 'object') return details.push({ field: f, message: 'Must be an object' });
    const prev = raw.id ? existing.find((l) => l.id === raw.id) : null;
    if (raw.id && !prev) return details.push({ field: `${f}.id`, message: 'Line not found on this subscription' });
    const productId = raw.productId ?? prev?.productId;
    const product = byId('products', productId);
    if (!product) return details.push({ field: `${f}.productId`, message: 'Product not found' });
    const changedItem = !prev || prev.productId !== product.id;
    if (changedItem && !product.isActive) return details.push({ field: `${f}.productId`, message: 'Product is archived' });
    const variantId = raw.variantId !== undefined ? raw.variantId : changedItem ? null : prev.variantId;
    let variant = null;
    if (variantId != null) {
      variant = product.variants.find((v) => v.id === variantId);
      if (!variant) return details.push({ field: `${f}.variantId`, message: 'Variant not found on this product' });
    }
    const quantity = raw.quantity !== undefined ? raw.quantity : prev?.quantity;
    if (!Number.isInteger(quantity) || quantity < 1) {
      return details.push({ field: `${f}.quantity`, message: 'Must be a whole number of 1 or more' });
    }
    const sameItem = prev && !changedItem && (prev.variantId ?? null) === (variant?.id ?? null);
    let unitPrice;
    if (raw.unitPrice !== undefined && raw.unitPrice !== null) {
      if (!Number.isInteger(raw.unitPrice) || raw.unitPrice < 0) {
        return details.push({ field: `${f}.unitPrice`, message: 'Must be a whole number of paise, 0 or more' });
      }
      if (allowPriceOverride) unitPrice = raw.unitPrice;
      else if (sameItem && raw.unitPrice === prev.unitPrice) unitPrice = prev.unitPrice;
      else throw errors.notEditable('Unit prices can only be changed while the subscription is a Draft or Quotation');
    } else {
      unitPrice = sameItem ? prev.unitPrice : defaultUnitPrice(product, variant, plan);
    }
    out.push({
      id: prev?.id ?? newId(),
      productId: product.id,
      productName: sameItem ? prev.productName : product.name,
      variantId: variant?.id ?? null,
      variantLabel: sameItem ? prev.variantLabel : variantLabel(variant),
      quantity,
      unitPrice,
    });
  });
  if (details.length) throw errors.validation(details);
  return out;
}

/** The plan's own product must be on the subscription with quantity ≥ minQuantity. */
export function assertPlanLine(lines, plan) {
  const product = byId('products', plan.productId);
  const qty = lines.filter((l) => l.productId === plan.productId).reduce((s, l) => s + l.quantity, 0);
  if (qty === 0) {
    throw errors.validation([{ field: 'lines', message: `Must include the plan's product (${product?.name})` }]);
  }
  if (qty < plan.minQuantity) {
    throw errors.belowMinQuantity(`${plan.name} needs at least ${plan.minQuantity} × ${product?.name} (got ${qty})`);
  }
}

export function refreshRecurring(sub) {
  Object.assign(sub, recurringAmounts(priceLines(sub.lines, today())));
}

// ------------------------------------------------------------ state helpers

export const isQuotationExpired = (sub, on = today()) =>
  sub.status === 'quotation' && !!sub.quotationValidUntil && sub.quotationValidUntil < on;

export const isPastExpiry = (sub, on = today()) => sub.expiryDate < on;

export const isExpiredFlag = (sub, on = today()) => ['active', 'paused'].includes(sub.status) && isPastExpiry(sub, on);

export const canCreateInvoice = (sub) =>
  sub.status === 'active' && !!sub.nextInvoiceDate && sub.nextInvoiceDate <= sub.expiryDate;

export function addHistory(sub, by, action, from, to, note = null, at = nowIso()) {
  sub.history.push({ at, by, action, from, to, note: note || null });
  sub.updatedAt = at;
}

function move(sub, to, action, by, note) {
  const from = sub.status;
  sub.status = to;
  addHistory(sub, by, action, from, to, note);
}

function assertStatus(sub, allowed, verb) {
  if (!allowed.includes(sub.status)) {
    throw errors.invalidTransition(`Can't ${verb} a subscription that is ${sub.status}`);
  }
}

// ------------------------------------------------------------ actions
// Each action validates, mutates and writes history. `by` = user id or "system".

export function actSend(sub, by) {
  assertStatus(sub, ['draft'], 'send');
  if (!sub.lines.length) throw errors.invalidTransition('Add at least one line before sending');
  const tpl = sub.templateId ? byId('templates', sub.templateId) : null;
  sub.quotationValidUntil = addDays(today(), tpl ? tpl.validityDays : 14);
  move(sub, 'quotation', 'send', by);
  const customer = byId('customers', sub.customerId);
  const login = customer?.userId ? byId('users', customer.userId) : null;
  if (login && login.status === 'active') sendQuotation(sub, customer, login);
}

export function actConfirm(sub, by, note, action = 'confirm') {
  assertStatus(sub, ['quotation'], action === 'accept' ? 'accept' : 'confirm');
  if (isQuotationExpired(sub)) throw errors.invalidTransition(`This quotation expired on ${sub.quotationValidUntil}`);
  move(sub, 'confirmed', 'confirm', by, note);
  if (sub.startDate <= today()) {
    sub.nextInvoiceDate = sub.startDate;
    move(sub, 'active', 'activate', by, 'Start date reached');
  }
}

export function actActivate(sub, by, note) {
  assertStatus(sub, ['confirmed'], 'activate');
  sub.nextInvoiceDate = sub.startDate;
  move(sub, 'active', 'activate', by, note);
}

export function actPause(sub, by, note) {
  assertStatus(sub, ['active'], 'pause');
  const plan = byId('plans', sub.planId);
  if (!plan.rules.pausable) throw errors.planRule(`The ${plan.name} plan doesn't allow pausing`);
  sub.pausedAt = nowIso();
  move(sub, 'paused', 'pause', by, note);
}

export function actResume(sub, by, note) {
  assertStatus(sub, ['paused'], 'resume');
  sub.nextInvoiceDate = maxDate(sub.nextInvoiceDate || today(), today());
  sub.pausedAt = null;
  move(sub, 'active', 'resume', by, note);
}

/** Expiry moves forward by one more term of the same length (or to body.newExpiryDate). */
export function nextTermExpiry(sub) {
  for (let months = 1; months <= 120; months++) {
    if (addDays(addMonths(sub.startDate, months), -1) === sub.expiryDate) {
      return addDays(addMonths(addDays(sub.expiryDate, 1), months), -1);
    }
  }
  return addDays(sub.expiryDate, diffDays(sub.expiryDate, sub.startDate) + 1);
}

export function actRenew(sub, by, { newExpiryDate, note } = {}) {
  assertStatus(sub, ['active', 'paused'], 'renew');
  const plan = byId('plans', sub.planId);
  if (!plan.rules.renewable) throw errors.planRule(`The ${plan.name} plan doesn't allow renewal`);
  const target = newExpiryDate ?? nextTermExpiry(sub);
  if (target <= sub.expiryDate) {
    throw errors.validation([{ field: 'newExpiryDate', message: `Must be after the current expiry date (${sub.expiryDate})` }]);
  }
  const old = sub.expiryDate;
  sub.expiryDate = target;
  addHistory(sub, by, 'renew', sub.status, sub.status, note || `Expiry ${old} → ${target}`);
}

export function actClose(sub, by, { note } = {}) {
  assertStatus(sub, ['active', 'paused'], 'close');
  const plan = byId('plans', sub.planId);
  const past = isPastExpiry(sub);
  if (!plan.rules.closable && !past) throw errors.planRule(`The ${plan.name} plan can't be closed before its expiry date`);
  sub.closeReason = past ? 'expired' : 'closed_early';
  sub.closedAt = nowIso();
  sub.nextInvoiceDate = null;
  move(sub, 'closed', 'close', by, note);
}

export function actCancel(sub, by, { note } = {}) {
  assertStatus(sub, ['draft', 'quotation', 'confirmed'], 'cancel');
  sub.closeReason = 'cancelled';
  sub.closedAt = nowIso();
  sub.nextInvoiceDate = null;
  move(sub, 'closed', 'cancel', by, note);
}

export function actReject(sub, by, { note } = {}) {
  assertStatus(sub, ['quotation'], 'reject');
  if (isQuotationExpired(sub)) throw errors.invalidTransition(`This quotation expired on ${sub.quotationValidUntil}`);
  sub.closeReason = 'rejected';
  sub.closedAt = nowIso();
  sub.nextInvoiceDate = null;
  move(sub, 'closed', 'reject', by, note || 'Rejected in portal');
}

// ------------------------------------------------------------ allowedActions

export function staffAllowedActions(sub, user) {
  if (!['admin', 'staff'].includes(user.role)) return []; // finance: always empty
  const rules = byId('plans', sub.planId)?.rules || {};
  const past = isPastExpiry(sub);
  switch (sub.status) {
    case 'draft':
      return ['edit', 'delete', ...(sub.lines.length ? ['send'] : []), 'cancel'];
    case 'quotation':
      return ['edit', ...(isQuotationExpired(sub) ? [] : ['confirm']), 'cancel'];
    case 'confirmed':
      return ['edit', 'activate', 'cancel'];
    case 'active':
      return [
        'edit',
        ...(rules.pausable ? ['pause'] : []),
        ...(rules.renewable ? ['renew'] : []),
        ...(rules.closable || past ? ['close'] : []),
        ...(canCreateInvoice(sub) ? ['createInvoice'] : []),
      ];
    case 'paused':
      return ['edit', 'resume', ...(rules.renewable ? ['renew'] : []), ...(rules.closable || past ? ['close'] : [])];
    default:
      return [];
  }
}

export function portalAllowedActions(sub) {
  if (sub.status === 'quotation') return isQuotationExpired(sub) ? [] : ['accept', 'reject'];
  if (!config.customerSelfService) return [];
  const rules = byId('plans', sub.planId)?.rules || {};
  const past = isPastExpiry(sub);
  if (sub.status === 'active') {
    return [
      ...(rules.pausable ? ['pause'] : []),
      ...(rules.renewable ? ['renew'] : []),
      ...(rules.closable || past ? ['close'] : []),
    ];
  }
  if (sub.status === 'paused') {
    return ['resume', ...(rules.renewable ? ['renew'] : []), ...(rules.closable || past ? ['close'] : [])];
  }
  return [];
}

// ------------------------------------------------------------ serializers

export function serializeSubListItem(sub) {
  const c = byId('customers', sub.customerId);
  const p = byId('plans', sub.planId);
  return {
    id: sub.id,
    number: sub.number,
    customer: c ? { id: c.id, name: c.name } : null,
    plan: p ? { id: p.id, name: p.name, billingPeriod: p.billingPeriod } : null,
    status: sub.status,
    startDate: sub.startDate,
    expiryDate: sub.expiryDate,
    isExpired: isExpiredFlag(sub),
    nextInvoiceDate: sub.nextInvoiceDate,
    quotationValidUntil: sub.quotationValidUntil,
    recurringTotal: sub.recurringTotal,
    recurringNet: sub.recurringNet,
    closeReason: sub.closeReason,
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
  };
}

export function serializeSubDetail(sub, user, { portal = false } = {}) {
  const pricing = priceLines(sub.lines, today());
  const plan = byId('plans', sub.planId);
  const tpl = sub.templateId ? byId('templates', sub.templateId) : null;
  const c = byId('customers', sub.customerId);
  const invoices = db.invoices
    .filter((i) => i.subscriptionId === sub.id && !i.isVoid && !(portal && i.status === 'draft'))
    .sort((a, b) => (a.periodStart === b.periodStart ? (a.number < b.number ? 1 : -1) : a.periodStart < b.periodStart ? 1 : -1));
  const last = invoices[0];
  const out = {
    id: sub.id,
    number: sub.number,
    status: sub.status,
    customer: c ? { id: c.id, name: c.name, email: c.email } : null,
    plan: plan
      ? { id: plan.id, name: plan.name, billingPeriod: plan.billingPeriod, minQuantity: plan.minQuantity, rules: { ...plan.rules } }
      : null,
    template: tpl ? { id: tpl.id, name: tpl.name } : null,
    salesperson: sub.salespersonId ? userRef(sub.salespersonId) : null,
    startDate: sub.startDate,
    expiryDate: sub.expiryDate,
    isExpired: isExpiredFlag(sub),
    quotationValidUntil: sub.quotationValidUntil,
    paymentTermDays: sub.paymentTermDays,
    nextInvoiceDate: sub.nextInvoiceDate,
    lines: pricing.lines,
    orderDiscount: pricing.orderDiscount,
    totals: pricing.totals,
    recurringTotal: sub.recurringTotal,
    recurringNet: sub.recurringNet,
    allowedActions: portal ? portalAllowedActions(sub) : staffAllowedActions(sub, user),
    invoiceSummary: {
      count: invoices.length,
      outstandingAmount: invoices.filter((i) => i.status === 'confirmed').reduce((s, i) => s + i.balance, 0),
      lastInvoice: last ? { id: last.id, number: last.number, status: last.status } : null,
    },
    history: sub.history
      .map((h, i) => [h, i])
      .sort(([a, ia], [b, ib]) => (a.at < b.at ? 1 : a.at > b.at ? -1 : ib - ia)) // newest first
      .map(([h]) => ({ at: h.at, by: actorRef(h.by), action: h.action, from: h.from, to: h.to, note: h.note })),
    pausedAt: sub.pausedAt,
    closedAt: sub.closedAt,
    closeReason: sub.closeReason,
    notes: sub.notes,
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
  };
  if (portal) {
    delete out.history;
    delete out.salesperson;
    delete out.notes;
  }
  return out;
}
