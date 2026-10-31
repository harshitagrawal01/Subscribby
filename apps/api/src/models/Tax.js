const mongoose = require("mongoose");
const { applyToJSON } = require("../utils/toJSON");

const taxAppliesToSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["all", "productTypes", "products"],
      required: true,
    },
    productTypes: {
      type: [{ type: String, enum: ["service", "addon", "physical"] }],
      default: [],
    },
    productIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
      default: [],
    },
  },
  { _id: false }
);

const taxSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    rate: { type: Number, required: true, min: 0 }, // percentage (e.g. 18) or fixed paise per unit
    appliesTo: { type: taxAppliesToSchema, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

applyToJSON(taxSchema);

module.exports = mongoose.model("Tax", taxSchema);
