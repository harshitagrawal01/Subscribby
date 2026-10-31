const express = require("express");
const mongoose = require("mongoose");
const Subscription = require("../models/Subscription");
const Customer = require("../models/Customer");
const Plan = require("../models/Plan");
const Product = require("../models/Product");
const QuotationTemplate = require("../models/QuotationTemplate");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const { nextSequenceNumber } = require("../models/Counter");
const { priceLines } = require("../services/pricing");
const { billSinglePeriod } = require("../services/billing");
const { sendQuotation } = require("../services/mailer");
const { authenticate, requireRole } = require("../middleware/auth");
const { Errors } = require("../utils/errors");
const { escapeRegex } = require("../utils/validators");
const {
  todayIST,
  isValidDateString,
  defaultExpiryDate,
  addDaysStr,
  computePeriodEnd,
  nextTermExpiry,
} = require("../utils/date");
const { parsePagination, buildMeta } = require("../utils/pagination");

const router = express.Router();

/**
 * Computes allowedActions on a subscription for the current user (Page 28, 32-33).
 * For a Finance user, allowedActions is always empty [].
 */
function computeAllowedActions(sub, plan, userRole, today = todayIST()) {
  if (userRole === "finance") return [];
  if (!["admin", "staff"].includes(userRole)) return [];

  const actions = [];
  const status = sub.status;
  const rules = (plan && plan.rules) || {};

  if (status === "draft") {
    actions.push("edit", "delete");
    if (sub.lines && sub.lines.length > 0) {
      actions.push("send");
    }
    actions.push("cancel");
  } else if (status === "quotation") {
    actions.push("edit");
    const isQuoteExpired =
      sub.quotationValidUntil && sub.quotationValidUntil < today;
    if (!isQuoteExpired) {
      actions.push("confirm");
    }
    actions.push("cancel");
  } else if (status === "confirmed") {
    actions.push("edit", "activate", "cancel");
  } else if (status === "active") {
    actions.push("edit");
    if (rules.pausable) actions.push("pause");
    if (rules.renewable) actions.push("renew");
    if (rules.closable || sub.expiryDate < today) actions.push("close");
    if (sub.nextInvoiceDate && sub.nextInvoiceDate <= sub.expiryDate) {
      actions.push("createInvoice");
    }
  } else if (status === "paused") {
    actions.push("edit", "resume");
    if (rules.renewable) actions.push("renew");
    if (rules.closable || sub.expiryDate < today) actions.push("close");
  }

  return actions;
}

/**
 * Resolves and validates raw lines input against plan and products, setting default unitPrice
 * when unitPrice is omitted or keeping existing line unitPrice when id matches (Page 30 & 45).
 */
