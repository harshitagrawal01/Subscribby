const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const { Errors } = require("../utils/errors");

function signToken(user) {
  return jwt.sign(
    {
      sub: String(user._id || user.id),
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

/**
 * Authenticates Bearer JWT token, verifies user is active, checks passwordChangedAt,
 * and enforces forced password change (mustChangePassword).
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw Errors.unauthenticated();
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw Errors.unauthenticated();
    }

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch (e) {
      throw Errors.unauthenticated("Invalid or expired token");
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      throw Errors.unauthenticated();
    }

    if (user.status === "disabled") {
      throw Errors.unauthenticated("Account is disabled");
    }

    // Reject tokens issued before the user's last password change
    if (user.passwordChangedAt && payload.iat) {
      const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (payload.iat < changedAtSec) {
        throw Errors.unauthenticated("Token invalidated by password change");
      }
    }

    // Enforce forced password change except on GET /auth/me and POST /auth/change-password
    if (user.mustChangePassword) {
      const path = req.baseUrl + req.path;
      const isAllowed =
        (req.method === "GET" && path.endsWith("/auth/me")) ||
        (req.method === "POST" && path.endsWith("/auth/change-password"));
      if (!isAllowed) {
        throw Errors.passwordChangeRequired();
      }
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(Errors.unauthenticated());
    }
    if (!roles.includes(req.user.role)) {
      return next(Errors.forbidden());
    }
    next();
  };
}

module.exports = { signToken, authenticate, requireRole };
