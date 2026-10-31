const mongoose = require("mongoose");
const { applyToJSON } = require("../utils/toJSON");

const invoiceLineSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  productName: { type: String, default: "" },
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  variantLabel: { type: String, default: null },
  description: { type: String, required: true }, // e.g. "Brightloop CRM · Brand: Odoo"
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  subtotal: { type: Number, required: true },
  discount: {
    type: new mongoose.Schema(
      {
        discountId: { type: mongoose.Schema.Types.ObjectId, ref: "Discount" },
        name: String,
        amount: Number,
      },
      { _id: false }
    ),
    default: null,
  },
  orderDiscountShare: { type: Number, default: 0 },
  taxes: {
    type: [
      new mongoose.Schema(
        {
          taxId: { type: mongoose.Schema.Types.ObjectId, ref: "Tax" },
          name: String,
          type: String,
          rate: Number,
          amount: Number,
        },
        { _id: false }
      ),
    ],
    default: [],
  },
  taxAmount: { type: Number, required: true },
  total: { type: Number, required: true },
});

applyToJSON(invoiceLineSchema);

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    customerSnapshot: {
      name: String,
      email: String,
      billingAddress: mongoose.Schema.Types.Mixed,
      taxId: String,
    },
    periodStart: { type: String, required: true }, // "YYYY-MM-DD"
    periodEnd: { type: String, required: true }, // "YYYY-MM-DD"
    invoiceDate: { type: String, required: true }, // "YYYY-MM-DD"
    dueDate: { type: String, required: true }, // "YYYY-MM-DD"
    status: {
      type: String,
      enum: ["draft", "confirmed", "paid", "cancelled"],
      default: "draft",
    },
    isVoid: { type: Boolean, default: false }, // true only when cancelled
    lines: { type: [invoiceLineSchema], default: [] },
    orderDiscount: {
      type: new mongoose.Schema(
        {
          discountId: { type: mongoose.Schema.Types.ObjectId, ref: "Discount" },
          name: String,
          amount: Number,
        },
        { _id: false }
      ),
      default: null,
    },
    untaxedAmount: { type: Number, required: true },
    discountTotal: { type: Number, required: true },
    taxTotal: { type: Number, required: true },
    total: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, required: true }, // total - amountPaid
    appliedDiscountIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Discount" }],
      default: [],
    },
    notes: { type: String, default: "" },
    sentAt: { type: Date, default: null },
    sentCount: { type: Number, default: 0 },
    confirmedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.Mixed, default: "system" }, // userId or "system"
  },
  { timestamps: true }
);

// Crucial database guarantee: prevents double-billing a subscription period!
// Cancelled invoices set isVoid: true so that the period can be re-billed.
invoiceSchema.index(
  { subscriptionId: 1, periodStart: 1 },
  { unique: true, partialFilterExpression: { isVoid: false } }
);
invoiceSchema.index({ status: 1, dueDate: 1 });
invoiceSchema.index({ customerId: 1, status: 1 });
invoiceSchema.index({ invoiceDate: 1 });

applyToJSON(invoiceSchema);

module.exports = mongoose.model("Invoice", invoiceSchema);
