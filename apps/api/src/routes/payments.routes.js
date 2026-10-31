const express = require("express");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Invoice = require("../models/Invoice");
const Customer = require("../models/Customer");
const User = require("../models/User");
const { authenticate, requireRole } = require("../middleware/auth");
const { Errors } = require("../utils/errors");
const { assertIntegerPaise } = require("../utils/validators");
const { todayIST, isValidDateString } = require("../utils/date");
const { parsePagination, buildMeta } = require("../utils/pagination");

const router = express.Router();

const VALID_METHODS = ["bank_transfer", "card", "cash", "cheque", "upi", "other"];

async function enrichPayments(payments) {
  if (payments.length === 0) return [];

  const invIds = payments.map((p) => p.invoiceId);
  const custIds = payments.map((p) => p.customerId);
  const userIds = payments.map((p) => p.recordedBy);

  const [invoices, customers, users] = await Promise.all([
    Invoice.find({ _id: { $in: invIds } }, { number: 1 }).lean(),
    Customer.find({ _id: { $in: custIds } }, { name: 1 }).lean(),
    User.find({ _id: { $in: userIds } }, { name: 1 }).lean(),
  ]);

  const invMap = new Map(invoices.map((i) => [String(i._id), i]));
  const custMap = new Map(customers.map((c) => [String(c._id), c]));
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  return payments.map((p) => {
    const inv = invMap.get(String(p.invoiceId));
    const cust = custMap.get(String(p.customerId));
    const usr = userMap.get(String(p.recordedBy));

    return {
      id: String(p._id),
      invoice: inv ? { id: String(inv._id), number: inv.number } : null,
      customer: cust ? { id: String(cust._id), name: cust.name } : null,
      method: p.method,
      amount: p.amount,
      paymentDate: p.paymentDate,
      note: p.note || "",
      recordedBy: usr ? { id: String(usr._id), name: usr.name } : null,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    };
  });
}

// GET /api/v1/payments
router.get(
  "/",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const { page, limit, skip, sort } = parsePagination(req.query, "-paymentDate");
      const filter = {};

      if (req.query.invoiceId) filter.invoiceId = req.query.invoiceId;
      if (req.query.customerId) filter.customerId = req.query.customerId;
      if (req.query.method) filter.method = req.query.method;
      if (req.query.dateFrom || req.query.dateTo) {
        filter.paymentDate = {};
        if (req.query.dateFrom) filter.paymentDate.$gte = req.query.dateFrom;
        if (req.query.dateTo) filter.paymentDate.$lte = req.query.dateTo;
      }

      if (req.query.search) {
        const rx = new RegExp(req.query.search.trim(), "i");
        const [matchingInvs, matchingCusts] = await Promise.all([
          Invoice.find({ number: rx }, { _id: 1 }).lean(),
          Customer.find({ name: rx }, { _id: 1 }).lean(),
        ]);
        filter.$or = [
          { invoiceId: { $in: matchingInvs.map((i) => i._id) } },
          { customerId: { $in: matchingCusts.map((c) => c._id) } },
        ];
      }

      const [payments, total, sumAgg] = await Promise.all([
        Payment.find(filter).sort(sort).skip(skip).limit(limit).lean(),
        Payment.countDocuments(filter),
        Payment.aggregate([
          { $match: filter },
          { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
        ]),
      ]);

      const totalAmount = sumAgg[0] ? sumAgg[0].totalAmount : 0;
      const data = await enrichPayments(payments);

      return res.json({
        data,
        meta: buildMeta(page, limit, total, { totalAmount }),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/payments (Page 39-40)
router.post(
  "/",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const {
        invoiceId,
        method,
        amount,
        paymentDate = todayIST(),
        note = "",
      } = req.body || {};

      if (!invoiceId || !mongoose.isValidObjectId(invoiceId)) {
        throw Errors.validation("Some fields are invalid", [
          { field: "invoiceId", message: "Valid invoiceId is required" },
        ]);
      }
      if (!VALID_METHODS.includes(method)) {
        throw Errors.validation("Some fields are invalid", [
          { field: "method", message: "Invalid payment method" },
        ]);
      }
      assertIntegerPaise(amount, "amount", false, 1);

      const today = todayIST();
      if (!isValidDateString(paymentDate) || paymentDate > today) {
        throw Errors.validation("Some fields are invalid", [
          {
            field: "paymentDate",
            message: "paymentDate must be YYYY-MM-DD and cannot be in the future",
          },
        ]);
      }

      const checkInv = await Invoice.findById(invoiceId);
      if (!checkInv) throw Errors.notFound("Invoice not found");

      if (checkInv.status !== "confirmed") {
        throw Errors.invalidTransition(
          "Payments can only be recorded against Confirmed invoices"
        );
      }
      if (amount > checkInv.balance) {
        throw Errors.overpayment();
      }

      let createdPayment = null;
      let updatedInvoice = null;

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // Conditional atomic update prevents race-condition double payment / overpayment
          const inv = await Invoice.findOneAndUpdate(
            {
              _id: checkInv._id,
              status: "confirmed",
              balance: { $gte: amount },
            },
            {
              $inc: { amountPaid: amount, balance: -amount },
            },
            { session, new: true }
          );

          if (!inv) {
            throw Errors.overpayment();
          }

          if (inv.balance === 0) {
            inv.status = "paid";
            inv.paidAt = new Date();
            await inv.save({ session });
          }

          const [pay] = await Payment.create(
            [
              {
                invoiceId: inv._id,
                customerId: inv.customerId,
                subscriptionId: inv.subscriptionId,
                method,
                amount,
                paymentDate,
                note,
                recordedBy: req.user._id,
              },
            ],
            { session }
          );

          createdPayment = pay;
          updatedInvoice = inv;
        });
      } finally {
        await session.endSession();
      }

      const [enrichedPayment] = await enrichPayments([createdPayment]);
      return res.status(201).json({
        data: {
          payment: enrichedPayment,
          invoice: {
            id: String(updatedInvoice._id),
            number: updatedInvoice.number,
            status: updatedInvoice.status,
            amountPaid: updatedInvoice.amountPaid,
            balance: updatedInvoice.balance,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/payments/:id
router.get(
  "/:id",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const payment = await Payment.findById(req.params.id).lean();
      if (!payment) throw Errors.notFound();
      const [enriched] = await enrichPayments([payment]);
      return res.json({ data: enriched });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/payments/:id (Admin only: reverse a mistaken payment in one transaction)
router.delete(
  "/:id",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const payment = await Payment.findById(req.params.id);
      if (!payment) throw Errors.notFound();

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const inv = await Invoice.findById(payment.invoiceId).session(session);
          if (inv) {
            inv.amountPaid = Math.max(0, inv.amountPaid - payment.amount);
            inv.balance = inv.total - inv.amountPaid;
            if (inv.status === "paid" && inv.balance > 0) {
              inv.status = "confirmed";
              inv.paidAt = null;
            }
            await inv.save({ session });
          }
          await payment.deleteOne({ session });
        });
      } finally {
        await session.endSession();
      }

      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