async function buildAndValidateLines(
  plan,
  rawLines,
  allowUnitPriceOverride = true,
  existingLines = []
) {
  let linesInput = rawLines;
  if (!linesInput || (Array.isArray(linesInput) && linesInput.length === 0)) {
    linesInput = [
      {
        productId: String(plan.productId),
        variantId: null,
        quantity: plan.minQuantity,
      },
    ];
  }

  if (!Array.isArray(linesInput)) {
    throw Errors.validation("Some fields are invalid", [
      { field: "lines", message: "Must be a list of lines" },
    ]);
  }

  const existingMap = new Map(
    (existingLines || []).map((l) => [String(l._id || l.id), l])
  );

  const candidateProductIds = [];
  for (const item of linesInput) {
    if (item && typeof item === "object") {
      const prev =
        item.id || item._id ? existingMap.get(String(item.id || item._id)) : null;
      const pid = item.productId ?? (prev ? String(prev.productId) : null);
      if (pid && mongoose.isValidObjectId(pid)) {
        candidateProductIds.push(pid);
      }
    }
  }

  const products = await Product.find({ _id: { $in: candidateProductIds } });
  const prodMap = new Map(products.map((p) => [String(p._id), p]));

  const details = [];
  const builtLines = [];
  let planProductQty = 0;

  for (let i = 0; i < linesInput.length; i++) {
    const item = linesInput[i];
    const f = `lines[${i}]`;

    if (!item || typeof item !== "object") {
      details.push({ field: f, message: "Must be an object" });
      continue;
    }

    const rawLineId = item.id || item._id ? String(item.id || item._id) : null;
    const prev = rawLineId ? existingMap.get(rawLineId) : null;
    if (rawLineId && !prev) {
      details.push({
        field: `${f}.id`,
        message: "Line not found on this subscription",
      });
      continue;
    }

    const productId = item.productId ?? (prev ? String(prev.productId) : null);
    const prod = productId ? prodMap.get(String(productId)) : null;
    if (!prod) {
      details.push({ field: `${f}.productId`, message: "Product not found" });
      continue;
    }

    const changedItem = !prev || String(prev.productId) !== String(prod._id);
    if (changedItem && !prod.isActive) {
      details.push({ field: `${f}.productId`, message: "Product is archived" });
      continue;
    }

    const rawVariantId =
      item.variantId !== undefined
        ? item.variantId
        : changedItem
        ? null
        : prev.variantId;
    let variantId = null;
    let variantLabel = null;
    let extraPrice = 0;

    if (rawVariantId !== null && rawVariantId !== undefined) {
      const v = mongoose.isValidObjectId(rawVariantId)
        ? prod.variants.id(rawVariantId)
        : null;
      if (!v) {
        details.push({
          field: `${f}.variantId`,
          message: `Variant not found on product ${prod.name}`,
        });
        continue;
      }
      variantId = v._id;
      variantLabel = `${v.attribute}: ${v.value}`;
      extraPrice = v.extraPrice || 0;
    }

    const quantity = item.quantity !== undefined ? item.quantity : prev?.quantity;
    if (!Number.isInteger(quantity) || quantity < 1) {
      details.push({
        field: `${f}.quantity`,
        message: "Line quantity must be an integer >= 1",
      });
      continue;
    }

    const isPlanProduct = String(prod._id) === String(plan.productId);
    if (isPlanProduct) {
      planProductQty += quantity;
    }

    const sameItem =
      prev &&
      !changedItem &&
      String(prev.variantId || "") === String(variantId || "");
    const defaultUnitPrice =
      (isPlanProduct ? plan.price : prod.salesPrice) + extraPrice;

    let unitPrice;
    if (item.unitPrice !== undefined && item.unitPrice !== null) {
      if (!Number.isInteger(item.unitPrice) || item.unitPrice < 0) {
        details.push({
          field: `${f}.unitPrice`,
          message: "unitPrice must be an integer in paise >= 0",
        });
        continue;
      }
      if (allowUnitPriceOverride) {
        unitPrice = item.unitPrice;
      } else if (sameItem && item.unitPrice === prev.unitPrice) {
        unitPrice = prev.unitPrice;
      } else {
        throw Errors.notEditable(
          "Unit prices can only be changed while the subscription is a Draft or Quotation"
        );
      }
    } else {
      unitPrice = sameItem ? prev.unitPrice : defaultUnitPrice;
    }

    const lineDoc = {
      productId: prod._id,
      productName: sameItem ? prev.productName : prod.name,
      variantId,
      variantLabel: sameItem ? prev.variantLabel : variantLabel,
      quantity,
      unitPrice,
    };
    if (prev && prev._id) {
      lineDoc._id = prev._id;
    }
    builtLines.push(lineDoc);
  }

  if (details.length > 0) {
    throw Errors.validation("Some fields are invalid", details);
  }

  if (planProductQty === 0) {
    throw Errors.validation("Some fields are invalid", [
      {
        field: "lines",
        message: "Must include the plan's product",
      },
    ]);
  }

  if (planProductQty < plan.minQuantity) {
    throw Errors.belowMinQuantity(
      `Quantity for the plan's product must be at least ${plan.minQuantity}`
    );
  }

  return builtLines;
}

function validatePlanAvailability(plan, startDate) {
  if (!plan || !plan.isActive) {
    throw Errors.planNotAvailable("Plan is not active");
  }
  if (startDate < plan.availableFrom) {
    throw Errors.planNotAvailable(
      `Plan is only available from ${plan.availableFrom}`
    );
  }
  if (plan.availableUntil && startDate > plan.availableUntil) {
    throw Errors.planNotAvailable(
      `Plan availability ended on ${plan.availableUntil}`
    );
  }
}

/**
 * Formats full subscription detail response (Page 30-32).
 */
