const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const { parse } = require("csv-parse/sync");
const User = require("../models/User");
const env = require("../config/env");
const { authenticate, requireRole } = require("../middleware/auth");
const { Errors } = require("../utils/errors");
const {
  checkPasswordRules,
  assertValidPassword,
  isValidEmail,
  escapeRegex,
} = require("../utils/validators");
const { parsePagination, buildMeta } = require("../utils/pagination");

const router = express.Router();

const importLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.NODE_ENV === "development" ? 100 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res, next) => next(Errors.rateLimited()),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 }, // 1 MB limit (Page 24)
});

function mapAccessLevel(raw) {
  if (!raw || typeof raw !== "string") return null;
  const val = raw.trim().toLowerCase();
  if (val === "internal staff" || val === "staff") return "staff";
  if (val === "finance lead" || val === "finance") return "finance";
  if (val === "admin") return "admin";
  return null;
}

// GET /api/v1/users/import/template
router.get(
  "/import/template",
  authenticate,
  requireRole("admin"),
  (req, res) => {
    const csv =
      "name,email,temporary_password,access_level\nRiya Sharma,riya@brightloop.test,Welcome@2026!,Internal Staff\n";
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="users-import-template.csv"'
    );
    return res.send(csv);
  }
);

// POST /api/v1/users/import?dryRun=true|false
router.post(
  "/import",
  authenticate,
  requireRole("admin"),
  importLimiter,
  upload.single("file"),
  async (req, res, next) => {
    try {
      const dryRun = String(req.query.dryRun).toLowerCase() === "true";

      if (!req.file) {
        throw Errors.importInvalid("A .csv file in field 'file' is required");
      }

      const originalName = req.file.originalname || "";
      if (!originalName.toLowerCase().endsWith(".csv")) {
        throw Errors.importInvalid("Only .csv files are accepted");
      }

      const content = req.file.buffer.toString("utf8");
      let rawRecords;
      try {
        rawRecords = parse(content, {
          bom: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        });
      } catch (e) {
        throw Errors.importInvalid("CSV file could not be parsed: " + e.message);
      }

      if (!rawRecords || rawRecords.length < 2) {
        throw Errors.importInvalid("CSV file must include a header row and at least one data row");
      }

      const headers = rawRecords[0].map((h) => String(h).trim().toLowerCase());
      const requiredCols = ["name", "email", "temporary_password", "access_level"];
      for (const col of requiredCols) {
        if (!headers.includes(col)) {
          throw Errors.importInvalid(`Missing required column: ${col}`);
        }
      }

      const dataRows = rawRecords.slice(1);
      if (dataRows.length > 200) {
        throw Errors.importInvalid("CSV file exceeds the maximum limit of 200 data rows");
      }

      const idxName = headers.indexOf("name");
      const idxEmail = headers.indexOf("email");
      const idxPass = headers.indexOf("temporary_password");
      const idxAccess = headers.indexOf("access_level");

      // Pre-fetch existing emails in DB
      const candidateEmails = dataRows
        .map((r) => String(r[idxEmail] || "").trim().toLowerCase())
        .filter(Boolean);
      const existingUsers = await User.find(
        { email: { $in: candidateEmails } },
        { email: 1 }
      ).lean();
      const existingEmailSet = new Set(existingUsers.map((u) => u.email));

      const seenInFile = new Set();
      const rowsReport = [];
      const toCreate = [];

      for (let i = 0; i < dataRows.length; i++) {
        const rowNum = i + 2; // Header is row 1
        const r = dataRows[i];
        const rawName = String(r[idxName] || "").trim();
        const rawEmail = String(r[idxEmail] || "").trim().toLowerCase();
        const rawPass = String(r[idxPass] || "");
        const rawAccess = String(r[idxAccess] || "").trim();

        const rowErrors = [];

        if (rawName.length < 2 || rawName.length > 80) {
          rowErrors.push({
            field: "name",
            message: "Name is required (2 to 80 characters)",
          });
        }

        if (!isValidEmail(rawEmail)) {
          rowErrors.push({
            field: "email",
            message: "Not a valid email",
          });
        } else if (existingEmailSet.has(rawEmail)) {
          rowErrors.push({
            field: "email",
            message: "Email already has an account",
          });
        } else if (seenInFile.has(rawEmail)) {
          rowErrors.push({
            field: "email",
            message: "Email is repeated in the CSV file",
          });
        } else {
          seenInFile.add(rawEmail);
        }

        const passErrors = checkPasswordRules(rawPass, "temporary_password");
        rowErrors.push(...passErrors);

        const mappedRole = mapAccessLevel(rawAccess);
        if (!mappedRole) {
          rowErrors.push({
            field: "access_level",
            message: "Must be Internal Staff, Finance Lead or Admin",
          });
        }

        const isValid = rowErrors.length === 0;
        rowsReport.push({
          row: rowNum,
          name: rawName,
          email: rawEmail,
          role: mappedRole,
          status: isValid ? "valid" : "invalid",
          errors: rowErrors,
        });

        if (isValid) {
          toCreate.push({
            name: rawName,
            email: rawEmail,
            rawPass,
            role: mappedRole,
          });
        }
      }

      const validCount = rowsReport.filter((r) => r.status === "valid").length;
      const invalidCount = rowsReport.length - validCount;

      // All or nothing: only create when invalidCount === 0 and dryRun === false
      if (!dryRun && invalidCount === 0 && toCreate.length > 0) {
        const docsToInsert = await Promise.all(
          toCreate.map(async (item) => ({
            name: item.name,
            email: item.email,
            passwordHash: await bcrypt.hash(item.rawPass, 10),
            role: item.role,
            status: "active",
            mustChangePassword: true,
            createdVia: "import",
            createdBy: req.user._id,
          }))
        );

        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            await User.insertMany(docsToInsert, { session });
          });
        } catch (txErr) {
          if (
            txErr &&
            typeof txErr.message === "string" &&
            txErr.message.includes("Transaction numbers are only allowed on a replica set")
          ) {
            await User.insertMany(docsToInsert);
          } else {
            throw txErr;
          }
        } finally {
          await session.endSession();
        }

        rowsReport.forEach((r) => {
          r.status = "created";
        });

        return res.status(201).json({
          data: {
            dryRun: false,
            total: rowsReport.length,
            valid: validCount,
            invalid: 0,
            created: docsToInsert.length,
            rows: rowsReport,
          },
        });
      }

      return res.status(200).json({
        data: {
          dryRun,
          total: rowsReport.length,
          valid: validCount,
          invalid: invalidCount,
          created: 0,
          rows: rowsReport,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/users
router.get("/", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const { page, limit, skip, sort } = parsePagination(req.query);
    const filter = {};

    if (req.query.role) filter.role = req.query.role;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(req.query.search.trim()), "i");
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const [items, total] = await Promise.all([
      User.find(filter).sort(sort).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    return res.json({
      data: items.map((u) => u.toJSON()),
      meta: buildMeta(page, limit, total),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users (Create staff, finance or admin user with temporary password)
router.post("/", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const { name, email, role, temporaryPassword } = req.body || {};
    const details = [];

    if (!name || typeof name !== "string" || !name.trim()) {
      details.push({ field: "name", message: "Name is required" });
    }
    if (!email || !isValidEmail(email)) {
      details.push({ field: "email", message: "Valid email is required" });
    }
    if (!["staff", "finance", "admin"].includes(role)) {
      details.push({
        field: "role",
        message: "Role must be staff, finance or admin",
      });
    }
    details.push(...checkPasswordRules(temporaryPassword, "temporaryPassword"));

    if (details.length > 0) {
      throw Errors.validation("Some fields are invalid", details);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw Errors.emailTaken();
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
      status: "active",
      mustChangePassword: true,
      createdVia: "admin",
      createdBy: req.user._id,
    });

    return res.status(201).json({ data: user.toJSON() });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/users/:id
router.patch("/:id", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw Errors.notFound();

    const { name, role, status } = req.body || {};

    // Check LAST_ADMIN protection (Page 24)
    const wouldLoseAdmin =
      user.role === "admin" &&
      user.status === "active" &&
      ((role && role !== "admin") || (status && status === "disabled"));

    if (wouldLoseAdmin) {
      const otherAdmins = await User.countDocuments({
        _id: { $ne: user._id },
        role: "admin",
        status: "active",
      });
      if (otherAdmins === 0) {
        throw Errors.lastAdmin();
      }
    }

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        throw Errors.validation("Some fields are invalid", [
          { field: "name", message: "Name cannot be empty" },
        ]);
      }
      user.name = name.trim();
    }
    if (role !== undefined) {
      if (!["staff", "finance", "admin", "customer"].includes(role)) {
        throw Errors.validation("Some fields are invalid", [
          { field: "role", message: "Invalid role" },
        ]);
      }
      user.role = role;
    }
    if (status !== undefined) {
      if (!["active", "disabled"].includes(status)) {
        throw Errors.validation("Some fields are invalid", [
          { field: "status", message: "Status must be active or disabled" },
        ]);
      }
      user.status = status;
    }

    await user.save();
    return res.json({ data: user.toJSON() });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users/:id/reset-password
router.post(
  "/:id/reset-password",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) throw Errors.notFound();

      const { temporaryPassword } = req.body || {};
      assertValidPassword(temporaryPassword, "temporaryPassword");

      user.passwordHash = await bcrypt.hash(temporaryPassword, 10);
      user.mustChangePassword = true;
      user.passwordChangedAt = new Date(
        Math.max(Date.now(), (user.passwordChangedAt ? user.passwordChangedAt.getTime() : 0) + 1)
      );
      await user.save();

      return res.json({ data: user.toJSON() });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
