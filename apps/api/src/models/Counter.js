const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "SUB-2026" or "INV-2026"
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

/**
 * Atomically generates the next sequential number per year, e.g., SUB/2026/0042 or INV/2026/0310.
 */
async function nextSequenceNumber(prefix, year = new Date().getFullYear(), session = null) {
  const key = `${prefix}-${year}`;
  const opts = { upsert: true, new: true };
  if (session) opts.session = session;

  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    opts
  );
  return `${prefix}/${year}/${String(doc.seq).padStart(4, "0")}`;
}

module.exports = { Counter, nextSequenceNumber };
