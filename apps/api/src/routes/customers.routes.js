const express = require("express");
const Customer = require("../models/Customer");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");
const { authenticate, requireRole } = require("../middleware/auth");
const { Errors } = require("../utils/errors");
const { isValidEmail, escapeRegex } = require("../utils/validators");
const { todayIST } = require("../utils/date");
const { parsePagination, buildMeta } = require("../utils/pagination");

const router = express.Router();

/**
 * Enriches an array of customer documents with computed portalStatus and stats
 * using batch aggregations (no N+1 queries, Page 26).
 */
async function enrichCustomers(customers) {
  if (customers.length === 0) return [];

  const customerIds = customers.map((c) => c._id);
  const userIds = customers.map((c) => c.userId).filter(Boolean);
  const today = todayIST();

  const [users, subAgg, invAgg] = await Promise.all([
    User.find({ _id: { $in: userIds } }, { status: 1 }).lean(),
    Subscription.aggregate([
      { $match: { customerId: { $in: customerIds }, status: "active" } },
      { $group: { _id: "$customerId", activeSubscriptions: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      {
        $match: {
          customerId: { $in: customerIds },
          status: { $in: ["confirmed", "paid"] },
        },
      },
      {
        $group: {
          _id: "$customerId",
          outstandingAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", "confirmed"] }, "$balance", 0],
            },
          },
          overdueAmount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "confirmed"] },
                    { $gt: ["$balance", 0] },
                    { $lt: ["$dueDate", today] },
                  ],
                },
                "$balance",
                0,
              ],
            },
          },
          paidToDate: { $sum: "$amountPaid" },
        },
      },
    ]),
  ]);

  const userMap = new Map(users.map((u) => [String(u._id), u.status]));
  const subMap = new Map(subAgg.map((s) => [String(s._id), s.activeSubscriptions]));
  const invMap = new Map(invAgg.map((i) => [String(i._id), i]));

  return customers.map((c) => {
    const obj = c.toJSON ? c.toJSON() : { ...c };
    const cid = String(c._id || c.id);

    let portalStatus = "none";
    if (c.userId) {
      const st = userMap.get(String(c.userId));
      portalStatus = st === "disabled" ? "disabled" : "active";
    }

    const invStats = invMap.get(cid) || {};
    obj.portalStatus = portalStatus;
    obj.stats = {
      activeSubscriptions: subMap.get(cid) || 0,
      outstandingAmount: invStats.outstandingAmount || 0,
      overdueAmount: invStats.overdueAmount || 0,
      paidToDate: invStats.paidToDate || 0,
    };
    return obj;
  });
}

// GET /api/v1/customers
router.get(
  "/",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const { page, limit, skip, sort } = parsePagination(req.query);
      const filter = {};

      if (req.query.isActive !== undefined) {
        filter.isActive = req.query.isActive === "true";
      }
      if (req.query.search) {
        const rx = new RegExp(escapeRegex(req.query.search.trim()), "i");
        filter.$or = [{ name: rx }, { email: rx }, { contactName: rx }];
      }

      if (req.query.hasOverdue === "true") {
        const today = todayIST();
        const overdueCustomerIds = await Invoice.distinct("customerId", {
          status: "confirmed",
          balance: { $gt: 0 },
          dueDate: { $lt: today },
        });
        filter._id = { $in: overdueCustomerIds };
      }

      if (req.query.hasActiveSubscription !== undefined) {
        const activeCustomerIds = await Subscription.distinct("customerId", {
          status: "active",
        });
        if (req.query.hasActiveSubscription === "true") {
          filter._id = filter._id
            ? {
                $in: filter._id.$in.filter((id) =>
                  activeCustomerIds.some((a) => String(a) === String(id))
                ),
              }
            : { $in: activeCustomerIds };
        } else if (req.query.hasActiveSubscription === "false") {
          filter._id = { $nin: activeCustomerIds };
        }
      }

      const [customers, total] = await Promise.all([
        Customer.find(filter).sort(sort).skip(skip).limit(limit),
        Customer.countDocuments(filter),
      ]);

      const data = await enrichCustomers(customers);
      return res.json({ data, meta: buildMeta(page, limit, total) });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/customers
router.post(
  "/",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const {
        name,
        contactName = "",
        email,
        phone = "",
        billingAddress = {},
        taxId = "",
        notes = "",
      } = req.body || {};

      const details = [];
      if (!name || typeof name !== "string" || !name.trim()) {
        details.push({ field: "name", message: "Company or person name is required" });
      }
      if (!email || !isValidEmail(email)) {
        details.push({ field: "email", message: "Valid email is required" });
      }
      if (details.length > 0) {
        throw Errors.validation("Some fields are invalid", details);
      }

      const normalizedEmail = email.trim().toLowerCase();
      // Link to existing customer user login if one exists
      const existingUser = await User.findOne({
        email: normalizedEmail,
        role: "customer",
      });

      const customer = await Customer.create({
        name: name.trim(),
        contactName: contactName ? contactName.trim() : "",
        email: normalizedEmail,
        phone,
        billingAddress,
        taxId,
        notes,
        userId: existingUser ? existingUser._id : null,
        isActive: true,
      });

      if (existingUser && !existingUser.customerId) {
        existingUser.customerId = customer._id;
        await existingUser.save();
      }

      const [enriched] = await enrichCustomers([customer]);
      return res.status(201).json({ data: enriched });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/customers/:id
router.get(
  "/:id",
  authenticate,
  requireRole("admin", "staff", "finance"),
  async (req, res, next) => {
    try {
      const customer = await Customer.findById(req.params.id);
      if (!customer) throw Errors.notFound();
      const [enriched] = await enrichCustomers([customer]);
      return res.json({ data: enriched });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/customers/:id
router.patch(
  "/:id",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const customer = await Customer.findById(req.params.id);
      if (!customer) throw Errors.notFound();

      const {
        name,
        contactName,
        email,
        phone,
        billingAddress,
        taxId,
        notes,
        isActive,
      } = req.body || {};

      if (name !== undefined) customer.name = String(name).trim();
      if (contactName !== undefined) customer.contactName = contactName;
      if (email !== undefined) {
        if (!isValidEmail(email)) {
          throw Errors.validation("Some fields are invalid", [
            { field: "email", message: "Valid email is required" },
          ]);
        }
        customer.email = email.trim().toLowerCase();
      }
      if (phone !== undefined) customer.phone = phone;
      if (billingAddress !== undefined) {
        customer.billingAddress = {
          ...customer.billingAddress.toObject(),
          ...billingAddress,
        };
      }
      if (taxId !== undefined) customer.taxId = taxId;
      if (notes !== undefined) customer.notes = notes;
      if (isActive !== undefined) customer.isActive = Boolean(isActive);

      await customer.save();
      const [enriched] = await enrichCustomers([customer]);
      return res.json({ data: enriched });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/customers/:id (Archive; 409 NOT_EDITABLE if they have active subscriptions)
router.delete(
  "/:id",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res, next) => {
    try {
      const customer = await Customer.findById(req.params.id);
      if (!customer) throw Errors.notFound();

      const hasActive = await Subscription.exists({
        customerId: customer._id,
        status: "active",
      });
      if (hasActive) {
        throw Errors.notEditable("Cannot archive a customer with active subscriptions");
      }

      customer.isActive = false;
      await customer.save();
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
