const mongoose = require("mongoose");
const { applyToJSON } = require("../utils/toJSON");

const subscriptionLineSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  productName: { type: String, required: true },
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  variantLabel: { type: String, default: null },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 }, // integer paise
});

applyToJSON(subscriptionLineSchema);

const historyEntrySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.Mixed, required: true }, // userId ObjectId or "system"
    action: { type: String, required: true },
    from: { type: String, default: null },
    to: { type: String, required: true },
    note: { type: String, default: null },
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuotationTemplate",
      default: null,
    },
    salespersonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["draft", "quotation", "confirmed", "active", "paused", "closed"],
      default: "draft",
    },
    startDate: { type: String, required: true }, // "YYYY-MM-DD"
    expiryDate: { type: String, required: true }, // "YYYY-MM-DD"
    quotationValidUntil: { type: String, default: null }, // "YYYY-MM-DD" | null
    paymentTermDays: { type: Number, default: 0 },
    lines: { type: [subscriptionLineSchema], default: [] },
    nextInvoiceDate: { type: String, default: null }, // "YYYY-MM-DD" | null
    recurringTotal: { type: Number, default: 0 }, // 1 period's total incl. tax (paise)
    recurringNet: { type: Number, default: 0 }, // 1 period's total after discount, before tax (paise)
    pausedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    closeReason: {
      type: String,
      enum: [
        "expired",
        "closed_early",
        "cancelled",
        "rejected",
        "quotation_expired",
        null,
      ],
      default: null,
    },
    notes: { type: String, default: "" },
    history: { type: [historyEntrySchema], default: [] },
  },
  { timestamps: true }
);

subscriptionSchema.index({ status: 1, nextInvoiceDate: 1 });
subscriptionSchema.index({ customerId: 1, status: 1 });
subscriptionSchema.index({ planId: 1, status: 1 });

applyToJSON(subscriptionSchema);

module.exports = mongoose.model("Subscription", subscriptionSchema);
