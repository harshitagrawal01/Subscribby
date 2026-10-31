const { Errors } = require("./errors");

/**
 * Validates password against the 4 rules (Page 14):
 * - More than 8 characters (9 or more)
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one special character
 * Returns an array of details entries for each rule broken.
 */
function checkPasswordRules(password, fieldName = "password") {
  const details = [];
  if (typeof password !== "string" || password.length < 9) {
    details.push({
      field: fieldName,
      message: "Must be more than 8 characters (at least 9 characters)",
    });
  }
  if (typeof password !== "string" || !/[A-Z]/.test(password)) {
    details.push({
      field: fieldName,
      message: "Must contain at least one uppercase letter",
    });
  }
  if (typeof password !== "string" || !/[a-z]/.test(password)) {
    details.push({
      field: fieldName,
      message: "Must contain at least one lowercase letter",
    });
  }
  if (typeof password !== "string" || !/[^A-Za-z0-9]/.test(password)) {
    details.push({
      field: fieldName,
      message: "Must contain at least one special character",
    });
  }
  return details;
}

function assertValidPassword(password, fieldName = "password") {
  const details = checkPasswordRules(password, fieldName);
  if (details.length > 0) {
    throw Errors.validation("Some fields are invalid", details);
  }
}

function isValidEmail(email) {
  if (typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function assertIntegerPaise(val, fieldName, allowNull = false, min = 0) {
  if (val === null || val === undefined) {
    if (allowNull) return;
    throw Errors.validation("Some fields are invalid", [
      { field: fieldName, message: `${fieldName} is required` },
    ]);
  }
  if (typeof val !== "number" || !Number.isInteger(val) || val < min) {
    throw Errors.validation("Some fields are invalid", [
      {
        field: fieldName,
        message: `Must be an integer in paise (>= ${min})`,
      },
    ]);
  }
}

module.exports = {
  checkPasswordRules,
  assertValidPassword,
  isValidEmail,
  assertIntegerPaise,
};
