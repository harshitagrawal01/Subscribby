const mongoose = require("mongoose");
const Subscription = require("../models/Subscription");
const Plan = require("../models/Plan");
const Customer = require("../models/Customer");
const Invoice = require("../models/Invoice");
const { Discount } = require("../models/Discount");
const BillingRun = require("../models/BillingRun");
const { nextSequenceNumber } = require("../models/Counter");
const { priceLines } = require("./pricing");
const { todayIST, computePeriodEnd, addDaysStr } = require("../utils/date");
const { Errors } = require("../utils/errors");

/**
 * Step 1 of Billing Run (Page 34 & 38):
 * Applies automatic subscription lifecycle changes as of asOfDate:
 * 1. Quotation past quotationValidUntil -> Closed (quotation_expired)
 * 2. Confirmed with startDate <= asOfDate -> Active, nextInvoiceDate = startDate
 * 3. Active or Paused past expiryDate: if rules.autoClose -> Closed (expired)
 */
async function applyLifecycleChanges(asOfDate, dryRun = false) {
  const counts = {
    quotationsExpired: 0,
    activated: 0,
    autoClosed: 0,
  };

  // 1. Quotations past quotationValidUntil
  const expiredQuotes = await Subscription.find({
    status: "quotation",
    quotationValidUntil: { $ne: null, $lt: asOfDate },
  });
  counts.quotationsExpired = expiredQuotes.length;

  if (!dryRun) {
    for (const sub of expiredQuotes) {
      sub.status = "closed";
      sub.closedAt = new Date();
      sub.closeReason = "quotation_expired";
      sub.nextInvoiceDate = null;
      sub.history.unshift({
        at: new Date(),
        by: "system",
        action: "expireQuotation",
        from: "quotation",
        to: "closed",
        note: "Quotation expired automatically",
      });
      await sub.save();
    }
  }

  // 2. Confirmed with startDate <= asOfDate -> Active
  const toActivate = await Subscription.find({
    status: "confirmed",
    startDate: { $lte: asOfDate },
  });
  counts.activated = toActivate.length;

  if (!dryRun) {
    for (const sub of toActivate) {
      sub.status = "active";
      sub.nextInvoiceDate = sub.startDate;
      sub.history.unshift({
        at: new Date(),
        by: "system",
        action: "activate",
        from: "confirmed",
        to: "active",
        note: null,
      });
      await sub.save();
    }
  }

  // 3. Active or Paused past expiryDate with plan.rules.autoClose = true
  const pastExpiry = await Subscription.find({
    status: { $in: ["active", "paused"] },
    expiryDate: { $lt: asOfDate },
  });

  if (pastExpiry.length > 0) {
    const planIds = pastExpiry.map((s) => s.planId);
    const plans = await Plan.find({ _id: { $in: planIds } }).lean();
    const planMap = new Map(plans.map((p) => [String(p._id), p]));

    for (const sub of pastExpiry) {
      const plan = planMap.get(String(sub.planId));
      if (plan && plan.rules && plan.rules.autoClose) {
        counts.autoClosed += 1;
        if (!dryRun) {
          const prevStatus = sub.status;
          sub.status = "closed";
          sub.closedAt = new Date();
          sub.closeReason = "expired";
          sub.nextInvoiceDate = null;
          sub.history.unshift({
            at: new Date(),
            by: "system",
            action: "autoClose",
            from: prevStatus,
            to: "closed",
            note: "Subscription expired and auto-closed per plan rules",
          });
          await sub.save();
        }
      }
    }
  }

  return counts;
}

/**
 * Bills a single period for an active subscription inside a MongoDB transaction.
 * Reserves discount uses atomically; if a discount just ran out of uses, re-prices without it.
 */
