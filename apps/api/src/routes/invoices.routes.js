const express = require("express");
const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const Subscription = require("../models/Subscription");
const Customer = require("../models/Customer");
const Payment = require("../models/Payment");
const User = require("../models/User");
const { Discount } = require("../models/Discount");
const BillingRun = require("../models/BillingRun");
const { executeBillingRun } = require("../services/billing");
const { sendInvoice } = require("../services/mailer");
const env = require("../config/env");
const { authenticate, requireRole } = require("../middleware/auth");
const { Errors } = require("../utils/errors");
const { escapeRegex } = require("../utils/validators");
const { todayIST, daysBetween, isValidDateString } = require("../utils/date");
const { parsePagination, buildMeta } = require("../utils/pagination");

const router = express.Router();

function computeOverdueInfo(inv, today = todayIST()) {
  const isOverdue =
    inv.status === "confirmed" &&
    (inv.balance || 0) > 0 &&
    inv.dueDate < today;
  const daysOverdue = isOverdue ? Math.max(0, daysBetween(today, inv.dueDate)) : 0;
  return { isOverdue, daysOverdue };
}

function computeInvoiceAllowedActions(inv, userRole) {
  if (userRole === "customer") return [];
  if (userRole === "finance") {
    const actions = [];
    if (["confirmed", "paid"].includes(inv.status)) actions.push("send");
    if (inv.status === "confirmed" && inv.balance > 0) actions.push("recordPayment");
    return actions;
  }

  // admin & staff
  const actions = [];
  if (inv.status === "draft") {
    actions.push("edit", "confirm", "cancel");
  } else if (inv.status === "confirmed") {
    actions.push("send");
    if ((inv.balance || 0) > 0) actions.push("recordPayment");
    if ((inv.amountPaid || 0) === 0) actions.push("cancel");
  } else if (inv.status === "paid") {
    actions.push("send");
  }
  return actions;
}

