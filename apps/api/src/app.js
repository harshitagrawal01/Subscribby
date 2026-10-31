const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const env = require("./config/env");
const { requestIdMiddleware, errorHandler } = require("./middleware/errorHandler");
const { authenticate } = require("./middleware/auth");
const { Errors } = require("./utils/errors");

const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const catalogRoutes = require("./routes/catalog.routes");
const configRoutes = require("./routes/config.routes");
const customersRoutes = require("./routes/customers.routes");
const { router: subscriptionsRoutes } = require("./routes/subscriptions.routes");
const { router: invoicesRoutes } = require("./routes/invoices.routes");
const paymentsRoutes = require("./routes/payments.routes");
const portalRoutes = require("./routes/portal.routes");
const reportsRoutes = require("./routes/reports.routes");

const app = express();

// Required for AWS Elastic Beanstalk nginx reverse proxy so rate limiters see real client IP (Page 49)
app.set("trust proxy", true);

app.use(requestIdMiddleware);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.CORS_ORIGINS.includes("*") || env.CORS_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

// ==========================================
// Health Check Endpoint (Page 18)
// ==========================================
app.get("/api/v1/health", async (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  const status = isConnected ? "ok" : "error";
  const httpCode = isConnected ? 200 : 503;

  return res.status(httpCode).json({
    status,
    db: isConnected ? "ok" : "disconnected",
    time: new Date().toISOString(),
  });
});

// ==========================================
// Meta Dropdowns Endpoint (Page 17)
// ==========================================
app.get("/api/v1/meta", authenticate, (req, res) => {
  return res.json({
    data: {
      accessLevels: [
        { value: "staff", label: "Internal Staff" },
        { value: "finance", label: "Finance Lead" },
        { value: "admin", label: "Admin" },
      ],
      billingPeriods: ["daily", "weekly", "monthly", "yearly"],
      productTypes: ["service", "addon", "physical"],
      paymentMethods: ["bank_transfer", "card", "cash", "cheque", "upi", "other"],
      paymentTermDays: [0, 15, 30, 45],
      subscriptionStatuses: [
        "draft",
        "quotation",
        "confirmed",
        "active",
        "paused",
        "closed",
      ],
      invoiceStatuses: ["draft", "confirmed", "paid", "cancelled"],
      currency: "INR",
      company: env.COMPANY,
    },
  });
});

// ==========================================
// Mount API v1 Routes
// ==========================================
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1", catalogRoutes); // /products, /plans, /quotation-templates
app.use("/api/v1", configRoutes); // /taxes, /discounts
app.use("/api/v1/customers", customersRoutes);
app.use("/api/v1/subscriptions", subscriptionsRoutes);
app.use("/api/v1", invoicesRoutes); // /invoices, /billing/run, /billing/last-run
app.use("/api/v1/payments", paymentsRoutes);
app.use("/api/v1/portal", portalRoutes);
app.use("/api/v1/reports", reportsRoutes);

// 404 handler for unknown API routes
app.use((req, res, next) => {
  next(Errors.notFound(`Route ${req.method} ${req.originalUrl} not found`));
});

// Global error handler
app.use(errorHandler);

module.exports = app;
