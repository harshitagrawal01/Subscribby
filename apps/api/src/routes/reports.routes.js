const express = require("express");
const mongoose = require("mongoose");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const Plan = require("../models/Plan");
const Customer = require("../models/Customer");
const { authenticate, requireRole } = require("../middleware/auth");
const { Errors } = require("../utils/errors");
const { todayIST, daysBetween } = require("../utils/date");

const router = express.Router();

router.use(authenticate, requireRole("admin", "staff", "finance"));

function defaultMonthRange() {
  const today = todayIST();
  const ym = today.slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    from: `${ym}-01`,
    to: `${ym}-${String(lastDay).padStart(2, "0")}`,
  };
}

function scaleToMonthlyMRR(recurringNet, billingPeriod) {
  switch (billingPeriod) {
    case "daily":
      return Math.round((recurringNet * 365) / 12);
    case "weekly":
      return Math.round((recurringNet * 52) / 12);
    case "monthly":
      return recurringNet;
    case "yearly":
      return Math.round(recurringNet / 12);
    default:
      return recurringNet;
  }
}

// GET /api/v1/reports/summary (Page 41-42)
router.get("/summary", async (req, res, next) => {
  try {
    const def = defaultMonthRange();
    const from = req.query.from || def.from;
    const to = req.query.to || def.to;
    const today = todayIST();

    const subBase = {};
    const invBase = {};
    const payBase = {};

    if (req.query.customerId) {
      const cid = new mongoose.Types.ObjectId(String(req.query.customerId));
      subBase.customerId = cid;
      invBase.customerId = cid;
      payBase.customerId = cid;
    }

    let planSubIds = null;
    if (req.query.planId) {
      const pid = new mongoose.Types.ObjectId(String(req.query.planId));
      subBase.planId = pid;
      const subsForPlan = await Subscription.find({ planId: pid }, { _id: 1 }).lean();
      planSubIds = subsForPlan.map((s) => s._id);
      invBase.subscriptionId = { $in: planSubIds };
      payBase.subscriptionId = { $in: planSubIds };
    }

    const fromDateObj = new Date(`${from}T00:00:00.000Z`);
    const toDateObj = new Date(`${to}T23:59:59.999Z`);

    const [
      activeSubsByPlan,
      newSubscriptions,
      closedSubscriptions,
      payAgg,
      invoicedAgg,
      outstandingAgg,
    ] = await Promise.all([
      Subscription.aggregate([
        { $match: { ...subBase, status: "active" } },
        {
          $group: {
            _id: "$planId",
            count: { $sum: 1 },
            netSum: { $sum: "$recurringNet" },
          },
        },
      ]),
      Subscription.countDocuments({
        ...subBase,
        startDate: { $gte: from, $lte: to },
        $or: [
          { status: { $in: ["active", "paused"] } },
          {
            status: "closed",
            closeReason: { $in: ["expired", "closed_early"] },
          },
        ],
      }),
      Subscription.countDocuments({
        ...subBase,
        status: "closed",
        closeReason: { $in: ["expired", "closed_early"] },
        closedAt: { $gte: fromDateObj, $lte: toDateObj },
      }),
      Payment.aggregate([
        {
          $match: {
            ...payBase,
            paymentDate: { $gte: from, $lte: to },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Invoice.aggregate([
        {
          $match: {
            ...invBase,
            status: { $in: ["confirmed", "paid"] },
            invoiceDate: { $gte: from, $lte: to },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Invoice.aggregate([
        {
          $match: {
            ...invBase,
            status: "confirmed",
            balance: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            outstandingAmount: { $sum: "$balance" },
            overdueAmount: {
              $sum: {
                $cond: [{ $lt: ["$dueDate", today] }, "$balance", 0],
              },
            },
            overdueCount: {
              $sum: {
                $cond: [{ $lt: ["$dueDate", today] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    const plans = await Plan.find({}, { billingPeriod: 1 }).lean();
    const planPeriodMap = new Map(plans.map((p) => [String(p._id), p.billingPeriod]));

    let activeSubscriptions = 0;
    let mrr = 0;
    for (const row of activeSubsByPlan) {
      activeSubscriptions += row.count;
      const bp = planPeriodMap.get(String(row._id)) || "monthly";
      mrr += scaleToMonthlyMRR(row.netSum || 0, bp);
    }

    const out = outstandingAgg[0] || {};

    return res.json({
      data: {
        range: { from, to },
        activeSubscriptions,
        newSubscriptions,
        closedSubscriptions,
        mrr,
        revenueCollected: payAgg[0] ? payAgg[0].total : 0,
        invoicedAmount: invoicedAgg[0] ? invoicedAgg[0].total : 0,
        outstandingAmount: out.outstandingAmount || 0,
        overdueAmount: out.overdueAmount || 0,
        overdueCount: out.overdueCount || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/revenue-by-month (Page 42)
router.get("/revenue-by-month", async (req, res, next) => {
  try {
    const today = todayIST();
    const currentYm = today.slice(0, 7);
    const [cy, cm] = currentYm.split("-").map(Number);
    const defaultFromDate = new Date(cy, cm - 6, 1);
    const defaultFrom = `${defaultFromDate.getFullYear()}-${String(
      defaultFromDate.getMonth() + 1
    ).padStart(2, "0")}`;

    const fromMonth = (req.query.from || defaultFrom).slice(0, 7);
    const toMonth = (req.query.to || currentYm).slice(0, 7);

    // Build month list (at most 24 months)
    const months = [];
    let [y, m] = fromMonth.split("-").map(Number);
    const [endY, endM] = toMonth.split("-").map(Number);

    while ((y < endY || (y === endY && m <= endM)) && months.length < 24) {
      months.push(`${y}-${String(m).padStart(2, "0")}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }

    const startStr = `${months[0] || fromMonth}-01`;
    const lastYm = months[months.length - 1] || toMonth;
    const endStr = `${lastYm}-31`;

    const invMatch = {
      status: { $in: ["confirmed", "paid"] },
      invoiceDate: { $gte: startStr, $lte: endStr },
    };
    const payMatch = {
      paymentDate: { $gte: startStr, $lte: endStr },
    };

    if (req.query.customerId) {
      const cid = new mongoose.Types.ObjectId(String(req.query.customerId));
      invMatch.customerId = cid;
      payMatch.customerId = cid;
    }

    const [invAgg, payAgg] = await Promise.all([
      Invoice.aggregate([
        { $match: invMatch },
        {
          $group: {
            _id: { $substr: ["$invoiceDate", 0, 7] },
            invoiced: { $sum: "$total" },
          },
        },
      ]),
      Payment.aggregate([
        { $match: payMatch },
        {
          $group: {
            _id: { $substr: ["$paymentDate", 0, 7] },
            collected: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    const invMap = new Map(invAgg.map((i) => [i._id, i.invoiced]));
    const payMap = new Map(payAgg.map((p) => [p._id, p.collected]));

    const data = months.map((month) => ({
      month,
      invoiced: invMap.get(month) || 0,
      collected: payMap.get(month) || 0,
    }));

    return res.json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/subscriptions-by-plan (Page 42)
router.get("/subscriptions-by-plan", async (req, res, next) => {
  try {
    const match = { status: "active" };
    if (req.query.customerId) {
      match.customerId = new mongoose.Types.ObjectId(String(req.query.customerId));
    }
    if (req.query.planId) {
      match.planId = new mongoose.Types.ObjectId(String(req.query.planId));
    }

    const [agg, plans] = await Promise.all([
      Subscription.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$planId",
            count: { $sum: 1 },
            netSum: { $sum: "$recurringNet" },
          },
        },
      ]),
      Plan.find({}, { name: 1, billingPeriod: 1 }).lean(),
    ]);

    const planMap = new Map(plans.map((p) => [String(p._id), p]));

    const data = agg.map((row) => {
      const p = planMap.get(String(row._id));
      const bp = p ? p.billingPeriod : "monthly";
      return {
        plan: {
          id: String(row._id),
          name: p ? p.name : "Plan",
        },
        count: row.count,
        mrr: scaleToMonthlyMRR(row.netSum || 0, bp),
      };
    });

    return res.json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/aging (Page 42)
router.get("/aging", async (req, res, next) => {
  try {
    const today = todayIST();
    const match = {
      status: "confirmed",
      balance: { $gt: 0 },
    };
    if (req.query.customerId) {
      match.customerId = new mongoose.Types.ObjectId(String(req.query.customerId));
    }

    const unpaidInvoices = await Invoice.find(match, {
      dueDate: 1,
      balance: 1,
    }).lean();

    const buckets = {
      current: { bucket: "current", count: 0, amount: 0 },
      "1-30": { bucket: "1-30", count: 0, amount: 0 },
      "31-60": { bucket: "31-60", count: 0, amount: 0 },
      "61-90": { bucket: "61-90", count: 0, amount: 0 },
      "90+": { bucket: "90+", count: 0, amount: 0 },
    };

    for (const inv of unpaidInvoices) {
      if (inv.dueDate >= today) {
        buckets.current.count += 1;
        buckets.current.amount += inv.balance;
      } else {
        const days = daysBetween(today, inv.dueDate);
        if (days <= 30) {
          buckets["1-30"].count += 1;
          buckets["1-30"].amount += inv.balance;
        } else if (days <= 60) {
          buckets["31-60"].count += 1;
          buckets["31-60"].amount += inv.balance;
        } else if (days <= 90) {
          buckets["61-90"].count += 1;
          buckets["61-90"].amount += inv.balance;
        } else {
          buckets["90+"].count += 1;
          buckets["90+"].amount += inv.balance;
        }
      }
    }

    return res.json({
      data: Object.values(buckets),
    });
  } catch (err) {
    next(err);
  }
});

function escapeCsvCell(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function paiseToRupeesCsv(paise) {
  return ((paise || 0) / 100).toFixed(2);
}

// GET /api/v1/reports/export?type=invoices|payments|subscriptions (Page 43)
router.get("/export", async (req, res, next) => {
  try {
    const type = req.query.type || "invoices";
    if (!["invoices", "payments", "subscriptions"].includes(type)) {
      throw Errors.validation("type must be invoices, payments or subscriptions");
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${type}-export.csv"`
    );

    if (type === "invoices") {
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      if (req.query.customerId) filter.customerId = req.query.customerId;
      const invoices = await Invoice.find(filter)
        .sort({ invoiceDate: -1 })
        .limit(5000)
        .lean();
      const custIds = invoices.map((i) => i.customerId);
      const custs = await Customer.find({ _id: { $in: custIds } }, { name: 1 }).lean();
      const custMap = new Map(custs.map((c) => [String(c._id), c.name]));

      const lines = [
        "number,customer,invoiceDate,dueDate,status,totalINR,amountPaidINR,balanceINR",
      ];
      for (const inv of invoices) {
        lines.push(
          [
            inv.number,
            escapeCsvCell(custMap.get(String(inv.customerId)) || ""),
            inv.invoiceDate,
            inv.dueDate,
            inv.status,
            paiseToRupeesCsv(inv.total),
            paiseToRupeesCsv(inv.amountPaid),
            paiseToRupeesCsv(inv.balance),
          ].join(",")
        );
      }
      return res.send(lines.join("\n") + "\n");
    }

    if (type === "payments") {
      const filter = {};
      if (req.query.method) filter.method = req.query.method;
      if (req.query.customerId) filter.customerId = req.query.customerId;
      const payments = await Payment.find(filter)
        .sort({ paymentDate: -1 })
        .limit(5000)
        .lean();
      const invIds = payments.map((p) => p.invoiceId);
      const custIds = payments.map((p) => p.customerId);
      const [invs, custs] = await Promise.all([
        Invoice.find({ _id: { $in: invIds } }, { number: 1 }).lean(),
        Customer.find({ _id: { $in: custIds } }, { name: 1 }).lean(),
      ]);
      const invMap = new Map(invs.map((i) => [String(i._id), i.number]));
      const custMap = new Map(custs.map((c) => [String(c._id), c.name]));

      const lines = ["invoiceNumber,customer,method,paymentDate,amountINR,note"];
      for (const p of payments) {
        lines.push(
          [
            invMap.get(String(p.invoiceId)) || "",
            escapeCsvCell(custMap.get(String(p.customerId)) || ""),
            p.method,
            p.paymentDate,
            paiseToRupeesCsv(p.amount),
            escapeCsvCell(p.note || ""),
          ].join(",")
        );
      }
      return res.send(lines.join("\n") + "\n");
    }

    // subscriptions
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.customerId) filter.customerId = req.query.customerId;
    const subs = await Subscription.find(filter)
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();
    const custIds = subs.map((s) => s.customerId);
    const planIds = subs.map((s) => s.planId);
    const [custs, plans] = await Promise.all([
      Customer.find({ _id: { $in: custIds } }, { name: 1 }).lean(),
      Plan.find({ _id: { $in: planIds } }, { name: 1 }).lean(),
    ]);
    const custMap = new Map(custs.map((c) => [String(c._id), c.name]));
    const planMap = new Map(plans.map((p) => [String(p._id), p.name]));

    const lines = [
      "number,customer,plan,status,startDate,expiryDate,recurringTotalINR",
    ];
    for (const s of subs) {
      lines.push(
        [
          s.number,
          escapeCsvCell(custMap.get(String(s.customerId)) || ""),
          escapeCsvCell(planMap.get(String(s.planId)) || ""),
          s.status,
          s.startDate,
          s.expiryDate,
          paiseToRupeesCsv(s.recurringTotal),
        ].join(",")
      );
    }
    return res.send(lines.join("\n") + "\n");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
