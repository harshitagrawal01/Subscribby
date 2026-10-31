const mongoose = require("mongoose");
const { applyToJSON } = require("../utils/toJSON");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "staff", "finance", "customer"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: { type: Date, default: null },
    createdVia: {
      type: String,
      enum: ["signup", "admin", "import", "seed"],
      default: "signup",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    lastLoginAt: { type: Date, default: null },
    resetTokenHash: { type: String, default: null },
    resetTokenExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, status: 1 });

applyToJSON(userSchema, [
  "passwordHash",
  "resetTokenHash",
  "resetTokenExpiresAt",
  "passwordChangedAt",
  "createdBy",
]);

module.exports = mongoose.model("User", userSchema);