async function billSinglePeriod(sub, plan, customer, asOfDate, createdBy = "system") {
  const periodStart = sub.nextInvoiceDate;
  if (!periodStart || periodStart > sub.expiryDate) {
    throw Errors.invalidTransition("No period due before expiryDate");
  }

  const periodEnd = computePeriodEnd(periodStart, plan.billingPeriod);
  const invoiceDate = asOfDate;
  const dueDate = addDaysStr(invoiceDate, sub.paymentTermDays || 0);
  const nextPeriodStart = addDaysStr(periodEnd, 1);

  const excludedDiscountIds = [];
  let maxAttempts = 3;

  while (maxAttempts > 0) {
    maxAttempts--;
    const priced = await priceLines(sub, invoiceDate, excludedDiscountIds);

    const session = await mongoose.startSession();
    let discountExhaustedId = null;
    let createdInvoice = null;

    try {
      await session.withTransaction(async () => {
        // Reserve each applied discount's use atomically (Page 46)
        for (const dId of priced.appliedDiscountIds) {
          const updatedDiscount = await Discount.findOneAndUpdate(
            {
              _id: dId,
              isActive: true,
              $or: [
                { usageLimit: null },
                { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
              ],
            },
            { $inc: { usedCount: 1 } },
            { session, new: true }
          );

          if (!updatedDiscount) {
            discountExhaustedId = dId;
            throw new Error("DISCOUNT_EXHAUSTED_RETRY");
          }
        }

        // Advance subscription's nextInvoiceDate conditionally
        const updatedSub = await Subscription.findOneAndUpdate(
          {
            _id: sub._id,
            nextInvoiceDate: periodStart,
          },
          {
            $set: {
              nextInvoiceDate: nextPeriodStart,
              recurringTotal: priced.recurringTotal,
              recurringNet: priced.recurringNet,
            },
          },
          { session, new: true }
        );

        if (!updatedSub) {
          const dupErr = new Error("ALREADY_BILLED");
          dupErr.code = 11000;
          throw dupErr;
        }

        const year = parseInt(invoiceDate.slice(0, 4), 10);
        const invNumber = await nextSequenceNumber("INV", year, session);

        const [inv] = await Invoice.create(
          [
            {
              number: invNumber,
              subscriptionId: sub._id,
              customerId: customer._id,
              customerSnapshot: {
                name: customer.name,
                email: customer.email,
                billingAddress: customer.billingAddress,
                taxId: customer.taxId,
              },
              periodStart,
              periodEnd,
              invoiceDate,
              dueDate,
              status: "draft",
              isVoid: false,
              lines: priced.lines,
              orderDiscount: priced.orderDiscount,
              untaxedAmount: priced.totals.untaxedAmount,
              discountTotal: priced.totals.discountTotal,
              taxTotal: priced.totals.taxTotal,
              total: priced.totals.total,
              amountPaid: 0,
              balance: priced.totals.total,
              appliedDiscountIds: priced.appliedDiscountIds,
              createdBy,
            },
          ],
          { session }
        );

        createdInvoice = inv;
        sub.nextInvoiceDate = nextPeriodStart;
      });

      await session.endSession();
      return { status: "created", invoice: createdInvoice };
    } catch (err) {
      await session.endSession();

      if (err.message === "DISCOUNT_EXHAUSTED_RETRY" && discountExhaustedId) {
        excludedDiscountIds.push(discountExhaustedId);
        continue;
      }

      if (err.code === 11000 || err.message === "ALREADY_BILLED") {
        return { status: "skipped" };
      }

      throw err;
    }
  }

  throw new Error("Could not price subscription after discount retries");
}

/**
 * Full Billing Run (Page 38-39):
 * Supports dryRun: true (counts what would happen without writing anything)
 * and catch-up loop for subscriptions multiple periods behind.
 */
async function executeBillingRun({ asOfDate = todayIST(), dryRun = false, createdBy = "system" } = {}) {
  const startedAt = new Date();
  const lifecycle = await applyLifecycleChanges(asOfDate, dryRun);

  const dueFilter = {
    status: "active",
    nextInvoiceDate: { $ne: null, $lte: asOfDate },
    $expr: { $lte: ["$nextInvoiceDate", "$expiryDate"] },
  };

  // Also include subscriptions that would become active today during dryRun
  let dueSubs = await Subscription.find(dueFilter);

  if (dryRun) {
    const wouldActivate = await Subscription.find({
      status: "confirmed",
      startDate: { $lte: asOfDate },
      $expr: { $lte: ["$startDate", "$expiryDate"] },
    });
    dueSubs = [...dueSubs, ...wouldActivate];
  }

  const dueSubscriptions = dueSubs.length;
  let created = 0;
  let skippedAlreadyInvoiced = 0;
  const failed = [];
  const invoiceIds = [];

  if (dueSubs.length > 0) {
    const planIds = dueSubs.map((s) => s.planId);
    const customerIds = dueSubs.map((s) => s.customerId);
    const [plans, customers] = await Promise.all([
      Plan.find({ _id: { $in: planIds } }).lean(),
      Customer.find({ _id: { $in: customerIds } }).lean(),
    ]);
    const planMap = new Map(plans.map((p) => [String(p._id), p]));
    const custMap = new Map(customers.map((c) => [String(c._id), c]));

    for (const sub of dueSubs) {
      const plan = planMap.get(String(sub.planId));
      const customer = custMap.get(String(sub.customerId));

      if (!plan || !customer) {
        failed.push({
          subscriptionId: String(sub._id),
          number: sub.number,
          code: "INTERNAL",
          message: "Missing plan or customer record",
        });
        continue;
      }

      // If dryRun, simulate the catch-up loop without writing
      if (dryRun) {
        let simDate = sub.nextInvoiceDate || sub.startDate;
        while (simDate && simDate <= asOfDate && simDate <= sub.expiryDate) {
          const alreadyExists = await Invoice.exists({
            subscriptionId: sub._id,
            periodStart: simDate,
            isVoid: false,
          });
          if (alreadyExists) {
            skippedAlreadyInvoiced += 1;
          } else {
            created += 1;
          }
          const pEnd = computePeriodEnd(simDate, plan.billingPeriod);
          simDate = addDaysStr(pEnd, 1);
        }
        continue;
      }

      // Real run: catch-up loop bills one period at a time while still due
      try {
        while (
          sub.nextInvoiceDate &&
          sub.nextInvoiceDate <= asOfDate &&
          sub.nextInvoiceDate <= sub.expiryDate
        ) {
          const existing = await Invoice.exists({
            subscriptionId: sub._id,
            periodStart: sub.nextInvoiceDate,
            isVoid: false,
          });
          if (existing) {
            skippedAlreadyInvoiced += 1;
            const pEnd = computePeriodEnd(sub.nextInvoiceDate, plan.billingPeriod);
            sub.nextInvoiceDate = addDaysStr(pEnd, 1);
            await sub.save();
            continue;
          }

          const res = await billSinglePeriod(sub, plan, customer, asOfDate, createdBy);
          if (res.status === "created") {
            created += 1;
            invoiceIds.push(String(res.invoice._id));
          } else if (res.status === "skipped") {
            skippedAlreadyInvoiced += 1;
            break;
          }
        }
      } catch (err) {
        failed.push({
          subscriptionId: String(sub._id),
          number: sub.number,
          code: err.code || "INTERNAL",
          message: err.message,
        });
      }
    }
  }

  const finishedAt = new Date();
  const resultPayload = {
    asOfDate,
    dryRun,
    lifecycle,
    dueSubscriptions,
    created,
    skippedAlreadyInvoiced,
    failed,
    invoiceIds,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  };

  if (!dryRun) {
    await BillingRun.create(resultPayload);
  }

  return resultPayload;
}

module.exports = {
  applyLifecycleChanges,
  billSinglePeriod,
  executeBillingRun,
};
