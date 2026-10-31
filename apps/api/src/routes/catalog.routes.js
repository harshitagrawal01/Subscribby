const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Plan = require("../models/Plan");
const QuotationTemplate = require("../models/QuotationTemplate");
const Subscription = require("../models/Subscription");
const { authenticate, requireRole } = require("../middleware/auth");
const { Errors } = require("../utils/errors");
const { assertIntegerPaise } = require("../utils/validators");
const { isValidDateString } = require("../utils/date");
const { parsePagination, buildMeta } = require("../utils/pagination");

const router = express.Router();

// ==========================================
// PRODUCTS (/api/v1/products)
// ==========================================

router.get(
  "/products",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const { page, limit, skip, sort } = parsePagination(req.query);
      const filter = {};

      if (req.query.type) filter.type = req.query.type;
      if (req.query.isActive !== undefined) {
        filter.isActive = req.query.isActive === "true";
      }
      if (req.query.search) {
        filter.name = new RegExp(req.query.search.trim(), "i");
      }

      const [products, total] = await Promise.all([
        Product.find(filter).sort(sort).skip(skip).limit(limit),
        Product.countDocuments(filter),
      ]);

      const productIds = products.map((p) => p._id);
      const planCounts = await Plan.aggregate([
        { $match: { productId: { $in: productIds } } },
        { $group: { _id: "$productId", count: { $sum: 1 } } },
      ]);
      const countMap = new Map(planCounts.map((c) => [String(c._id), c.count]));

      const data = products.map((p) => ({
        ...p.toJSON(),
        usedInPlans: countMap.get(String(p._id)) || 0,
      }));

      return res.json({ data, meta: buildMeta(page, limit, total) });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/products",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { name, type, salesPrice, costPrice = 0, notes = "", variants = [] } = req.body || {};

      if (!name || typeof name !== "string" || !name.trim()) {
        throw Errors.validation("Some fields are invalid", [
          { field: "name", message: "Product name is required" },
        ]);
      }
      if (!["service", "addon", "physical"].includes(type)) {
        throw Errors.validation("Some fields are invalid", [
          { field: "type", message: "Type must be service, addon or physical" },
        ]);
      }
      assertIntegerPaise(salesPrice, "salesPrice", false, 0);
      assertIntegerPaise(costPrice, "costPrice", false, 0);

      if (!Array.isArray(variants)) {
        throw Errors.validation("Some fields are invalid", [
          { field: "variants", message: "Variants must be an array" },
        ]);
      }

      const cleanVariants = variants.map((v, i) => {
        if (!v.attribute || !v.value) {
          throw Errors.validation("Some fields are invalid", [
            { field: `variants.${i}`, message: "Variant attribute and value are required" },
          ]);
        }
        assertIntegerPaise(v.extraPrice ?? 0, `variants.${i}.extraPrice`, false, 0);
        return {
          attribute: String(v.attribute).trim(),
          value: String(v.value).trim(),
          extraPrice: v.extraPrice ?? 0,
        };
      });

      const product = await Product.create({
        name: name.trim(),
        type,
        salesPrice,
        costPrice,
        notes,
        variants: cleanVariants,
        isActive: true,
      });

      return res.status(201).json({
        data: {
          ...product.toJSON(),
          usedInPlans: 0,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/products/:id",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) throw Errors.notFound();

      const usedInPlans = await Plan.countDocuments({ productId: product._id });
      return res.json({
        data: {
          ...product.toJSON(),
          usedInPlans,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/products/:id",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) throw Errors.notFound();

      const { name, type, salesPrice, costPrice, notes, variants, isActive } = req.body || {};

      if (name !== undefined) {
        if (!name || typeof name !== "string" || !name.trim()) {
          throw Errors.validation("Some fields are invalid", [
            { field: "name", message: "Name cannot be empty" },
          ]);
        }
        product.name = name.trim();
      }
      if (type !== undefined) {
        if (!["service", "addon", "physical"].includes(type)) {
          throw Errors.validation("Some fields are invalid", [
            { field: "type", message: "Invalid product type" },
          ]);
        }
        product.type = type;
      }
      if (salesPrice !== undefined) {
        assertIntegerPaise(salesPrice, "salesPrice", false, 0);
        product.salesPrice = salesPrice;
      }
      if (costPrice !== undefined) {
        assertIntegerPaise(costPrice, "costPrice", false, 0);
        product.costPrice = costPrice;
      }
      if (notes !== undefined) product.notes = notes;
      if (isActive !== undefined) product.isActive = Boolean(isActive);

      if (variants !== undefined) {
        if (!Array.isArray(variants)) {
          throw Errors.validation("Some fields are invalid", [
            { field: "variants", message: "Variants must be an array" },
          ]);
        }

        const existingVariantIds = product.variants.map((v) => String(v._id));
        const incomingIds = new Set(
          variants.filter((v) => v.id || v._id).map((v) => String(v.id || v._id))
        );
        const removedVariantIds = existingVariantIds.filter((id) => !incomingIds.has(id));

        if (removedVariantIds.length > 0) {
          const inUse = await Subscription.exists({
            status: { $in: ["active", "paused", "confirmed"] },
            "lines.variantId": {
              $in: removedVariantIds.map((id) => new mongoose.Types.ObjectId(id)),
            },
          });
          if (inUse) {
            throw Errors.notEditable("Cannot remove a variant used by an active subscription");
          }
        }

        product.variants = variants.map((v, i) => {
          assertIntegerPaise(v.extraPrice ?? 0, `variants.${i}.extraPrice`, false, 0);
          const item = {
            attribute: String(v.attribute).trim(),
            value: String(v.value).trim(),
            extraPrice: v.extraPrice ?? 0,
          };
          if (v.id || v._id) {
            item._id = new mongoose.Types.ObjectId(String(v.id || v._id));
          }
          return item;
        });
      }

      await product.save();
      const usedInPlans = await Plan.countDocuments({ productId: product._id });
      return res.json({
        data: {
          ...product.toJSON(),
          usedInPlans,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/products/:id",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) throw Errors.notFound();
      product.isActive = false;
      await product.save();
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// PLANS (/api/v1/plans)
// ==========================================

async function formatPlanDetail(plan) {
  const obj = plan.toJSON();
  const [product, activeSubscriptions] = await Promise.all([
    Product.findById(plan.productId),
    Subscription.countDocuments({ planId: plan._id, status: "active" }),
  ]);
  obj.product = product
    ? {
        id: String(product._id),
        name: product.name,
        variants: product.toJSON().variants,
      }
    : null;
  obj.activeSubscriptions = activeSubscriptions;
  return obj;
}

router.get(
  "/plans",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const { page, limit, skip, sort } = parsePagination(req.query);
      const filter = {};

      if (req.query.billingPeriod) filter.billingPeriod = req.query.billingPeriod;
      if (req.query.isActive !== undefined) {
        filter.isActive = req.query.isActive === "true";
      }
      if (req.query.search) {
        filter.name = new RegExp(req.query.search.trim(), "i");
      }
      if (req.query.availableOn) {
        const dt = req.query.availableOn;
        filter.availableFrom = { $lte: dt };
        filter.$or = [{ availableUntil: null }, { availableUntil: { $gte: dt } }];
      }

      const [plans, total] = await Promise.all([
        Plan.find(filter).sort(sort).skip(skip).limit(limit),
        Plan.countDocuments(filter),
      ]);

      const data = await Promise.all(plans.map((p) => formatPlanDetail(p)));
      return res.json({ data, meta: buildMeta(page, limit, total) });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/plans",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const {
        name,
        productId,
        price,
        billingPeriod,
        minQuantity = 1,
        availableFrom,
        availableUntil = null,
        rules = {},
        description = "",
      } = req.body || {};

      if (!name || typeof name !== "string" || !name.trim()) {
        throw Errors.validation("Some fields are invalid", [
          { field: "name", message: "Plan name is required" },
        ]);
      }
      const product = await Product.findById(productId);
      if (!product) {
        throw Errors.validation("Some fields are invalid", [
          { field: "productId", message: "Valid productId is required" },
        ]);
      }
      assertIntegerPaise(price, "price", false, 0);

      if (!["daily", "weekly", "monthly", "yearly"].includes(billingPeriod)) {
        throw Errors.validation("Some fields are invalid", [
          { field: "billingPeriod", message: "Invalid billingPeriod" },
        ]);
      }
      if (!Number.isInteger(minQuantity) || minQuantity < 1) {
        throw Errors.validation("Some fields are invalid", [
          { field: "minQuantity", message: "minQuantity must be >= 1" },
        ]);
      }
      if (!isValidDateString(availableFrom)) {
        throw Errors.validation("Some fields are invalid", [
          { field: "availableFrom", message: "availableFrom must be YYYY-MM-DD" },
        ]);
      }
      if (availableUntil !== null && availableUntil !== undefined) {
        if (!isValidDateString(availableUntil) || availableUntil < availableFrom) {
          throw Errors.validation("Some fields are invalid", [
            {
              field: "availableUntil",
              message: "availableUntil must be on or after availableFrom",
            },
          ]);
        }
      }

      const plan = await Plan.create({
        name: name.trim(),
        productId: product._id,
        price,
        billingPeriod,
        minQuantity,
        availableFrom,
        availableUntil: availableUntil || null,
        rules: {
          autoClose: Boolean(rules.autoClose),
          closable: rules.closable !== undefined ? Boolean(rules.closable) : true,
          pausable: rules.pausable !== undefined ? Boolean(rules.pausable) : true,
          renewable: rules.renewable !== undefined ? Boolean(rules.renewable) : true,
        },
        description,
        isActive: true,
      });

      return res.status(201).json({ data: await formatPlanDetail(plan) });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/plans/:id",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const plan = await Plan.findById(req.params.id);
      if (!plan) throw Errors.notFound();
      return res.json({ data: await formatPlanDetail(plan) });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/plans/:id",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const plan = await Plan.findById(req.params.id);
      if (!plan) throw Errors.notFound();

      const {
        name,
        price,
        billingPeriod,
        minQuantity,
        availableFrom,
        availableUntil,
        rules,
        description,
        isActive,
      } = req.body || {};

      if (name !== undefined) plan.name = String(name).trim();
      if (price !== undefined) {
        assertIntegerPaise(price, "price", false, 0);
        plan.price = price;
      }
      if (billingPeriod !== undefined) plan.billingPeriod = billingPeriod;
      if (minQuantity !== undefined) {
        if (!Number.isInteger(minQuantity) || minQuantity < 1) {
          throw Errors.validation("Some fields are invalid", [
            { field: "minQuantity", message: "minQuantity must be >= 1" },
          ]);
        }
        plan.minQuantity = minQuantity;
      }
      if (availableFrom !== undefined) plan.availableFrom = availableFrom;
      if (availableUntil !== undefined) plan.availableUntil = availableUntil;
      if (plan.availableUntil && plan.availableUntil < plan.availableFrom) {
        throw Errors.validation("Some fields are invalid", [
          {
            field: "availableUntil",
            message: "availableUntil must be on or after availableFrom",
          },
        ]);
      }
      if (rules && typeof rules === "object") {
        plan.rules = {
          ...plan.rules.toObject(),
          ...rules,
        };
      }
      if (description !== undefined) plan.description = description;
      if (isActive !== undefined) plan.isActive = Boolean(isActive);

      await plan.save();
      return res.json({ data: await formatPlanDetail(plan) });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/plans/:id",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const plan = await Plan.findById(req.params.id);
      if (!plan) throw Errors.notFound();
      plan.isActive = false;
      await plan.save();
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// QUOTATION TEMPLATES (/api/v1/quotation-templates)
// ==========================================

async function formatTemplateDetail(tpl) {
  const obj = tpl.toJSON();
  const [plan, usedCount] = await Promise.all([
    Plan.findById(tpl.planId),
    Subscription.countDocuments({ templateId: tpl._id }),
  ]);

  const productIds = tpl.lines.map((l) => l.productId);
  const products = await Product.find({ _id: { $in: productIds } });
  const prodMap = new Map(products.map((p) => [String(p._id), p]));

  obj.plan = plan
    ? {
        id: String(plan._id),
        name: plan.name,
        billingPeriod: plan.billingPeriod,
      }
    : null;

  obj.lines = tpl.lines.map((l) => {
    const prod = prodMap.get(String(l.productId));
    let variantLabel = null;
    let extraPrice = 0;
    if (prod && l.variantId) {
      const v = prod.variants.id(l.variantId);
      if (v) {
        variantLabel = `${v.attribute}: ${v.value}`;
        extraPrice = v.extraPrice || 0;
      }
    }
    const isPlanProduct =
      plan && prod && String(prod._id) === String(plan.productId);
    const basePrice = isPlanProduct
      ? plan.price
      : prod
      ? prod.salesPrice
      : 0;

    return {
      productId: String(l.productId),
      productName: prod ? prod.name : "",
      variantId: l.variantId ? String(l.variantId) : null,
      variantLabel,
      quantity: l.quantity,
      unitPrice: basePrice + extraPrice,
    };
  });

  obj.usedCount = usedCount;
  return obj;
}

async function validateTemplateLines(plan, lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw Errors.validation("Some fields are invalid", [
      { field: "lines", message: "At least one line is required" },
    ]);
  }

  let planProductQty = 0;
  for (const line of lines) {
    if (String(line.productId) === String(plan.productId)) {
      planProductQty += line.quantity || 0;
    }
  }
  if (planProductQty < plan.minQuantity) {
    throw Errors.belowMinQuantity(
      `The line for the plan's product must have quantity >= ${plan.minQuantity}`
    );
  }
}

router.get(
  "/quotation-templates",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const { page, limit, skip, sort } = parsePagination(req.query);
      const filter = {};
      if (req.query.planId) filter.planId = req.query.planId;
      if (req.query.isActive !== undefined) {
        filter.isActive = req.query.isActive === "true";
      }
      if (req.query.search) {
        filter.name = new RegExp(req.query.search.trim(), "i");
      }

      const [templates, total] = await Promise.all([
        QuotationTemplate.find(filter).sort(sort).skip(skip).limit(limit),
        QuotationTemplate.countDocuments(filter),
      ]);

      const data = await Promise.all(templates.map((t) => formatTemplateDetail(t)));
      return res.json({ data, meta: buildMeta(page, limit, total) });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/quotation-templates",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const {
        name,
        planId,
        validityDays = 14,
        paymentTermDays = 0,
        lines = [],
        notes = "",
      } = req.body || {};

      if (!name || typeof name !== "string" || !name.trim()) {
        throw Errors.validation("Some fields are invalid", [
          { field: "name", message: "Template name is required" },
        ]);
      }

      const plan = await Plan.findById(planId);
      if (!plan) {
        throw Errors.validation("Some fields are invalid", [
          { field: "planId", message: "Valid planId is required" },
        ]);
      }

      await validateTemplateLines(plan, lines);

      const tpl = await QuotationTemplate.create({
        name: name.trim(),
        planId: plan._id,
        validityDays,
        paymentTermDays,
        lines: lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId || null,
          quantity: l.quantity,
        })),
        notes,
        isActive: true,
      });

      return res.status(201).json({ data: await formatTemplateDetail(tpl) });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/quotation-templates/:id",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const tpl = await QuotationTemplate.findById(req.params.id);
      if (!tpl) throw Errors.notFound();
      return res.json({ data: await formatTemplateDetail(tpl) });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/quotation-templates/:id",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const tpl = await QuotationTemplate.findById(req.params.id);
      if (!tpl) throw Errors.notFound();

      const { name, planId, validityDays, paymentTermDays, lines, notes, isActive } =
        req.body || {};

      if (name !== undefined) tpl.name = String(name).trim();
      if (planId !== undefined) tpl.planId = planId;
      if (validityDays !== undefined) tpl.validityDays = validityDays;
      if (paymentTermDays !== undefined) tpl.paymentTermDays = paymentTermDays;
      if (notes !== undefined) tpl.notes = notes;
      if (isActive !== undefined) tpl.isActive = Boolean(isActive);

      const plan = await Plan.findById(tpl.planId);
      if (!plan) throw Errors.notFound("Plan not found");

      if (lines !== undefined) {
        await validateTemplateLines(plan, lines);
        tpl.lines = lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId || null,
          quantity: l.quantity,
        }));
      }

      await tpl.save();
      return res.json({ data: await formatTemplateDetail(tpl) });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/quotation-templates/:id",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const tpl = await QuotationTemplate.findById(req.params.id);
      if (!tpl) throw Errors.notFound();
      tpl.isActive = false;
      await tpl.save();
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
