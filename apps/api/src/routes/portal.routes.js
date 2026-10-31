const express = require("express");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");
const Plan = require("../models/Plan");
const env = require("../config/env");
const { formatSubscriptionDetail } = require("./subscriptions.routes");
const { formatInvoiceDetail, computeOverdueInfo } = require("./invoices.routes");
const { authenticate, requireRole } = require("../middleware/auth");
const { Errors } = require("../utils/errors");
const { todayIST, defaultExpiryDate, addDaysStr, isValidDateString } = require("../utils/date");
const { parsePagination, buildMeta } = require("../utils/pagination");

const router = express.Router();

// All /portal/* endpoints are strictly for role "customer" and scoped to req.user.customerId
router.use(authenticate, requireRole("customer"));

function computePortalAllowedActions(sub, plan, today = todayIST()) {
  const actions = [];
  if (sub.status === "quotation") {
    const expired = sub.quotationValidUntil && sub.quotationValidUntil < today;
    if (!expired) {
      actions.push("accept", "reject");
    }
  }

  if (env.CUSTOMER_SELF_SERVICE) {
    const rules = (plan && plan.rules) || {};
    if (sub.status === "active") {
      if (rules.pausable) actions.push("pause");
      if (rules.renewable) actions.push("renew");
      if (rules.closable || sub.expiryDate < today) actions.push("close");
    } else if (sub.status === "paused") {
      actions.push("resume");
      if (rules.renewable) actions.push("renew");
      if (rules.closable || sub.expiryDate < today) actions.push("close");
    }
  }

  return actions;
}

function stripStaffFieldsFromSub(detail, sub, plan) {
  const copy = { ...detail };
  delete copy.history;
  delete copy.salesperson;
  delete copy.notes;
  copy.allowedActions = computePortalAllowedActions(sub, plan);
  return copy;
}

function stripStaffFieldsFromInv(detail) {
  const copy = { ...detail };
  delete copy.notes;
  delete copy.createdBy;
  if (Array.isArray(copy.payments)) {
    copy.payments = copy.payments.map((p) => {
      const pc = { ...p };
      delete pc.recordedBy;
      return pc;
    });
  }
  copy.allowedActions = [];
  return copy;
}

