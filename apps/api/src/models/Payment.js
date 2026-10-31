const mongoose = require("mongoose");
const { applyToJSON } = require("../utils/toJSON");

const paymentSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
    },
    method: {
      type: String,
      enum: ["bank_transfer", "card", "cash", "cheque", "upi", "other"],
      required: true,
    },
    amount: { type: Number, required: true, min: 1 }, // integer paise > 0
    paymentDate: { type: String, required: true }, // "YYYY-MM-DD"
    note: { type: String, default: "" },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ invoiceId: 1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ customerId: 1 });

applyToJSON(paymentSchema);

module.exports = mongoose.model("Payment", paymentSchema);