async function formatInvoiceDetail(inv, userRole = "admin") {
  const today = todayIST();
  const [sub, customer, payments] = await Promise.all([
    Subscription.findById(inv.subscriptionId, { number: 1 }).lean(),
    Customer.findById(inv.customerId, { name: 1, email: 1 }).lean(),
    Payment.find({ invoiceId: inv._id }).sort({ paymentDate: -1, createdAt: -1 }).lean(),
  ]);

  const recorderIds = payments.map((p) => p.recordedBy).filter(Boolean);
  const recorders = await User.find({ _id: { $in: recorderIds } }, { name: 1 }).lean();
  const recMap = new Map(recorders.map((u) => [String(u._id), u.name]));

  const { isOverdue, daysOverdue } = computeOverdueInfo(inv, today);
  const obj = inv.toJSON ? inv.toJSON() : { ...inv };

  return {
    id: String(inv._id),
    number: inv.number,
    status: inv.status,
    subscription: sub ? { id: String(sub._id), number: sub.number } : null,
    customer: customer ? { id: String(customer._id), name: customer.name } : null,
    customerSnapshot: inv.customerSnapshot,
    company: env.COMPANY,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    lines: obj.lines,
    orderDiscount: obj.orderDiscount || null,
    untaxedAmount: inv.untaxedAmount,
    discountTotal: inv.discountTotal,
    taxTotal: inv.taxTotal,
    total: inv.total,
    amountPaid: inv.amountPaid,
    balance: inv.balance,
    isOverdue,
    daysOverdue,
    payments: payments.map((p) => ({
      id: String(p._id),
      method: p.method,
      amount: p.amount,
      paymentDate: p.paymentDate,
      note: p.note || "",
      recordedBy: {
        id: String(p.recordedBy),
        name: recMap.get(String(p.recordedBy)) || "Staff",
      },
    })),
    allowedActions: computeInvoiceAllowedActions(inv, userRole),
    notes: inv.notes || "",
    sentAt: inv.sentAt ? inv.sentAt.toISOString() : null,
    sentCount: inv.sentCount || 0,
    confirmedAt: inv.confirmedAt ? inv.confirmedAt.toISOString() : null,
    paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
    cancelledAt: inv.cancelledAt ? inv.cancelledAt.toISOString() : null,
    createdBy: inv.createdBy ? String(inv.createdBy) : "system",
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

// ==========================================
// BILLING RUN ENDPOINTS (/api/v1/billing/*)
// ==========================================

router.post(
  "/billing/run",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const { asOfDate = todayIST(), dryRun = false } = req.body || {};

      // Finance role is allowed dryRun: true only (Page 35)
      if (req.user.role === "finance" && !dryRun) {
        throw Errors.forbidden("Finance role can only preview billing runs (dryRun: true)");
      }

      if (!isValidDateString(asOfDate)) {
        throw Errors.validation("Some fields are invalid", [
          { field: "asOfDate", message: "asOfDate must be YYYY-MM-DD" },
        ]);
      }

      const result = await executeBillingRun({
        asOfDate,
        dryRun: Boolean(dryRun),
        createdBy: req.user._id,
      });

      return res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/billing/last-run",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const last = await BillingRun.findOne().sort({ createdAt: -1 });
      return res.json({ data: last ? last.toJSON() : null });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// INVOICES ENDPOINTS (/api/v1/invoices)
// ==========================================

router.get(
  "/invoices",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const { page, limit, skip, sort } = parsePagination(req.query);
      const today = todayIST();
      const baseFilter = {};

      if (req.query.customerId) {
        if (!mongoose.isValidObjectId(req.query.customerId)) {
          throw Errors.validation("Some fields are invalid", [
            { field: "customerId", message: "Invalid customerId" },
          ]);
        }
        baseFilter.customerId = new mongoose.Types.ObjectId(String(req.query.customerId));
      }
      if (req.query.subscriptionId) {
        if (!mongoose.isValidObjectId(req.query.subscriptionId)) {
          throw Errors.validation("Some fields are invalid", [
            { field: "subscriptionId", message: "Invalid subscriptionId" },
          ]);
        }
        baseFilter.subscriptionId = new mongoose.Types.ObjectId(String(req.query.subscriptionId));
      }

      if (req.query.invoiceFrom || req.query.invoiceTo) {
        baseFilter.invoiceDate = {};
        if (req.query.invoiceFrom) baseFilter.invoiceDate.$gte = req.query.invoiceFrom;
        if (req.query.invoiceTo) baseFilter.invoiceDate.$lte = req.query.invoiceTo;
      }

      if (req.query.dueFrom || req.query.dueTo) {
        baseFilter.dueDate = {};
        if (req.query.dueFrom) baseFilter.dueDate.$gte = req.query.dueFrom;
        if (req.query.dueTo) baseFilter.dueDate.$lte = req.query.dueTo;
      }

      if (req.query.search) {
        const rx = new RegExp(escapeRegex(req.query.search.trim()), "i");
        const matchingCustomers = await Customer.find({ name: rx }, { _id: 1 }).lean();
        baseFilter.$or = [
          { number: rx },
          { customerId: { $in: matchingCustomers.map((c) => c._id) } },
        ];
      }

      const listFilter = { ...baseFilter };
      if (req.query.status) {
        listFilter.status = req.query.status;
      }
      if (req.query.overdue === "true") {
        listFilter.status = "confirmed";
        listFilter.balance = { $gt: 0 };
        listFilter.dueDate = { ...(listFilter.dueDate || {}), $lt: today };
      }

      const [invoices, total, statusAgg, overdueCount] = await Promise.all([
        Invoice.find(listFilter).sort(sort).skip(skip).limit(limit).lean(),
        Invoice.countDocuments(listFilter),
        Invoice.aggregate([
          { $match: baseFilter },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Invoice.countDocuments({
          ...baseFilter,
          status: "confirmed",
          balance: { $gt: 0 },
          dueDate: { $lt: today },
        }),
      ]);

      const statusCounts = {
        draft: 0,
        confirmed: 0,
        paid: 0,
        cancelled: 0,
        overdue: overdueCount,
      };
      for (const s of statusAgg) {
        if (statusCounts[s._id] !== undefined) {
          statusCounts[s._id] = s.count;
        }
      }

      const custIds = invoices.map((i) => i.customerId);
      const subIds = invoices.map((i) => i.subscriptionId);
      const [customers, subs] = await Promise.all([
        Customer.find({ _id: { $in: custIds } }, { name: 1 }).lean(),
        Subscription.find({ _id: { $in: subIds } }, { number: 1 }).lean(),
      ]);
      const custMap = new Map(customers.map((c) => [String(c._id), c]));
      const subMap = new Map(subs.map((s) => [String(s._id), s]));

      const data = invoices.map((inv) => {
        const c = custMap.get(String(inv.customerId));
        const s = subMap.get(String(inv.subscriptionId));
        const { isOverdue, daysOverdue } = computeOverdueInfo(inv, today);
        return {
          id: String(inv._id),
          number: inv.number,
          customer: c ? { id: String(c._id), name: c.name } : null,
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

      return res.json({
        data,
        meta: buildMeta(page, limit, total, { statusCounts }),
      });
    } catch (err) {
      next(err);
    }
  }
);

// Helper for confirming an invoice
async function confirmSingleInvoice(inv) {
  if (inv.status !== "draft") {
    throw Errors.invalidTransition("Only Draft invoices can be confirmed");
  }
  inv.status = "confirmed";
  inv.confirmedAt = new Date();
  await inv.save();
  return inv;
}

// Helper for sending an invoice email
async function sendSingleInvoice(inv) {
  if (!["confirmed", "paid"].includes(inv.status)) {
    throw Errors.invalidTransition("Only Confirmed or Paid invoices can be sent");
  }
  const customer = await Customer.findById(inv.customerId);
  if (!customer || !customer.email) {
    throw Errors.validation("Customer does not have an email address");
  }

  await sendInvoice({
    toEmail: customer.email,
    toName: customer.name,
    invoiceNumber: inv.number,
    totalPaise: inv.total,
    balancePaise: inv.balance,
    dueDate: inv.dueDate,
  });

  inv.sentAt = new Date();
  inv.sentCount = (inv.sentCount || 0) + 1;
  await inv.save();
  return inv;
}

// POST /api/v1/invoices/bulk/confirm
router.post(
  "/invoices/bulk/confirm",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const { ids = [] } = req.body || {};
      const succeeded = [];
      const failed = [];

      for (const id of ids) {
        try {
          const inv = await Invoice.findById(id);
          if (!inv) {
            failed.push({ id: String(id), code: "NOT_FOUND", message: "Invoice not found" });
            continue;
          }
          await confirmSingleInvoice(inv);
          succeeded.push(String(inv._id));
        } catch (err) {
          failed.push({
            id: String(id),
            code: err.code || "INVALID_TRANSITION",
            message: err.message,
          });
        }
      }

      return res.json({ data: { succeeded, failed } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/invoices/bulk/send
router.post(
  "/invoices/bulk/send",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const { ids = [] } = req.body || {};
      const succeeded = [];
      const failed = [];

      for (const id of ids) {
        try {
          const inv = await Invoice.findById(id);
          if (!inv) {
            failed.push({ id: String(id), code: "NOT_FOUND", message: "Invoice not found" });
            continue;
          }
          await sendSingleInvoice(inv);
          succeeded.push(String(inv._id));
        } catch (err) {
          failed.push({
            id: String(id),
            code: err.code || "INVALID_TRANSITION",
            message: err.message,
          });
        }
      }

      return res.json({ data: { succeeded, failed } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/invoices/:id
router.get(
  "/invoices/:id",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const inv = await Invoice.findById(req.params.id);
      if (!inv) throw Errors.notFound();
      return res.json({ data: await formatInvoiceDetail(inv, req.user.role) });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/invoices/:id (Draft only: invoiceDate, dueDate, notes)
router.patch(
  "/invoices/:id",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      if (req.body && req.body.status !== undefined) {
        throw Errors.validation(
          "Status changes are only allowed through action endpoints",
          [{ field: "status", message: "Status cannot be changed via PATCH" }]
        );
      }

      const inv = await Invoice.findById(req.params.id);
      if (!inv) throw Errors.notFound();

      if (inv.status !== "draft") {
        throw Errors.notEditable("Only Draft invoices can be edited");
      }

      const { invoiceDate, dueDate, notes } = req.body || {};
      if (invoiceDate !== undefined) {
        if (!isValidDateString(invoiceDate)) {
          throw Errors.validation("Some fields are invalid", [
            { field: "invoiceDate", message: "invoiceDate must be YYYY-MM-DD" },
          ]);
        }
        inv.invoiceDate = invoiceDate;
      }
      if (dueDate !== undefined) {
        if (!isValidDateString(dueDate)) {
          throw Errors.validation("Some fields are invalid", [
            { field: "dueDate", message: "dueDate must be YYYY-MM-DD" },
          ]);
        }
        inv.dueDate = dueDate;
      }
      if (notes !== undefined) inv.notes = notes;

      await inv.save();
      return res.json({ data: await formatInvoiceDetail(inv, req.user.role) });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/invoices/:id/confirm
router.post(
  "/invoices/:id/confirm",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const inv = await Invoice.findById(req.params.id);
      if (!inv) throw Errors.notFound();
      await confirmSingleInvoice(inv);
      return res.json({ data: await formatInvoiceDetail(inv, req.user.role) });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/invoices/:id/cancel (Page 37)
router.post(
  "/invoices/:id/cancel",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const inv = await Invoice.findById(req.params.id);
      if (!inv) throw Errors.notFound();

      if (!["draft", "confirmed"].includes(inv.status)) {
        throw Errors.invalidTransition("Only Draft or Confirmed invoices can be cancelled");
      }
      if ((inv.amountPaid || 0) > 0) {
        throw Errors.hasPayments();
      }

      const rebill = req.body?.rebill !== undefined ? Boolean(req.body.rebill) : true;

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          inv.status = "cancelled";
          inv.isVoid = true;
          inv.cancelledAt = new Date();
          inv.balance = 0;
          await inv.save({ session });

          // Release reserved discount uses (Page 37 & 46)
          if (inv.appliedDiscountIds && inv.appliedDiscountIds.length > 0) {
            await Discount.updateMany(
              { _id: { $in: inv.appliedDiscountIds }, usedCount: { $gt: 0 } },
              { $inc: { usedCount: -1 } },
              { session }
            );
          }

          // If this was the subscription's latest invoice and rebill is true, rewind nextInvoiceDate
          if (rebill) {
            const latestActiveInv = await Invoice.findOne(
              { subscriptionId: inv.subscriptionId, isVoid: false },
              null,
              { session, sort: { periodStart: -1 } }
            );

            const isLatest =
              !latestActiveInv || latestActiveInv.periodStart < inv.periodStart;

            if (isLatest) {
              await Subscription.updateOne(
                { _id: inv.subscriptionId },
                { $set: { nextInvoiceDate: inv.periodStart } },
                { session }
              );
            }
          }
        });
      } finally {
        await session.endSession();
      }

      return res.json({ data: await formatInvoiceDetail(inv, req.user.role) });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/invoices/:id/send
router.post(
  "/invoices/:id/send",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const inv = await Invoice.findById(req.params.id);
      if (!inv) throw Errors.notFound();
      await sendSingleInvoice(inv);
      return res.json({ data: await formatInvoiceDetail(inv, req.user.role) });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = {
  router,
  formatInvoiceDetail,
  computeOverdueInfo,
};
