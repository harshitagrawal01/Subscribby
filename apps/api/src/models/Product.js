const mongoose = require("mongoose");
const { applyToJSON } = require("../utils/toJSON");

const variantSchema = new mongoose.Schema({
  attribute: { type: String, required: true, trim: true },
  value: { type: String, required: true, trim: true },
  extraPrice: { type: Number, required: true, min: 0 }, // integer paise
});

applyToJSON(variantSchema);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["service", "addon", "physical"],
      required: true,
    },
    salesPrice: { type: Number, required: true, min: 0 }, // integer paise
    costPrice: { type: Number, required: true, min: 0 }, // integer paise
    notes: { type: String, default: "" },
    variants: { type: [variantSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: 1 });
productSchema.index({ isActive: 1, type: 1 });

applyToJSON(productSchema);

module.exports = mongoose.model("Product", productSchema);
