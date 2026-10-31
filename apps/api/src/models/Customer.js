const mongoose = require("mongoose");
const { applyToJSON } = require("../utils/toJSON");

const billingAddressSchema = new mongoose.Schema(
  {
    line1: { type: String, default: "" },
    line2: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    country: { type: String, default: "IN" },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contactName: { type: String, default: "" },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    billingAddress: { type: billingAddressSchema, default: () => ({}) },
    taxId: { type: String, default: "" },
    notes: { type: String, default: "" },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customerSchema.index({ email: 1 });
customerSchema.index({ name: "text", email: "text" });

applyToJSON(customerSchema);

module.exports = mongoose.model("Customer", customerSchema);