async function formatSubscriptionDetail(sub, userRole = "admin") {
  const today = todayIST();
  const [customer, plan, template, salesperson, priced, invoices] =
    await Promise.all([
      Customer.findById(sub.customerId).lean(),
      Plan.findById(sub.planId).lean(),
      sub.templateId ? QuotationTemplate.findById(sub.templateId).lean() : null,
      sub.salespersonId ? User.findById(sub.salespersonId).lean() : null,
      priceLines(sub, today),
      Invoice.find({ subscriptionId: sub._id, isVoid: false })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

  // Resolve actor names for history
  const actorIds = sub.history
    .map((h) => h.by)
    .filter((by) => by && by !== "system" && mongoose.isValidObjectId(by));
  const actors = await User.find({ _id: { $in: actorIds } }, { name: 1 }).lean();
  const actorMap = new Map(actors.map((a) => [String(a._id), a.name]));

  const historyFormatted = (sub.history || []).map((h) => ({
    at: h.at instanceof Date ? h.at.toISOString() : h.at,
    by:
      h.by === "system"
        ? { id: "system", name: "System" }
        : {
            id: String(h.by),
            name: actorMap.get(String(h.by)) || "User",
          },
    action: h.action,
    from: h.from,
    to: h.to,
    note: h.note || null,
  }));

  const outstandingAmount = invoices
    .filter((i) => i.status === "confirmed")
    .reduce((sum, i) => sum + (i.balance || 0), 0);
  const lastInv = invoices[0] || null;

  const isExpired =
    ["active", "paused"].includes(sub.status) && sub.expiryDate < today;

  return {
    id: String(sub._id),
    number: sub.number,
    status: sub.status,
    customer: customer
      ? {
          id: String(customer._id),
          name: customer.name,
          email: customer.email,
        }
      : null,
    plan: plan
      ? {
          id: String(plan._id),
          name: plan.name,
          billingPeriod: plan.billingPeriod,
          minQuantity: plan.minQuantity,
          rules: plan.rules,
        }
      : null,
    template: template
      ? { id: String(template._id), name: template.name }
      : null,
    salesperson: salesperson
      ? { id: String(salesperson._id), name: salesperson.name }
      : null,
    startDate: sub.startDate,
    expiryDate: sub.expiryDate,
    isExpired,
    quotationValidUntil: sub.quotationValidUntil || null,
    paymentTermDays: sub.paymentTermDays,
    nextInvoiceDate: sub.nextInvoiceDate || null,
    lines: priced.lines,
    orderDiscount: priced.orderDiscount,
    totals: priced.totals,
    recurringTotal: priced.recurringTotal,
    recurringNet: priced.recurringNet,
    allowedActions: computeAllowedActions(sub, plan, userRole, today),
    invoiceSummary: {
      count: invoices.length,
      outstandingAmount,
      lastInvoice: lastInv
        ? {
            id: String(lastInv._id),
            number: lastInv.number,
            status: lastInv.status,
          }
        : null,
    },
    history: historyFormatted,
    pausedAt: sub.pausedAt ? sub.pausedAt.toISOString() : null,
    closedAt: sub.closedAt ? sub.closedAt.toISOString() : null,
    closeReason: sub.closeReason || null,
    notes: sub.notes || "",
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  };
}

// GET /api/v1/subscriptions
router.get(
  "/",
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
      if (req.query.planId) {
        if (!mongoose.isValidObjectId(req.query.planId)) {
          throw Errors.validation("Some fields are invalid", [
            { field: "planId", message: "Invalid planId" },
          ]);
        }
        baseFilter.planId = new mongoose.Types.ObjectId(String(req.query.planId));
      }
      if (req.query.startFrom || req.query.startTo) {
        baseFilter.startDate = {};
        if (req.query.startFrom) baseFilter.startDate.$gte = req.query.startFrom;
        if (req.query.startTo) baseFilter.startDate.$lte = req.query.startTo;
      }
      if (req.query.expiringBefore) {
        baseFilter.expiryDate = { $lte: req.query.expiringBefore };
      }

      if (req.query.search) {
        const rx = new RegExp(escapeRegex(req.query.search.trim()), "i");
        const matchingCustomers = await Customer.find({ name: rx }, { _id: 1 }).lean();
        const custIds = matchingCustomers.map((c) => c._id);
        baseFilter.$or = [{ number: rx }, { customerId: { $in: custIds } }];
      }

      const listFilter = { ...baseFilter };
      if (req.query.status) {
        listFilter.status = req.query.status;
      }

      const [subs, total, statusAgg] = await Promise.all([
        Subscription.find(listFilter).sort(sort).skip(skip).limit(limit).lean(),
        Subscription.countDocuments(listFilter),
        Subscription.aggregate([
          { $match: baseFilter },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
      ]);

      const statusCounts = {
        draft: 0,
        quotation: 0,
        confirmed: 0,
        active: 0,
        paused: 0,
        closed: 0,
      };
      for (const s of statusAgg) {
        if (statusCounts[s._id] !== undefined) {
          statusCounts[s._id] = s.count;
        }
      }

      const custIds = subs.map((s) => s.customerId);
      const planIds = subs.map((s) => s.planId);
      const [customers, plans] = await Promise.all([
        Customer.find({ _id: { $in: custIds } }, { name: 1 }).lean(),
        Plan.find({ _id: { $in: planIds } }, { name: 1, billingPeriod: 1 }).lean(),
      ]);
      const custMap = new Map(customers.map((c) => [String(c._id), c]));
      const planMap = new Map(plans.map((p) => [String(p._id), p]));

      const data = subs.map((s) => {
        const c = custMap.get(String(s.customerId));
        const p = planMap.get(String(s.planId));
        const isExpired =
          ["active", "paused"].includes(s.status) && s.expiryDate < today;
        return {
          id: String(s._id),
          number: s.number,
          customer: c ? { id: String(c._id), name: c.name } : null,
          plan: p
            ? { id: String(p._id), name: p.name, billingPeriod: p.billingPeriod }
            : null,
          status: s.status,
          startDate: s.startDate,
          expiryDate: s.expiryDate,
          isExpired,
          quotationValidUntil: s.quotationValidUntil || null,
          nextInvoiceDate: s.nextInvoiceDate || null,
          recurringTotal: s.recurringTotal || 0,
          recurringNet: s.recurringNet || 0,
          closeReason: s.closeReason || null,
          createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null,
          updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
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

// POST /api/v1/subscriptions/preview
router.post(
  "/preview",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const { templateId, planId, startDate = todayIST(), lines } = req.body || {};

      let resolvedPlanId = planId;
      let resolvedLines = lines;

      if (templateId) {
        const tpl = await QuotationTemplate.findById(templateId);
        if (!tpl) throw Errors.notFound("Quotation template not found");
        resolvedPlanId = resolvedPlanId || tpl.planId;
        if (!resolvedLines) resolvedLines = tpl.lines;
      }

      const plan = await Plan.findById(resolvedPlanId);
      if (!plan) {
        throw Errors.validation("Some fields are invalid", [
          { field: "planId", message: "Valid planId is required" },
        ]);
      }

      const builtLines = await buildAndValidateLines(plan, resolvedLines, true);
      const priced = await priceLines({ lines: builtLines }, todayIST());

      return res.json({
        data: {
          lines: priced.lines,
          orderDiscount: priced.orderDiscount,
          totals: priced.totals,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/subscriptions
router.post(
  "/",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const {
        customerId,
        templateId = null,
        planId,
        startDate,
        expiryDate,
        paymentTermDays,
        salespersonId,
        notes,
        lines,
      } = req.body || {};

      const customer = await Customer.findById(customerId);
      if (!customer || !customer.isActive) {
        throw Errors.validation("Some fields are invalid", [
          { field: "customerId", message: "Valid active customerId is required" },
        ]);
      }

      let tpl = null;
      if (templateId) {
        tpl = await QuotationTemplate.findById(templateId);
        if (!tpl) throw Errors.notFound("Quotation template not found");
      }

      const finalPlanId = planId || (tpl ? tpl.planId : null);
      const plan = await Plan.findById(finalPlanId);
      if (!plan) {
        throw Errors.validation("Some fields are invalid", [
          { field: "planId", message: "Valid planId is required" },
        ]);
      }

      if (!isValidDateString(startDate)) {
        throw Errors.validation("Some fields are invalid", [
          { field: "startDate", message: "startDate (YYYY-MM-DD) is required" },
        ]);
      }

      validatePlanAvailability(plan, startDate);

      const finalExpiryDate = expiryDate || defaultExpiryDate(startDate);
      if (!isValidDateString(finalExpiryDate) || finalExpiryDate < startDate) {
        throw Errors.validation("Some fields are invalid", [
          { field: "expiryDate", message: "expiryDate must be on or after startDate" },
        ]);
      }

      const finalPaymentTerms =
        paymentTermDays !== undefined
          ? paymentTermDays
          : tpl
          ? tpl.paymentTermDays
          : 0;

      const rawLines = lines !== undefined ? lines : tpl ? tpl.lines : [];
      const builtLines = await buildAndValidateLines(plan, rawLines, true);
      const priced = await priceLines({ lines: builtLines }, todayIST());

      const year = parseInt(startDate.slice(0, 4), 10);
      const number = await nextSequenceNumber("SUB", year);

      const sub = await Subscription.create({
        number,
        customerId: customer._id,
        planId: plan._id,
        templateId: tpl ? tpl._id : null,
        salespersonId: salespersonId || req.user._id,
        status: "draft",
        startDate,
        expiryDate: finalExpiryDate,
        quotationValidUntil: null,
        paymentTermDays: finalPaymentTerms,
        lines: builtLines,
        nextInvoiceDate: null,
        recurringTotal: priced.recurringTotal,
        recurringNet: priced.recurringNet,
        notes: notes !== undefined ? notes : tpl ? tpl.notes : "",
        history: [
          {
            at: new Date(),
            by: req.user._id,
            action: "create",
            from: null,
            to: "draft",
            note: null,
          },
        ],
      });

      return res
        .status(201)
        .json({ data: await formatSubscriptionDetail(sub, req.user.role) });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/subscriptions/:id
router.get(
  "/:id",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const sub = await Subscription.findById(req.params.id);
      if (!sub) throw Errors.notFound();
      return res.json({
        data: await formatSubscriptionDetail(sub, req.user.role),
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/subscriptions/:id
router.patch(
  "/:id",
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

      const sub = await Subscription.findById(req.params.id);
      if (!sub) throw Errors.notFound();

      if (sub.status === "closed") {
        throw Errors.notEditable("Closed subscriptions cannot be edited");
      }

      const {
        customerId,
        planId,
        startDate,
        expiryDate,
        paymentTermDays,
        salespersonId,
        notes,
        lines,
      } = req.body || {};

      const isDraftOrQuote = ["draft", "quotation"].includes(sub.status);
      const isConfirmed = sub.status === "confirmed";

      if (!isDraftOrQuote && (customerId !== undefined || planId !== undefined || paymentTermDays !== undefined)) {
        throw Errors.notEditable(
          "Customer, plan and payment terms can only be edited in Draft or Quotation status"
        );
      }

      if (!isDraftOrQuote && !isConfirmed && (startDate !== undefined || expiryDate !== undefined)) {
        throw Errors.notEditable(
          "Dates cannot be edited via PATCH once subscription is Active or Paused"
        );
      }

      if (customerId !== undefined) sub.customerId = customerId;
      if (planId !== undefined) sub.planId = planId;
      if (startDate !== undefined) sub.startDate = startDate;
      if (expiryDate !== undefined) sub.expiryDate = expiryDate;
      if (paymentTermDays !== undefined) sub.paymentTermDays = paymentTermDays;
      if (salespersonId !== undefined) sub.salespersonId = salespersonId;
      if (notes !== undefined) sub.notes = notes;

      const plan = await Plan.findById(sub.planId);
      if (!plan) throw Errors.notFound("Plan not found");

      if (startDate !== undefined) {
        validatePlanAvailability(plan, sub.startDate);
      }
      if (sub.expiryDate < sub.startDate) {
        throw Errors.validation("Some fields are invalid", [
          { field: "expiryDate", message: "expiryDate must be >= startDate" },
        ]);
      }

      if (lines !== undefined) {
        sub.lines = await buildAndValidateLines(
          plan,
          lines,
          isDraftOrQuote,
          sub.lines
        );
      }

      const priced = await priceLines(sub, todayIST());
      sub.recurringTotal = priced.recurringTotal;
      sub.recurringNet = priced.recurringNet;

      if (sub.status === "quotation") {
        sub.history.unshift({
          at: new Date(),
          by: req.user._id,
          action: "edit",
          from: "quotation",
          to: "quotation",
          note: "Quotation updated",
        });
      }

      await sub.save();
      return res.json({
        data: await formatSubscriptionDetail(sub, req.user.role),
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/subscriptions/:id (Draft only)
router.delete(
  "/:id",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const sub = await Subscription.findById(req.params.id);
      if (!sub) throw Errors.notFound();
      if (sub.status !== "draft") {
        throw Errors.invalidTransition("Only Draft subscriptions can be deleted");
      }
      await sub.deleteOne();
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// SUBSCRIPTION ACTION ENDPOINTS (Page 28 & 33)
// ==========================================

// POST /api/v1/subscriptions/:id/send (Draft -> Quotation)
router.post(
  "/:id/send",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const sub = await Subscription.findById(req.params.id);
      if (!sub) throw Errors.notFound();
      if (sub.status !== "draft") {
        throw Errors.invalidTransition("Only Draft subscriptions can be sent as Quotation");
      }
      if (!sub.lines || sub.lines.length === 0) {
        throw Errors.invalidTransition("Subscription must have at least one line");
      }

      let validityDays = 14;
      if (sub.templateId) {
        const tpl = await QuotationTemplate.findById(sub.templateId);
        if (tpl && tpl.validityDays) validityDays = tpl.validityDays;
      }

      const today = todayIST();
      sub.status = "quotation";
      sub.quotationValidUntil = addDaysStr(today, validityDays);
      sub.history.unshift({
        at: new Date(),
        by: req.user._id,
        action: "send",
        from: "draft",
        to: "quotation",
        note: req.body?.note || null,
      });
      await sub.save();

      const customer = await Customer.findById(sub.customerId);
      if (customer && customer.userId && customer.email) {
        await sendQuotation({
          toEmail: customer.email,
          toName: customer.name,
          subscriptionNumber: sub.number,
          totalPaise: sub.recurringTotal,
          validUntil: sub.quotationValidUntil,
        });
      }

      return res.json({
        data: await formatSubscriptionDetail(sub, req.user.role),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/subscriptions/:id/confirm (Quotation -> Confirmed, or straight to Active if startDate <= today)
router.post(
  "/:id/confirm",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const sub = await Subscription.findById(req.params.id);
      if (!sub) throw Errors.notFound();
      if (sub.status !== "quotation") {
        throw Errors.invalidTransition("Only Quotation subscriptions can be confirmed");
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
        note: req.body?.note || null,
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
      return res.json({
        data: await formatSubscriptionDetail(sub, req.user.role),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/subscriptions/:id/activate (Confirmed -> Active)
router.post(
  "/:id/activate",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const sub = await Subscription.findById(req.params.id);
      if (!sub) throw Errors.notFound();
      if (sub.status !== "confirmed") {
        throw Errors.invalidTransition("Only Confirmed subscriptions can be activated");
      }

      sub.status = "active";
      sub.nextInvoiceDate = sub.startDate;
      sub.history.unshift({
        at: new Date(),
        by: req.user._id,
        action: "activate",
        from: "confirmed",
        to: "active",
        note: req.body?.note || null,
      });

      await sub.save();
      return res.json({
        data: await formatSubscriptionDetail(sub, req.user.role),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/subscriptions/:id/pause (Active -> Paused)
router.post(
  "/:id/pause",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const sub = await Subscription.findById(req.params.id);
      if (!sub) throw Errors.notFound();
      if (sub.status !== "active") {
        throw Errors.invalidTransition("Only Active subscriptions can be paused");
      }

      const plan = await Plan.findById(sub.planId);
      if (!plan || !plan.rules || !plan.rules.pausable) {
        throw Errors.planRule("This plan does not allow pausing");
      }

      sub.status = "paused";
      sub.pausedAt = new Date();
      sub.history.unshift({
        at: new Date(),
        by: req.user._id,
        action: "pause",
        from: "active",
        to: "paused",
        note: req.body?.note || null,
      });

      await sub.save();
      return res.json({
        data: await formatSubscriptionDetail(sub, req.user.role),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/subscriptions/:id/resume (Paused -> Active)
router.post(
  "/:id/resume",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const sub = await Subscription.findById(req.params.id);
      if (!sub) throw Errors.notFound();
      if (sub.status !== "paused") {
        throw Errors.invalidTransition("Only Paused subscriptions can be resumed");
      }

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
        note: req.body?.note || null,
      });

      await sub.save();
      return res.json({
        data: await formatSubscriptionDetail(sub, req.user.role),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/subscriptions/:id/renew (Extend expiryDate)
router.post(
  "/:id/renew",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const sub = await Subscription.findById(req.params.id);
      if (!sub) throw Errors.notFound();
      if (!["active", "paused"].includes(sub.status)) {
        throw Errors.invalidTransition("Only Active or Paused subscriptions can be renewed");
      }

      const plan = await Plan.findById(sub.planId);
      if (!plan || !plan.rules || !plan.rules.renewable) {
        throw Errors.planRule("This plan does not allow renewal");
      }

      let newExpiryDate = req.body?.newExpiryDate;
      if (newExpiryDate) {
        if (!isValidDateString(newExpiryDate) || newExpiryDate <= sub.expiryDate) {
          throw Errors.validation("Some fields are invalid", [
            { field: "newExpiryDate", message: "newExpiryDate must be after current expiryDate" },
          ]);
        }
      } else {
        // Extend by one more term of the same length as startDate -> expiryDate
        newExpiryDate = nextTermExpiry(sub.startDate, sub.expiryDate);
      }

      const oldExpiry = sub.expiryDate;
      sub.expiryDate = newExpiryDate;
      sub.history.unshift({
        at: new Date(),
        by: req.user._id,
        action: "renew",
        from: sub.status,
        to: sub.status,
        note: req.body?.note || `Renewed from ${oldExpiry} to ${newExpiryDate}`,
      });

      await sub.save();
      return res.json({
        data: await formatSubscriptionDetail(sub, req.user.role),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/subscriptions/:id/close (Active or Paused -> Closed)
router.post(
  "/:id/close",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const sub = await Subscription.findById(req.params.id);
      if (!sub) throw Errors.notFound();
      if (!["active", "paused"].includes(sub.status)) {
        throw Errors.invalidTransition("Only Active or Paused subscriptions can be closed");
      }

      const today = todayIST();
      const isPastExpiry = sub.expiryDate < today;
      const plan = await Plan.findById(sub.planId);

      if (!isPastExpiry && (!plan || !plan.rules || !plan.rules.closable)) {
        throw Errors.planRule("This plan does not allow closing early");
      }

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
        note: req.body?.note || null,
      });

      await sub.save();
      return res.json({
        data: await formatSubscriptionDetail(sub, req.user.role),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/subscriptions/:id/cancel (Draft, Quotation or Confirmed -> Closed)
router.post(
  "/:id/cancel",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const sub = await Subscription.findById(req.params.id);
      if (!sub) throw Errors.notFound();
      if (!["draft", "quotation", "confirmed"].includes(sub.status)) {
        throw Errors.invalidTransition(
          "Only Draft, Quotation or Confirmed subscriptions can be cancelled"
        );
      }

      const prevStatus = sub.status;
      sub.status = "closed";
      sub.closedAt = new Date();
      sub.closeReason = "cancelled";
      sub.nextInvoiceDate = null;
      sub.history.unshift({
        at: new Date(),
        by: req.user._id,
        action: "cancel",
        from: prevStatus,
        to: "closed",
        note: req.body?.note || null,
      });

      await sub.save();
      return res.json({
        data: await formatSubscriptionDetail(sub, req.user.role),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/subscriptions/:id/invoices ("Create invoice now")
router.post(
  "/:id/invoices",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const sub = await Subscription.findById(req.params.id);
      if (!sub) throw Errors.notFound();
      if (sub.status !== "active") {
        throw Errors.invalidTransition("Only Active subscriptions can be invoiced");
      }
      if (!sub.nextInvoiceDate || sub.nextInvoiceDate > sub.expiryDate) {
        throw Errors.invalidTransition("Next billing period is past the subscription expiry date");
      }

      const [plan, customer] = await Promise.all([
        Plan.findById(sub.planId).lean(),
        Customer.findById(sub.customerId).lean(),
      ]);

      const result = await billSinglePeriod(
        sub,
        plan,
        customer,
        todayIST(),
        req.user._id
      );

      if (result.status === "skipped") {
        throw Errors.alreadyInvoiced();
      }

      return res.status(201).json({ data: result.invoice.toJSON() });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = {
  router,
  formatSubscriptionDetail,
  computeAllowedActions,
};
