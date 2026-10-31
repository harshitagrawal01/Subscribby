const mongoose = require("mongoose");
const { applyToJSON } = require("../utils/toJSON");

const templateLineSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const quotationTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },
    validityDays: { type: Number, required: true, min: 1, default: 14 },
    paymentTermDays: {
      type: Number,
      enum: [0, 15, 30, 45],
      default: 0,
    },
    lines: { type: [templateLineSchema], default: [] },
    notes: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

applyToJSON(quotationTemplateSchema);

module.exports = mongoose.model("QuotationTemplate", quotationTemplateSchema);
