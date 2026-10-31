const mongoose = require("mongoose");
const { applyToJSON } = require("../utils/toJSON");

const billingRunSchema = new mongoose.Schema(
  {
    asOfDate: { type: String, required: true },
    dryRun: { type: Boolean, default: false },
    lifecycle: {
      quotationsExpired: { type: Number, default: 0 },
      activated: { type: Number, default: 0 },
      autoClosed: { type: Number, default: 0 },
    },
    dueSubscriptions: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    skippedAlreadyInvoiced: { type: Number, default: 0 },
    failed: { type: Array, default: [] },
    invoiceIds: { type: [String], default: [] },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

applyToJSON(billingRunSchema);

module.exports = mongoose.model("BillingRun", billingRunSchema);
