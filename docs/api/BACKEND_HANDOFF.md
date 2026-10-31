# Subscribby Backend API (`apps/api`) — Handoff & Integration Guide

All milestones (**M0–M6**) and **every item from your review checklist** are now implemented, tested, and deployed live.

---

## 1. Live Backend URL & Local Setup

- **Live Deployed API Base URL (AWS Elastic Beanstalk):**
  `http://subscribby-api-env.eba-xyim8qvr.ap-south-1.elasticbeanstalk.com/api/v1`
- **Live Health Check:**
  `http://subscribby-api-env.eba-xyim8qvr.ap-south-1.elasticbeanstalk.com/api/v1/health`
- **Postman Collection:**
  `docs/api/brightloop-postman-collection.json`

### Running Locally (3 Options)
1. **Against Live Cloud DB (MongoDB Atlas) or Local Replica Set:**
   ```bash
   cd apps/api
   cp .env.example .env
   # Put your STAFF_PORTAL_PATH in apps/api/.env
   npm install
   npm run seed
   npm run dev
   ```
   Runs on `http://localhost:4000` (matches `VITE_API_PROXY_TARGET=http://localhost:4000` in `apps/web`).
2. **Via Docker Compose (from repo root):**
   ```bash
   docker compose up --build
   ```
   `docker-compose.yml` now sets `MONGODB_URI=mongodb://mongo:27017/Subscribby?replicaSet=rs0` automatically.
3. **Must-Pass Automated Checks (Page 54):**
   ```bash
   cd apps/api
   npm test
   ```

---

## 2. All Review Items Fixed ✅

### From "Will break the app"
1. **M4–M6 Modules & Routes (`MODULE_NOT_FOUND`):**
   - Pushed all M4–M6 files: `models/Invoice.js`, `models/Payment.js`, `models/BillingRun.js`, `services/billing.js`, `routes/invoices.routes.js`, `routes/payments.routes.js`, `routes/portal.routes.js`, `routes/reports.routes.js`, `seed/seed.js`, `tests/mustPass.test.js`, `app.js`, and `server.js`.
2. **`STAFF_PORTAL_PATH` & Docker `MONGODB_URI`:**
   - `STAFF_PORTAL_PATH` is read from `apps/api/.env` (`config/env.js`) and used when generating staff reset-password links (`${WEB_URL}${STAFF_PORTAL_PATH}/reset-password?token=...`).
   - `docker-compose.yml` now defaults `MONGODB_URI` to `mongodb://mongo:27017/Subscribby?replicaSet=rs0`.
3. **Regex Escaping on Search (`(`, `+`, `*`, `?`):**
   - Added `escapeRegex()` in `src/utils/validators.js` and applied it across `users.routes.js`, `catalog.routes.js` (`/products`, `/plans`, `/quotation-templates`), `config.routes.js` (`/discounts`), `customers.routes.js`, `subscriptions.routes.js`, and `invoices.routes.js`.
4. **Keeping Stored Line `unitPrice` Overrides on Edit:**
   - In `subscriptions.routes.js`, if an incoming line has an `id` matching an existing line with the same `productId` and `variantId` and omits `unitPrice`, `prev.unitPrice` is preserved in **every** status (including Draft and Quotation).
5. **Row-Indexed Validation Field Names:**
   - Subscription line validation errors now return `lines[0].productId`, `lines[0].variantId`, `lines[0].quantity`, `lines[0].unitPrice`.
   - Product variant validation errors now return `variants[i].attribute`, `variants[i].value`, `variants[i].extraPrice`.
6. **Bad Input Mapped to `400 VALIDATION_ERROR` (not `500`):**
   - `src/middleware/errorHandler.js` now maps Mongoose `ValidationError`, field `CastError`, malformed JSON (`entity.parse.failed`), oversized payload (`entity.too.large`), and `BSONError`/`BSONTypeError` to `400 VALIDATION_ERROR` with `details`.
7. **Single Discount Per Invoice + Tie-Breaker (`src/services/pricing.js`):**
   - Matches `apps/web/mock-api/src/pricing.js:58-108` 100%:
     - Queries running discounts with `.sort({ createdAt: 1, _id: 1 })`.
     - Evaluates total savings for each qualifying product discount (across all qualifying lines) and subscription discount (on `untaxedAmount`).
     - Applies only the single discount that saves the most (ties: `products` beats `subscription`, then older discount wins).
     - Both Test Case 1 (`12814800` paise) and Test Case 2 (`295000` paise) pass.

