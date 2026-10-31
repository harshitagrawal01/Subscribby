const dotenv = require("dotenv");
dotenv.config();

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "4000", 10),
  MONGODB_URI:
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/Subscribby?directConnection=true",
  JWT_SECRET:
    process.env.JWT_SECRET || "brightloop-super-secret-jwt-key-2026-hackathon",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  CORS_ORIGINS: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  WEB_URL: (process.env.WEB_URL || "http://localhost:5173").replace(/\/$/, ""),
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || "console",
  BREVO_API_KEY: process.env.BREVO_API_KEY || "",
  BREVO_SENDER_EMAIL:
    process.env.BREVO_SENDER_EMAIL || "billing@brightloop.test",
  BREVO_SENDER_NAME: process.env.BREVO_SENDER_NAME || "Brightloop",
  BREVO_TEMPLATE_RESET_ID: process.env.BREVO_TEMPLATE_RESET_ID
    ? parseInt(process.env.BREVO_TEMPLATE_RESET_ID, 10)
    : null,
  TZ: process.env.TZ || "Asia/Kolkata",
  RUN_JOBS: process.env.RUN_JOBS === "true",
  BILLING_CRON: process.env.BILLING_CRON || "30 0 * * *",
  get CUSTOMER_SELF_SERVICE() {
    return process.env.CUSTOMER_SELF_SERVICE === "true";
  },
  COMPANY: {
    name: process.env.COMPANY_NAME || "Brightloop Software",
    address:
      process.env.COMPANY_ADDRESS ||
      "42 Residency Road, Bengaluru, Karnataka 560025",
    taxId: process.env.COMPANY_TAX_ID || "29AABCB1234F1Z5",
    email: process.env.COMPANY_EMAIL || "billing@brightloop.test",
  },
};
