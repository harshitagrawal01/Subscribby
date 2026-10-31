// The billing run (spec section 10): lifecycle changes, then bill every due period (catch-up),
// never billing a period twice. `dryRun` runs the exact same code on a snapshot and throws it away.
import { db, byId, snapshot, restore } from './store.js';
import { nowIso } from './dates.js';
import { addHistory } from './domain/subscriptions.js';
import { billNextPeriod } from './domain/invoices.js';
import { addDays, periodEndFor } from './dates.js';

/** Automatic subscription changes, in the spec's order, written as `by: "system"`. */
export function applyLifecycle(asOf) {
  const counts = { quotationsExpired: 0, activated: 0, autoClosed: 0 };
  const close = (sub, reason) => {
    const from = sub.status;
    sub.status = 'closed';
    sub.closeReason = reason;
    sub.closedAt = nowIso();
    sub.nextInvoiceDate = null;
    addHistory(sub, 'system', 'close', from, 'closed', reason === 'expired' ? 'Expired' : 'Quotation expired');
  };
  for (const sub of db.subscriptions) {
    if (sub.status === 'quotation' && sub.quotationValidUntil && sub.quotationValidUntil < asOf) {
      close(sub, 'quotation_expired');
      counts.quotationsExpired++;
    }
  }
  for (const sub of db.subscriptions) {
    if (sub.status === 'confirmed' && sub.startDate <= asOf) {
      sub.status = 'active';
      sub.nextInvoiceDate = sub.startDate;
      addHistory(sub, 'system', 'activate', 'confirmed', 'active', null);
      counts.activated++;
    }
  }
  for (const sub of db.subscriptions) {
    if (['active', 'paused'].includes(sub.status) && sub.expiryDate < asOf) {
      const plan = byId('plans', sub.planId);
      if (plan?.rules.autoClose) {
        close(sub, 'expired');
        counts.autoClosed++;
      }
      // otherwise it stays (isExpired: true) and billing stops after expiryDate
    }
  }
  return counts;
}

const isDue = (sub, asOf) =>
  sub.status === 'active' && !!sub.nextInvoiceDate && sub.nextInvoiceDate <= asOf && sub.nextInvoiceDate <= sub.expiryDate;

export function runBilling({ asOfDate, dryRun = false, userId = null }) {
  const startedAt = nowIso();
  const snap = dryRun ? snapshot(['subscriptions', 'invoices', 'discounts', 'counters', 'emails']) : null;
  let result;
  try {
    const lifecycle = applyLifecycle(asOfDate);
    const due = db.subscriptions.filter((s) => isDue(s, asOfDate));
    let created = 0;
    let skippedAlreadyInvoiced = 0;
    const failed = [];
    const invoiceIds = [];
    for (const sub of due) {
      try {
        let guard = 0;
        while (isDue(sub, asOfDate) && guard++ < 2000) {
          try {
            const inv = billNextPeriod(sub, asOfDate, 'system');
            created++;
            invoiceIds.push(inv.id);
          } catch (e) {
            if (e.code !== 'ALREADY_INVOICED') throw e;
            // Someone already billed this period: count it and move on to the next one.
            skippedAlreadyInvoiced++;
            const plan = byId('plans', sub.planId);
            sub.nextInvoiceDate = addDays(periodEndFor(sub.nextInvoiceDate, plan.billingPeriod), 1);
          }
        }
      } catch (e) {
        failed.push({ subscriptionId: sub.id, number: sub.number, code: e.code || 'INTERNAL', message: e.message });
      }
    }
    result = {
      asOfDate,
      dryRun,
      lifecycle,
      dueSubscriptions: due.length,
      created,
      skippedAlreadyInvoiced,
      failed,
      invoiceIds: dryRun ? [] : invoiceIds,
      startedAt,
      finishedAt: nowIso(),
    };
  } finally {
    if (snap) restore(snap);
  }
  if (!dryRun) db.billingRuns.push({ ...result, runBy: userId });
  return result;
}
