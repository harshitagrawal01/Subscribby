const mongoose = require("mongoose");
const { applyToJSON } = require("../utils/toJSON");
const { todayIST } = require("../utils/date");

const discountAppliesToSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["products", "subscription"],
      required: true,
    },
    productIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
      default: [],
    },
  },
  { _id: false }
);

const discountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    value: { type: Number, required: true, min: 0 }, // percentage (0-100) or fixed paise
    minPurchaseAmount: { type: Number, default: null }, // paise or null
    minQuantity: { type: Number, default: null }, // int or null
    startDate: { type: String, required: true }, // "YYYY-MM-DD"
    endDate: { type: String, required: true }, // "YYYY-MM-DD"
    usageLimit: { type: Number, default: null }, // int or null (unlimited)
    usedCount: { type: Number, default: 0 },
    appliesTo: { type: discountAppliesToSchema, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

discountSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

applyToJSON(discountSchema);

/**
 * Computes discount state: inactive | expired | scheduled | exhausted | running
 */
function computeDiscountState(discount, onDate = todayIST()) {
  if (!discount.isActive) return "inactive";
  if (onDate > discount.endDate) return "expired";
  if (onDate < discount.startDate) return "scheduled";
  if (
    discount.usageLimit !== null &&
    discount.usageLimit !== undefined &&
    discount.usedCount >= discount.usageLimit
  ) {
    return "exhausted";
  }
  return "running";
}

function formatDiscountResponse(doc, onDate = todayIST()) {
  const obj = doc.toJSON ? doc.toJSON() : { ...doc };
  obj.state = computeDiscountState(obj, onDate);
  obj.remainingUses =
    obj.usageLimit !== null && obj.usageLimit !== undefined
      ? Math.max(0, obj.usageLimit - (obj.usedCount || 0))
      : null;
  return obj;
}

module.exports = {
  Discount: mongoose.model("Discount", discountSchema),
  computeDiscountState,
  formatDiscountResponse,
};
