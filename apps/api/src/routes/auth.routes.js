const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const Customer = require("../models/Customer");
const env = require("../config/env");
const { Errors } = require("../utils/errors");
const { assertValidPassword, isValidEmail } = require("../utils/validators");
const { signToken, authenticate } = require("../middleware/auth");
const { sendPasswordReset } = require("../services/mailer");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.NODE_ENV === "development" ? 200 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res, next) => next(Errors.rateLimited()),
});

// Per-email rate tracking for forgot-password (3 per hour per email)
const emailForgotCounts = new Map();

function formatUserAuth(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: Boolean(user.mustChangePassword),
    customerId: user.customerId ? String(user.customerId) : null,
  };
}

// POST /api/v1/auth/customer/signup
router.post("/customer/signup", authLimiter, async (req, res, next) => {
  try {
    const { name, companyName, email, password } = req.body || {};
    const details = [];

    if (!name || typeof name !== "string" || !name.trim()) {
      details.push({ field: "name", message: "Name is required" });
    }
    if (!email || !isValidEmail(email)) {
      details.push({ field: "email", message: "A valid email is required" });
    }
    if (details.length > 0) {
      throw Errors.validation("Some fields are invalid", details);
    }

    assertValidPassword(password, "password");

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw Errors.emailTaken();
    }

    // Link existing customer record if staff already created one without a login
    let customer = await Customer.findOne({ email: normalizedEmail, userId: null });
    if (!customer) {
      customer = await Customer.create({
        name: companyName && companyName.trim() ? companyName.trim() : name.trim(),
        contactName: name.trim(),
        email: normalizedEmail,
        isActive: true,
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    // Always role "customer", ignoring any role in req.body
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "customer",
      status: "active",
      mustChangePassword: false,
      createdVia: "signup",
      customerId: customer._id,
      lastLoginAt: new Date(),
    });

    customer.userId = user._id;
    await customer.save();

    const token = signToken(user);
    return res.status(201).json({
      data: {
        token,
        user: formatUserAuth(user),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Shared login helper for customer and staff portals
async function handlePortalLogin(req, res, next, allowedRoles) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      throw Errors.validation("Email and password are required", [
        { field: "email", message: "Email and password are required" },
      ]);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // Reject unknown user or wrong portal with identical 401 INVALID_CREDENTIALS
    if (!user || !allowedRoles.includes(user.role)) {
      throw Errors.invalidCredentials();
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw Errors.invalidCredentials();
    }

    // Check disabled status ONLY after password checks out (Page 15)
    if (user.status === "disabled") {
      throw Errors.accountDisabled();
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(user);
    return res.status(200).json({
      data: {
        token,
        user: formatUserAuth(user),
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/customer/login
router.post("/customer/login", authLimiter, (req, res, next) =>
  handlePortalLogin(req, res, next, ["customer"])
);

// POST /api/v1/auth/staff/login
router.post("/staff/login", authLimiter, (req, res, next) =>
  handlePortalLogin(req, res, next, ["admin", "staff", "finance"])
);

// GET /api/v1/auth/me
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = req.user;
    const data = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      mustChangePassword: Boolean(user.mustChangePassword),
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    };

    if (user.role === "customer" && user.customerId) {
      const customer = await Customer.findById(user.customerId);
      if (customer) {
        data.customer = customer.toJSON();
      }
    }

    return res.json({ data });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/auth/me
router.patch("/me", authenticate, async (req, res, next) => {
  try {
    const user = req.user;
    const { name, contactName, phone, billingAddress, taxId } = req.body || {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        throw Errors.validation("Some fields are invalid", [
          { field: "name", message: "Name cannot be empty" },
        ]);
      }
      user.name = name.trim();
      await user.save();
    }

    let customerData = undefined;
    if (user.role === "customer" && user.customerId) {
      const customer = await Customer.findById(user.customerId);
      if (customer) {
        if (name !== undefined) customer.contactName = name.trim();
        if (contactName !== undefined) customer.contactName = contactName;
        if (phone !== undefined) customer.phone = phone;
        if (taxId !== undefined) customer.taxId = taxId;
        if (billingAddress && typeof billingAddress === "object") {
          customer.billingAddress = {
            ...customer.billingAddress.toObject(),
            ...billingAddress,
          };
        }
        await customer.save();
        customerData = customer.toJSON();
      }
    }

    return res.json({
      data: {
        ...formatUserAuth(user),
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        ...(customerData ? { customer: customerData } : {}),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/change-password
router.post("/change-password", authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const user = req.user;

    if (!currentPassword || typeof currentPassword !== "string") {
      throw Errors.validation("Some fields are invalid", [
        { field: "currentPassword", message: "Current password is required" },
      ]);
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw Errors.validation("Some fields are invalid", [
        { field: "currentPassword", message: "Current password is incorrect" },
      ]);
    }

    assertValidPassword(newPassword, "newPassword");

    if (currentPassword === newPassword) {
      throw Errors.validation("Some fields are invalid", [
        {
          field: "newPassword",
          message: "New password must be different from the current password",
        },
      ]);
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    // Subtract 1s buffer or set exact current time so tokens issued before now are rejected
    user.passwordChangedAt = new Date(Date.now() + 1000);
    await user.save();

    // Sign fresh token after updating passwordChangedAt
    const token = jwt.sign(
      {
        sub: String(user._id),
        role: user.role,
        iat: Math.floor(user.passwordChangedAt.getTime() / 1000) + 1,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    return res.json({
      data: {
        token,
        user: formatUserAuth(user),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/forgot-password
router.post("/forgot-password", authLimiter, async (req, res, next) => {
  try {
    const { email, portal = "customer" } = req.body || {};
    if (!email || typeof email !== "string") {
      throw Errors.validation("Email is required", [
        { field: "email", message: "Valid email is required" },
      ]);
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Rate limit: 3 requests per email per hour
    const nowMs = Date.now();
    const history = (emailForgotCounts.get(normalizedEmail) || []).filter(
      (t) => nowMs - t < 60 * 60 * 1000
    );
    if (history.length >= 3 && env.NODE_ENV !== "development") {
      throw Errors.rateLimited();
    }
    history.push(nowMs);
    emailForgotCounts.set(normalizedEmail, history);

    const user = await User.findOne({ email: normalizedEmail });
    const roleMatchesPortal =
      user &&
      ((portal === "customer" && user.role === "customer") ||
        (portal === "staff" && ["admin", "staff", "finance"].includes(user.role)));

    if (!user || user.status === "disabled" || !roleMatchesPortal) {
      // Return 200 ok: true without sending anything (Page 16)
      return res.json({ data: { ok: true } });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.resetTokenHash = tokenHash;
    user.resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    const resetPath =
      portal === "staff"
        ? `${env.STAFF_PORTAL_PATH}/reset-password?token=${rawToken}`
        : `/reset-password?token=${rawToken}`;
    const resetUrl = `${env.WEB_URL}${resetPath}`;

    await sendPasswordReset({
      toEmail: user.email,
      toName: user.name,
      resetUrl,
      expiresInMinutes: 30,
    });

    const responseData = { ok: true };
    if (env.NODE_ENV === "development" && env.EMAIL_PROVIDER === "console") {
      responseData.devResetUrl = resetUrl;
      responseData.devToken = rawToken;
    }

    return res.json({ data: responseData });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/reset-password
router.post("/reset-password", authLimiter, async (req, res, next) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || typeof token !== "string") {
      throw Errors.tokenInvalid();
    }

    assertValidPassword(newPassword, "newPassword");

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
    });

    if (!user || user.status === "disabled") {
      throw Errors.tokenInvalid();
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    user.resetTokenHash = null;
    user.resetTokenExpiresAt = null;
    user.passwordChangedAt = new Date(Date.now() + 1000);
    await user.save();

    const jwtToken = jwt.sign(
      {
        sub: String(user._id),
        role: user.role,
        iat: Math.floor(user.passwordChangedAt.getTime() / 1000) + 1,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    return res.json({
      data: {
        token: jwtToken,
        user: formatUserAuth(user),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
