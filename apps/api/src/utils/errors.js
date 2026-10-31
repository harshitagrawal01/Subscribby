class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const Errors = {
  validation(message = "Some fields are invalid", details = []) {
    return new AppError(400, "VALIDATION_ERROR", message, details);
  },
  importInvalid(message = "Invalid CSV file", details = undefined) {
    return new AppError(400, "IMPORT_INVALID", message, details);
  },
  tokenInvalid(message = "Reset link is invalid, already used or expired") {
    return new AppError(400, "TOKEN_INVALID", message);
  },
  unauthenticated(message = "Authentication required") {
    return new AppError(401, "UNAUTHENTICATED", message);
  },
  invalidCredentials(message = "Invalid email or password") {
    return new AppError(401, "INVALID_CREDENTIALS", message);
  },
  forbidden(message = "You do not have permission to perform this action") {
    return new AppError(403, "FORBIDDEN", message);
  },
  accountDisabled(message = "This account has been disabled by an administrator") {
    return new AppError(403, "ACCOUNT_DISABLED", message);
  },
  passwordChangeRequired(message = "You must change your temporary password before continuing") {
    return new AppError(403, "PASSWORD_CHANGE_REQUIRED", message);
  },
  notFound(message = "Resource not found") {
    return new AppError(404, "NOT_FOUND", message);
  },
  emailTaken(message = "An account with this email already exists") {
    return new AppError(409, "EMAIL_TAKEN", message);
  },
  invalidTransition(message = "Action not allowed in the current status") {
    return new AppError(409, "INVALID_TRANSITION", message);
  },
  notEditable(message = "Record cannot be modified in its current state") {
    return new AppError(409, "NOT_EDITABLE", message);
  },
  alreadyInvoiced(message = "This subscription period already has an invoice") {
    return new AppError(409, "ALREADY_INVOICED", message);
  },
  overpayment(message = "Payment amount exceeds the invoice balance") {
    return new AppError(409, "OVERPAYMENT", message);
  },
  hasPayments(message = "Cannot cancel an invoice that has recorded payments") {
    return new AppError(409, "HAS_PAYMENTS", message);
  },
  planRule(message = "This action is not allowed by the subscription plan rules") {
    return new AppError(409, "PLAN_RULE", message);
  },
  belowMinQuantity(message = "Quantity is below the plan's minimum requirement") {
    return new AppError(409, "BELOW_MIN_QUANTITY", message);
  },
  planNotAvailable(message = "Start date is outside the plan's available dates") {
    return new AppError(409, "PLAN_NOT_AVAILABLE", message);
  },
  lastAdmin(message = "Cannot disable or demote the last active admin") {
    return new AppError(409, "LAST_ADMIN", message);
  },
  rateLimited(message = "Too many attempts, please try again later") {
    return new AppError(429, "RATE_LIMITED", message);
  },
};

module.exports = { AppError, Errors };
