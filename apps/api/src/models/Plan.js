const mongoose = require("mongoose");
const { applyToJSON } = require("../utils/toJSON");

const planRulesSchema = new mongoose.Schema(
  {
    autoClose: { type: Boolean, default: false },
    closable: { type: Boolean, default: true },
    pausable: { type: Boolean, default: true },
    renewable: { type: Boolean, default: true },
  },
  { _id: false }
);

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    price: { type: Number, required: true, min: 0 }, // paise per unit per billing period
    billingPeriod: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
      required: true,
    },
    minQuantity: { type: Number, required: true, min: 1, default: 1 },
    availableFrom: { type: String, required: true }, // "YYYY-MM-DD"
    availableUntil: { type: String, default: null }, // "YYYY-MM-DD" | null
    rules: { type: planRulesSchema, default: () => ({}) },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

planSchema.index({ isActive: 1, availableFrom: 1 });

applyToJSON(planSchema);

module.exports = mongoose.model("Plan", planSchema);
