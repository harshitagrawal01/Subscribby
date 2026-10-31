const express = require("express");
const Tax = require("../models/Tax");
const { Discount, formatDiscountResponse } = require("../models/Discount");
const { authenticate, requireRole } = require("../middleware/auth");
const { Errors } = require("../utils/errors");
const { escapeRegex } = require("../utils/validators");
const { isValidDateString, todayIST } = require("../utils/date");
const { parsePagination, buildMeta } = require("../utils/pagination");

const router = express.Router();

// ==========================================
// TAXES (/api/v1/taxes)
// ==========================================

router.get(
  "/taxes",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const { page, limit, skip, sort } = parsePagination(req.query);
      const filter = {};
      if (req.query.isActive !== undefined) {
        filter.isActive = req.query.isActive === "true";
      }

      const [taxes, total] = await Promise.all([
        Tax.find(filter).sort(sort).skip(skip).limit(limit),
        Tax.countDocuments(filter),
      ]);

      return res.json({
        data: taxes.map((t) => t.toJSON()),
        meta: buildMeta(page, limit, total),
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/taxes",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { name, type, rate, appliesTo, isActive = true } = req.body || {};

      if (!name || typeof name !== "string" || !name.trim()) {
        throw Errors.validation("Some fields are invalid", [
          { field: "name", message: "Tax name is required" },
        ]);
      }
      if (!["percentage", "fixed"].includes(type)) {
        throw Errors.validation("Some fields are invalid", [
          { field: "type", message: "Type must be percentage or fixed" },
        ]);
      }
      if (typeof rate !== "number" || rate < 0) {
        throw Errors.validation("Some fields are invalid", [
          { field: "rate", message: "Rate must be a non-negative number" },
        ]);
      }
      if (type === "fixed" && !Number.isInteger(rate)) {
        throw Errors.validation("Some fields are invalid", [
          { field: "rate", message: "Fixed tax rate must be integer paise" },
        ]);
      }
      if (
        !appliesTo ||
        !["all", "productTypes", "products"].includes(appliesTo.kind)
      ) {
        throw Errors.validation("Some fields are invalid", [
          { field: "appliesTo", message: "Valid appliesTo configuration is required" },
        ]);
      }

      const tax = await Tax.create({
        name: name.trim(),
        type,
        rate,
        appliesTo: {
          kind: appliesTo.kind,
          productTypes: appliesTo.productTypes || [],
          productIds: appliesTo.productIds || [],
        },
        isActive: Boolean(isActive),
      });

      return res.status(201).json({ data: tax.toJSON() });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/taxes/:id",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const tax = await Tax.findById(req.params.id);
      if (!tax) throw Errors.notFound();

      const { name, type, rate, appliesTo, isActive } = req.body || {};
      if (name !== undefined) tax.name = String(name).trim();
      if (type !== undefined) tax.type = type;
      if (rate !== undefined) tax.rate = rate;
      if (appliesTo !== undefined) {
        tax.appliesTo = {
          kind: appliesTo.kind || tax.appliesTo.kind,
          productTypes: appliesTo.productTypes ?? tax.appliesTo.productTypes,
          productIds: appliesTo.productIds ?? tax.appliesTo.productIds,
        };
      }
      if (isActive !== undefined) tax.isActive = Boolean(isActive);

      await tax.save();
      return res.json({ data: tax.toJSON() });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/taxes/:id",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const tax = await Tax.findById(req.params.id);
      if (!tax) throw Errors.notFound();
      tax.isActive = false;
      await tax.save();
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// DISCOUNTS (/api/v1/discounts)
// ==========================================

router.get(
  "/discounts",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const { page, limit, skip, sort } = parsePagination(req.query);
      const filter = {};
      if (req.query.search) {
        filter.name = new RegExp(escapeRegex(req.query.search.trim()), "i");
      }

      const allMatching = await Discount.find(filter).sort(sort);
      const today = todayIST();
      let formatted = allMatching.map((d) => formatDiscountResponse(d, today));

      if (req.query.state) {
        formatted = formatted.filter((d) => d.state === req.query.state);
      }

      const total = formatted.length;
      const paged = formatted.slice(skip, skip + limit);

      return res.json({
        data: paged,
        meta: buildMeta(page, limit, total),
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/discounts",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const {
        name,
        type,
        value,
        minPurchaseAmount = null,
        minQuantity = null,
        startDate,
        endDate,
        usageLimit = null,
        appliesTo,
        isActive = true,
      } = req.body || {};

      if (!name || typeof name !== "string" || !name.trim()) {
        throw Errors.validation("Some fields are invalid", [
          { field: "name", message: "Discount name is required" },
        ]);
      }
      if (!["percentage", "fixed"].includes(type)) {
        throw Errors.validation("Some fields are invalid", [
          { field: "type", message: "Type must be percentage or fixed" },
        ]);
      }
      if (typeof value !== "number" || value <= 0) {
        throw Errors.validation("Some fields are invalid", [
          { field: "value", message: "Value must be > 0" },
        ]);
      }
      if (type === "percentage" && (value < 0 || value > 100)) {
        throw Errors.validation("Some fields are invalid", [
          { field: "value", message: "Percentage value must be between 0 and 100" },
        ]);
      }
      if (type === "fixed" && !Number.isInteger(value)) {
        throw Errors.validation("Some fields are invalid", [
          { field: "value", message: "Fixed discount value must be integer paise" },
        ]);
      }
      if (!isValidDateString(startDate) || !isValidDateString(endDate) || endDate < startDate) {
        throw Errors.validation("Some fields are invalid", [
          { field: "endDate", message: "Valid startDate and endDate (>= startDate) are required" },
        ]);
      }
      if (
        !appliesTo ||
        !["products", "subscription"].includes(appliesTo.kind)
      ) {
        throw Errors.validation("Some fields are invalid", [
          { field: "appliesTo", message: "appliesTo.kind must be products or subscription" },
        ]);
      }

      const discount = await Discount.create({
        name: name.trim(),
        type,
        value,
        minPurchaseAmount,
        minQuantity,
        startDate,
        endDate,
        usageLimit,
        usedCount: 0,
        appliesTo: {
          kind: appliesTo.kind,
          productIds: appliesTo.productIds || [],
        },
        isActive: Boolean(isActive),
      });

      return res.status(201).json({ data: formatDiscountResponse(discount) });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/discounts/:id",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const discount = await Discount.findById(req.params.id);
      if (!discount) throw Errors.notFound();
      return res.json({ data: formatDiscountResponse(discount) });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/discounts/:id",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const discount = await Discount.findById(req.params.id);
      if (!discount) throw Errors.notFound();

      // usedCount changes only through invoices, never through PATCH (Page 23)
      const {
        name,
        type,
        value,
        minPurchaseAmount,
        minQuantity,
        startDate,
        endDate,
        usageLimit,
        appliesTo,
        isActive,
      } = req.body || {};

      if (usageLimit !== undefined && usageLimit !== null) {
        if (!Number.isInteger(usageLimit) || usageLimit < discount.usedCount) {
          throw Errors.validation("Some fields are invalid", [
            {
              field: "usageLimit",
              message: `usageLimit cannot be set below usedCount (${discount.usedCount})`,
            },
          ]);
        }
        discount.usageLimit = usageLimit;
      } else if (usageLimit === null) {
        discount.usageLimit = null;
      }

      if (name !== undefined) discount.name = String(name).trim();
      if (type !== undefined) discount.type = type;
      if (value !== undefined) {
        if (discount.type === "percentage" && (value < 0 || value > 100)) {
          throw Errors.validation("Some fields are invalid", [
            { field: "value", message: "Percentage must be between 0 and 100" },
          ]);
        }
        discount.value = value;
      }
      if (minPurchaseAmount !== undefined) discount.minPurchaseAmount = minPurchaseAmount;
      if (minQuantity !== undefined) discount.minQuantity = minQuantity;
      if (startDate !== undefined) discount.startDate = startDate;
      if (endDate !== undefined) discount.endDate = endDate;
      if (discount.endDate < discount.startDate) {
        throw Errors.validation("Some fields are invalid", [
          { field: "endDate", message: "endDate must be >= startDate" },
        ]);
      }
      if (appliesTo !== undefined) {
        discount.appliesTo = {
          kind: appliesTo.kind || discount.appliesTo.kind,
          productIds: appliesTo.productIds ?? discount.appliesTo.productIds,
        };
      }
      if (isActive !== undefined) discount.isActive = Boolean(isActive);

      await discount.save();
      return res.json({ data: formatDiscountResponse(discount) });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/discounts/:id/stop",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const discount = await Discount.findById(req.params.id);
      if (!discount) throw Errors.notFound();
      discount.isActive = false;
      await discount.save();
      return res.json({ data: formatDiscountResponse(discount) });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
