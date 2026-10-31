const crypto = require("crypto");
const { AppError } = require("../utils/errors");
const { ZodError } = require("zod");

function requestIdMiddleware(req, res, next) {
  req.id = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}

function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const payload = {
      error: {
        code: err.code,
        message: err.message,
      },
    };
    if (err.details !== undefined) {
      payload.error.details = err.details;
    }
    return res.status(err.status).json(payload);
  }

  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join(".") || "body",
      message: e.message,
    }));
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Some fields are invalid",
        details,
      },
    });
  }

  // Multer file size / upload errors
  if (err && err.name === "MulterError") {
    return res.status(400).json({
      error: {
        code: "IMPORT_INVALID",
        message: err.message,
      },
    });
  }

  // Invalid MongoDB ObjectId cast error -> 404 NOT_FOUND
  if (err && err.name === "CastError" && err.kind === "ObjectId") {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Resource not found",
      },
    });
  }

  console.error(`[ERROR reqId=${req.id}]`, err);
  return res.status(500).json({
    error: {
      code: "INTERNAL",
      message: "An unexpected internal error occurred",
      requestId: req.id,
    },
  });
}

module.exports = { requestIdMiddleware, errorHandler };