// GET /api/v1/portal/summary
router.get("/summary", async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const today = todayIST();

    const [activeSubs, pendingQuotes, confirmedInvs, nextSub] = await Promise.all([
      Subscription.countDocuments({ customerId, status: "active" }),
      Subscription.find({
        customerId,
        status: "quotation",
        $or: [{ quotationValidUntil: null }, { quotationValidUntil: { $gte: today } }],
      })
        .sort({ createdAt: -1 })
        .lean(),
      Invoice.find({ customerId, status: "confirmed", balance: { $gt: 0 } }).lean(),
      Subscription.findOne({
        customerId,
        status: "active",
        nextInvoiceDate: { $ne: null },
      })
        .sort({ nextInvoiceDate: 1 })
        .lean(),
    ]);

    const planIds = pendingQuotes.map((q) => q.planId);
    const plans = await Plan.find({ _id: { $in: planIds } }, { name: 1 }).lean();
    const planMap = new Map(plans.map((p) => [String(p._id), p.name]));

    const outstandingAmount = confirmedInvs.reduce((sum, i) => sum + i.balance, 0);
    const overdueCount = confirmedInvs.filter((i) => i.dueDate < today).length;

    return res.json({
      data: {
        activeSubscriptions: activeSubs,
        pendingQuotations: pendingQuotes.map((q) => ({
          id: String(q._id),
          number: q.number,
          plan: { name: planMap.get(String(q.planId)) || "" },
          quotationValidUntil: q.quotationValidUntil,
          recurringTotal: q.recurringTotal,
        })),
        outstandingAmount,
        overdueCount,
        nextInvoice: nextSub
          ? {
              subscriptionNumber: nextSub.number,
              date: nextSub.nextInvoiceDate,
              amount: nextSub.recurringTotal,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/portal/subscriptions
router.get("/subscriptions", async (req, res, next) => {
  try {
    const { page, limit, skip, sort } = parsePagination(req.query);
    const customerId = req.user.customerId;

    // Customers never see draft subscriptions (Page 43 & 54)
    const filter = {
      customerId,
      status: { $ne: "draft" },
    };
    if (req.query.status) {
      if (req.query.status === "draft") {
        return res.json({ data: [], meta: buildMeta(page, limit, 0) });
      }
      filter.status = req.query.status;
    }

    const [subs, total] = await Promise.all([
      Subscription.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Subscription.countDocuments(filter),
    ]);

    const planIds = subs.map((s) => s.planId);
    const plans = await Plan.find(
      { _id: { $in: planIds } },
      { name: 1, billingPeriod: 1 }
    ).lean();
    const planMap = new Map(plans.map((p) => [String(p._id), p]));

    const data = subs.map((s) => {
      const p = planMap.get(String(s.planId));
      return {
        id: String(s._id),
        number: s.number,
        plan: p
          ? { id: String(p._id), name: p.name, billingPeriod: p.billingPeriod }
          : null,
        status: s.status,
        startDate: s.startDate,
        expiryDate: s.expiryDate,
        quotationValidUntil: s.quotationValidUntil || null,
        nextInvoiceDate: s.nextInvoiceDate || null,
        recurringTotal: s.recurringTotal || 0,
      };
    });

    return res.json({ data, meta: buildMeta(page, limit, total) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/portal/subscriptions/:id
router.get("/subscriptions/:id", async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({
      _id: req.params.id,
      customerId: req.user.customerId,
      status: { $ne: "draft" },
    });
    // Return 404 NOT_FOUND for someone else's ID or a draft (Page 44)
    if (!sub) throw Errors.notFound();

    const [detail, plan] = await Promise.all([
      formatSubscriptionDetail(sub, "customer"),
      Plan.findById(sub.planId).lean(),
    ]);

    return res.json({ data: stripStaffFieldsFromSub(detail, sub, plan) });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/portal/subscriptions/:id/accept
router.post("/subscriptions/:id/accept", async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({
      _id: req.params.id,
      customerId: req.user.customerId,
      status: { $ne: "draft" },
    });
    if (!sub) throw Errors.notFound();

    if (sub.status !== "quotation") {
      throw Errors.invalidTransition("Only Quotations can be accepted");
    }

    const today = todayIST();
    if (sub.quotationValidUntil && sub.quotationValidUntil < today) {
      throw Errors.invalidTransition("Quotation has expired");
    }

    sub.status = "confirmed";
    sub.history.unshift({
      at: new Date(),
      by: req.user._id,
      action: "confirm",
      from: "quotation",
      to: "confirmed",
      note: "Accepted in portal",
    });

    if (sub.startDate <= today) {
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
    }

    await sub.save();
    const [detail, plan] = await Promise.all([
      formatSubscriptionDetail(sub, "customer"),
      Plan.findById(sub.planId).lean(),
    ]);
    return res.json({ data: stripStaffFieldsFromSub(detail, sub, plan) });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/portal/subscriptions/:id/reject
router.post("/subscriptions/:id/reject", async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({
      _id: req.params.id,
      customerId: req.user.customerId,
      status: { $ne: "draft" },
    });
    if (!sub) throw Errors.notFound();

    if (sub.status !== "quotation") {
      throw Errors.invalidTransition("Only Quotations can be rejected");
    }

    sub.status = "closed";
    sub.closedAt = new Date();
    sub.closeReason = "rejected";
    sub.nextInvoiceDate = null;
    sub.history.unshift({
      at: new Date(),
      by: req.user._id,
      action: "reject",
      from: "quotation",
      to: "closed",
      note: req.body?.note || "Rejected in portal",
    });

    await sub.save();
    const [detail, plan] = await Promise.all([
      formatSubscriptionDetail(sub, "customer"),
      Plan.findById(sub.planId).lean(),
    ]);
    return res.json({ data: stripStaffFieldsFromSub(detail, sub, plan) });
  } catch (err) {
    next(err);
  }
});

// Self-service actions behind CUSTOMER_SELF_SERVICE flag (Page 44)
function requireSelfServiceFlag(req, res, next) {
  if (!env.CUSTOMER_SELF_SERVICE) {
    return next(Errors.forbidden("Customer self-service is disabled"));
  }
  next();
}

router.post("/subscriptions/:id/pause", requireSelfServiceFlag, async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({
      _id: req.params.id,
      customerId: req.user.customerId,
      status: { $ne: "draft" },
    });
    if (!sub) throw Errors.notFound();
    if (sub.status !== "active") throw Errors.invalidTransition();

    const plan = await Plan.findById(sub.planId);
    if (!plan?.rules?.pausable) throw Errors.planRule();

    sub.status = "paused";
    sub.pausedAt = new Date();
    sub.history.unshift({
      at: new Date(),
      by: req.user._id,
      action: "pause",
      from: "active",
      to: "paused",
      note: "Paused in customer portal",
    });
    await sub.save();
    const detail = await formatSubscriptionDetail(sub, "customer");
    return res.json({ data: stripStaffFieldsFromSub(detail, sub, plan) });
  } catch (err) {
    next(err);
  }
});

router.post("/subscriptions/:id/resume", requireSelfServiceFlag, async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({
      _id: req.params.id,
      customerId: req.user.customerId,
      status: { $ne: "draft" },
    });
    if (!sub) throw Errors.notFound();
    if (sub.status !== "paused") throw Errors.invalidTransition();

    const today = todayIST();
    sub.status = "active";
    sub.pausedAt = null;
    if (!sub.nextInvoiceDate || sub.nextInvoiceDate < today) {
      sub.nextInvoiceDate = today;
    }
    sub.history.unshift({
      at: new Date(),
      by: req.user._id,
      action: "resume",
      from: "paused",
      to: "active",
      note: "Resumed in customer portal",
    });
    await sub.save();
    const [detail, plan] = await Promise.all([
      formatSubscriptionDetail(sub, "customer"),
      Plan.findById(sub.planId).lean(),
    ]);
    return res.json({ data: stripStaffFieldsFromSub(detail, sub, plan) });
  } catch (err) {
    next(err);
  }
});

router.post("/subscriptions/:id/renew", requireSelfServiceFlag, async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({
      _id: req.params.id,
      customerId: req.user.customerId,
      status: { $ne: "draft" },
    });
    if (!sub) throw Errors.notFound();
    if (!["active", "paused"].includes(sub.status)) throw Errors.invalidTransition();

    const plan = await Plan.findById(sub.planId);
    if (!plan?.rules?.renewable) throw Errors.planRule();

    const dayAfterExpiry = addDaysStr(sub.expiryDate, 1);
    sub.expiryDate = defaultExpiryDate(dayAfterExpiry);
    sub.history.unshift({
      at: new Date(),
      by: req.user._id,
      action: "renew",
      from: sub.status,
      to: sub.status,
      note: "Renewed in customer portal",
    });
    await sub.save();
    const detail = await formatSubscriptionDetail(sub, "customer");
    return res.json({ data: stripStaffFieldsFromSub(detail, sub, plan) });
  } catch (err) {
    next(err);
  }
});

router.post("/subscriptions/:id/close", requireSelfServiceFlag, async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({
      _id: req.params.id,
      customerId: req.user.customerId,
      status: { $ne: "draft" },
    });
    if (!sub) throw Errors.notFound();
    if (!["active", "paused"].includes(sub.status)) throw Errors.invalidTransition();

    const today = todayIST();
    const isPastExpiry = sub.expiryDate < today;
    const plan = await Plan.findById(sub.planId);
    if (!isPastExpiry && !plan?.rules?.closable) throw Errors.planRule();

    const prevStatus = sub.status;
    sub.status = "closed";
    sub.closedAt = new Date();
    sub.closeReason = isPastExpiry ? "expired" : "closed_early";
    sub.nextInvoiceDate = null;
    sub.history.unshift({
      at: new Date(),
      by: req.user._id,
      action: "close",
      from: prevStatus,
      to: "closed",
      note: req.body?.note || "Closed in customer portal",
    });
    await sub.save();
    const detail = await formatSubscriptionDetail(sub, "customer");
    return res.json({ data: stripStaffFieldsFromSub(detail, sub, plan) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/portal/invoices
router.get("/invoices", async (req, res, next) => {
  try {
    const { page, limit, skip, sort } = parsePagination(req.query);
    const customerId = req.user.customerId;
    const today = todayIST();

    // Customers never see draft invoices (Page 44 & 54)
    const filter = {
      customerId,
      status: { $ne: "draft" },
    };

    if (req.query.status) {
      if (req.query.status === "draft") {
        return res.json({ data: [], meta: buildMeta(page, limit, 0) });
      }
      filter.status = req.query.status;
    }
    if (req.query.unpaid === "true") {
      filter.status = "confirmed";
      filter.balance = { $gt: 0 };
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Invoice.countDocuments(filter),
    ]);

    const subIds = invoices.map((i) => i.subscriptionId);
    const subs = await Subscription.find({ _id: { $in: subIds } }, { number: 1 }).lean();
    const subMap = new Map(subs.map((s) => [String(s._id), s]));

    const data = invoices.map((inv) => {
      const s = subMap.get(String(inv.subscriptionId));
      const { isOverdue, daysOverdue } = computeOverdueInfo(inv, today);
      return {
        id: String(inv._id),
        number: inv.number,
        subscription: s ? { id: String(s._id), number: s.number } : null,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        total: inv.total,
        amountPaid: inv.amountPaid,
        balance: inv.balance,
        status: inv.status,
        isOverdue,
        daysOverdue,
      };
    });

    return res.json({ data, meta: buildMeta(page, limit, total) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/portal/invoices/:id
router.get("/invoices/:id", async (req, res, next) => {
  try {
    const inv = await Invoice.findOne({
      _id: req.params.id,
      customerId: req.user.customerId,
      status: { $ne: "draft" },
    });
    // Return 404 NOT_FOUND for another customer's invoice or a draft (Page 44 & 54)
    if (!inv) throw Errors.notFound();

    const detail = await formatInvoiceDetail(inv, "customer");
    return res.json({ data: stripStaffFieldsFromInv(detail) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