### From "Will look wrong"
- **`statusCounts` when filtering by `planId` / `customerId` / `subscriptionId`:** Wrapped filter IDs in `new mongoose.Types.ObjectId(...)` before passing to `.aggregate()`.
- **Missing Subscription Fields:**
  - Detail (`GET /subscriptions/:id`): Added `recurringTotal`, `recurringNet`, `pausedAt`, `closedAt`.
  - List (`GET /subscriptions`): Added `quotationValidUntil`, `isExpired`, `closeReason`, `recurringNet`, `createdAt`, `updatedAt`.
- **Renew Term Length (`POST /subscriptions/:id/renew` & Portal Renew):** Now uses `nextTermExpiry(startDate, expiryDate)` to add one more term of the exact same length as `startDate` → `expiryDate`.
- **Editing Active Subscription with Archived Add-on:** Only rejects archived products on new or changed lines (`changedItem && !prod.isActive`).
- **Unit Price Change After Quotation:** Returns `409 NOT_EDITABLE` instead of silently ignoring.
- **Sign-up Password Validation:** Returns all broken password rules together with `name`/`email` errors in `details`.
- **Disabled User Token:** `authenticate` middleware now returns `403 ACCOUNT_DISABLED` instead of `401 UNAUTHENTICATED`.
- **`GET /auth/me`:** Now includes top-level `customerId`.
- **Discount `state` Order:** Checks `inactive` → `expired` → `scheduled` → `exhausted` → `running`.
- **Plans & Products:** `PATCH /plans/:id` now updates `productId`; `usedInPlans` only counts active plans (`isActive: true`).
- **Template with Empty/Omitted `lines`:** Defaults to `[{ productId: plan.productId, variantId: null, quantity: plan.minQuantity }]`.
- **CSV Import:** Added 5/min rate limiter + graceful fallback if run against a standalone local `mongod` without replica set.
- **`passwordChangedAt`:** Uses exact monotonic millisecond timestamp (`pwdTs` claim in JWT) so old tokens are invalidated immediately without rejecting a fresh login within 1 second.

---

## 3. Complete Endpoints Summary (`/api/v1`)

| Module | Endpoints |
| :--- | :--- |
| **Health & Meta** | `GET /health`, `GET /meta` |
| **Auth** | `POST /auth/customer/signup`, `POST /auth/customer/login`, `POST /auth/staff/login`, `GET /auth/me`, `PATCH /auth/me`, `POST /auth/change-password`, `POST /auth/forgot-password`, `POST /auth/reset-password` |
| **Users & CSV Import** | `GET /users`, `POST /users`, `PATCH /users/:id`, `POST /users/:id/reset-password`, `GET /users/import/template`, `POST /users/import?dryRun=true\|false` |
| **Catalog** | `GET/POST /products`, `GET/PATCH/DELETE /products/:id`, `GET/POST /plans`, `GET/PATCH/DELETE /plans/:id`, `GET/POST /quotation-templates`, `GET/PATCH/DELETE /quotation-templates/:id` |
| **Taxes & Discounts** | `GET/POST /taxes`, `PATCH/DELETE /taxes/:id`, `GET/POST /discounts`, `GET/PATCH /discounts/:id`, `POST /discounts/:id/stop` |
| **Customers** | `GET/POST /customers`, `GET/PATCH/DELETE /customers/:id` |
| **Subscriptions** | `GET/POST /subscriptions`, `POST /subscriptions/preview`, `GET/PATCH/DELETE /subscriptions/:id`, `POST /subscriptions/:id/{send,confirm,activate,pause,resume,renew,close,cancel,invoices}` |
| **Billing & Invoices** | `POST /billing/run`, `GET /billing/last-run`, `GET /invoices`, `GET/PATCH /invoices/:id`, `POST /invoices/:id/{confirm,cancel,send}`, `POST /invoices/bulk/{confirm,send}` |
| **Payments** | `GET/POST /payments`, `DELETE /payments/:id` |
| **Customer Portal** | `GET /portal/summary`, `GET /portal/subscriptions`, `GET /portal/subscriptions/:id`, `POST /portal/subscriptions/:id/{accept,reject,pause,resume,renew,close}`, `GET /portal/invoices`, `GET /portal/invoices/:id` |
| **Reports** | `GET /reports/summary`, `GET /reports/revenue-by-month`, `GET /reports/subscriptions-by-plan`, `GET /reports/overdue`, `GET /reports/aging`, `GET /reports/export` |

---

## 4. Vercel Frontend Proxy Config (`apps/web/vercel.json`)

When deploying `apps/web` to Vercel, add `apps/web/vercel.json` so `/api/*` requests over HTTPS are proxied to the Elastic Beanstalk backend without Mixed Content or CORS issues:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "http://subscribby-api-env.eba-xyim8qvr.ap-south-1.elasticbeanstalk.com/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
