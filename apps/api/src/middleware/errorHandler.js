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

  // Malformed JSON or body too large
  if (
    err &&
    (err.type === "entity.parse.failed" ||
      err.type === "entity.too.large" ||
      (err instanceof SyntaxError && err.status === 400))
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message:
          err.type === "entity.too.large"
            ? "Request body exceeds maximum allowed size"
            : "Malformed JSON in request body",
      },
    });
  }

  // Mongoose ValidationError -> 400 VALIDATION_ERROR
  if (err && err.name === "ValidationError" && err.errors) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path || "body",
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

  // BSONError / BSONTypeError from new ObjectId(badId) -> 400 VALIDATION_ERROR
  if (err && (err.name === "BSONError" || err.name === "BSONTypeError")) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid ID format",
        details: [{ field: "id", message: err.message }],
      },
    });
  }

  // CastError: route _id lookup -> 404 NOT_FOUND; field cast error -> 400 VALIDATION_ERROR
  if (err && err.name === "CastError") {
    if (err.kind === "ObjectId" && err.path === "_id") {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
        },
      });
    }
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Some fields are invalid",
        details: [
          {
            field: err.path || "body",
            message: `Invalid value for ${err.path || "field"}`,
          },
        ],
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
