# Subscribby mock API

An in-memory mock of the Subscribby API.
It follows the spec's paths, request and response shapes, error codes, role rules, status transitions and pricing rules, so
the React web app and the KMP mobile app can be built now. When the real Express + MongoDB backend is ready, it takes over
the same port and the frontends need no changes.

There is no database. All data lives in memory and is re-seeded on every start. The seed is deterministic (seeded PRNG)
and every date in it is relative to "today" in Asia/Kolkata, so overdue and expiring cases stay true whatever day you run it.

## Run

Everything runs from `apps/web` (the mock's dependencies are in the web app's `package.json`):

```bash
cd apps/web
npm install          # first time only
npm run mock         # http://localhost:4000/api/v1
npm run dev:mock     # same, restarts on file changes (node --watch)
npm run dev:all      # mock + web app together
npm run mock:smoke   # in a second terminal: checks a running mock end to end (resets data before and after)
```

Android emulator: `http://10.0.2.2:4000/api/v1`. Real phone: use your laptop's LAN IP.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Port to listen on |
| `WEB_URL` | `http://localhost:5173` | Base for reset links: customers get `/reset-password?token=…`, staff get `<STAFF_PORTAL_PATH>/reset-password?token=…` |
| `MOCK_DELAY_MS` | `0` | Adds this much latency to every request, so you can see loading states |
| `STAFF_PORTAL_PATH` | `/staff` | Secret staff console path used in staff reset-password links. Set by `npm run staff-path` in `apps/web` (writes `mock-api/.env`) |
| `CUSTOMER_SELF_SERVICE` | `false` | Turns on portal pause / resume / renew / close (spec section 13). When off, those routes return `403 FORBIDDEN` |
| `MOCK_TODAY` | (unset) | Mock only. Pretends "today" (IST) is this `YYYY-MM-DD` date, for both the seed and the business rules |
| `COMPANY_NAME`, `COMPANY_ADDRESS`, `COMPANY_TAX_ID`, `COMPANY_EMAIL` | Subscribby, … | Company details returned by `/meta` and printed on invoices |

## Test accounts

Seeded accounts don't have to change their password, except the extra one marked below.

| Role | Login page | Email | Password | Notes |
| --- | --- | --- | --- | --- |
| Admin | Staff console | `admin@brightloop.test` | `Admin@2026!` | Neha Kapoor |
| Staff | Staff console | `riya@brightloop.test` | `Staff@2026!` | Riya Sharma |
| Finance | Staff console | `meera@brightloop.test` | `Finance@2026!` | Meera Nair |
| Customer (Acme Ltd) | Customer site | `billing@acme.test` | `Customer@2026!` | Vikram Iyer. Has test case 1, an invoice 29 days overdue, and a draft (hidden in the portal) |
| Customer (Kite Stores) | Customer site | `asha@kite.test` | `Customer@2026!` | Asha Rao. Has test case 2 and a pending quotation to accept or reject |
| Staff, **temporary password** | Staff console | `new.staff@brightloop.test` | `Welcome@2026!` | Mock extra: `mustChangePassword: true`, for testing the forced-change flow |
| Staff, disabled | Staff console | `karan@brightloop.test` | `Staff@2026!` | Mock extra: login returns `403 ACCOUNT_DISABLED` |
| Staff | Staff console | `sanjay@brightloop.test` | `Staff@2026!` | Mock extra: a second salesperson |
| Customer, disabled (Lotus Traders) | Customer site | `accounts@lotustraders.test` | `Customer@2026!` | Mock extra: `portalStatus: "disabled"` |

Use the repo's `docs/samples/sample-users.csv` and `docs/samples/sample-users-invalid.csv` to try the import screen.

## What the seed contains

- **Catalog.** The products, plans, taxes, discounts and templates listed in spec section 15.
  - Plans: Pro Yearly and Basic Monthly as specified, plus Pro Monthly, Starter Weekly, Day Pass (daily) and Analytics Monthly. Legacy Monthly is no longer available, so it triggers `PLAN_NOT_AVAILABLE`.
  - Products: also an archived one.
  - Taxes: also an inactive one.
  - Discounts: one in each state (running ×2, expired, exhausted, scheduled, inactive).
  - Templates: a third one, Pro Monthly – Team.
- **Customers.** 50 fictional Indian companies with addresses and GSTIN-style tax ids. One is archived.
- **Subscriptions.** About 57, covering every status and every close reason:
  - a quotation expiring tomorrow
  - a quotation already past its validity
  - confirmed subscriptions starting in the future, and one whose start date has passed
  - two paused subscriptions
  - one past expiry on a plan without auto-close (`isExpired: true`)
  - one past expiry on an auto-close plan
- **Invoices and payments.** About 170 invoices over roughly 6 months, in every status, all priced with the pricing engine.
  - Overdue examples at exactly 5, 29 and 75 days, plus a spread across the aging buckets.
  - Partly paid invoices, and cancelled-and-reissued ones.
  - About 150 payments with mixed methods.
  - Discount `usedCount` values come from the invoices that applied them.
- **Work for the first billing run.** It closes one expired quotation, activates one subscription and auto-closes one. It then creates about 7 invoices, including 3 for a weekly subscription that is 3 periods behind. A second run creates 0.

## Mock-only endpoints (not in the real API, no auth)

| Method | Path | Does |
| --- | --- | --- |
| POST | `/api/v1/__mock/reset` | Wipes everything and re-seeds. Tokens you already have keep working, because seeded ids are deterministic. |
| GET | `/api/v1/__mock/emails` | The emails that would have been sent through Brevo, newest first: password resets, quotations, invoices. Filters: `?to=email&type=password_reset\|quotation\|invoice` |

## Interpretations and deviations from the spec

I kept these to a minimum. Each one is listed here.

1. **One discount per invoice (agreed with the backend, replaces the spec's stacking wording).** Of every discount that qualifies on the invoice date, only the one that saves the most in total is applied; nothing else applies, and only that discount uses up a use.
   - A product discount applies to every line it qualifies for (line quantity ≥ `minQuantity`, invoice subtotal ≥ `minPurchaseAmount`). Its savings = the sum over those lines.
   - A subscription discount qualifies on total quantity and invoice subtotal, and is split across lines in proportion to their subtotals (rounding remainder to the largest line).
   - Ties: a product discount beats a subscription discount; then the older discount wins.
   - Test case 1 (Acme): Bulk seats saves ₹11,400 vs Launch ₹500 → total `12814800`. Test case 2 (Kite): only Launch qualifies → total `295000`.
2. **Tokens** are opaque random strings (`mock.<hex>`) kept in memory, not JWTs. They last 7 days.
   - Password change, reset and admin reset invalidate older tokens.
   - Restarting the server logs everyone out. `__mock/reset` does not.
3. **No rate limiting** (`429 RATE_LIMITED` is never returned). There is no bcrypt either: passwords use salted sha256.
4. **CORS allows any origin** instead of `CORS_ORIGINS`.
5. **`devResetUrl`** is always included in the forgot-password response when a link was generated, like `NODE_ENV=development` in the real API. There is no link, and so no `devResetUrl`, when the email is unknown, the account is disabled, or the portal doesn't match the role.
6. **Pagination.** A `limit` above 100 is clamped to 100. A non-integer or `< 1` `page`/`limit` returns `400 VALIDATION_ERROR`. `sort` works on any field of the response item, including dotted paths like `customer.name`. Default sorts:
   - `name` for products, plans, templates, taxes, customers and users
   - `-createdAt` for subscriptions and discounts
   - `-invoiceDate,-number` for invoices
   - `-paymentDate` for payments
7. **Defaults the spec leaves open:**
   - `POST /subscriptions`: `startDate` defaults to today, and `paymentTermDays` to the template's value, or 30.
   - `salespersonId` defaults to the creating admin or staff user.
   - `POST /payments`: `paymentDate` defaults to today.
   - `POST /users/import`: `dryRun` defaults to `true`.
   - Template `validityDays` defaults to 14.
8. **Unknown or malformed ids** in a URL return `404 NOT_FOUND`. A missing `invoiceId` on `POST /payments` returns `404 NOT_FOUND` too.
9. **Locked fields.**
   - A PATCH that *changes* a field locked in the current status returns `409 NOT_EDITABLE`. Sending the same value back is accepted, so forms can send the whole object.
   - Changing `unitPrice` once a subscription is past Quotation also returns `409 NOT_EDITABLE`.
   - `DELETE` on a non-draft subscription returns `409 NOT_EDITABLE`.
10. **`allowedActions`** follow the "Allowed when" column strictly:
    - `createInvoice` only appears when the next period starts on or before `expiryDate`. Acme's yearly subscription therefore shows `["edit", "renew"]`, not the spec example's `createInvoice`.
    - `cancel` is hidden on invoices that already have payments.
11. **Extra response fields** (additive only):
    - Subscriptions: `recurringNet` and `isExpired` in list items.
    - Plans: `product.variants` in list items.
    - Invoices: invoice lines carry both `description` and the subscription-style fields (`productName`, `variantLabel`, …).
    - Payments: `subscription` ref.
    - Users: `createdBy`/`passwordChangedAt`.
    - `GET /discounts/:id` returns the same shape as the list (usage is `usedCount` + `remainingUses`).
    - Invoice `createdBy` is `"system"` or the creating user's id string.
12. **Reports.**
    - `/reports/aging` always returns all five buckets, with zeros where empty.
    - `/reports/revenue-by-month` defaults to the last 6 months, and also accepts `YYYY-MM-DD`.
    - `/billing/last-run` returns `{ "data": null }` before the first real run. Dry runs aren't saved.
13. **Billing run.** "Already invoiced" skips can't really happen in a single process; the check is still there and counts into `skippedAlreadyInvoiced`. History entries written by the billing run use `by: "system"`, even for manual runs.
14. **`PATCH /auth/me` for customers** accepts `companyName`, `contactName`, `phone`, `taxId` and `billingAddress`, either at the top level or inside a `customer` object.
15. **Health** answers `{ status, db, time }` without the `data` envelope, exactly as the spec shows.

## Code map

```
src/server.js            app, CORS, latency, routes, listen
src/config.js            env vars
src/store.js             in-memory collections, ids, SUB/INV numbering, snapshot for dry runs
src/dates.js             IST "today", date-fns style date maths
src/http.js              error codes, envelopes, validator, pagination / sort helpers
src/auth.js              passwords, tokens, authenticate / requireRole
src/pricing.js           priceLines(): the one pricing function (section 14)
src/billing.js           lifecycle + billing run (section 10)
src/mailer.js            captured emails (stands in for Brevo)
src/domain/*.js          subscription and invoice rules, actions and serializers
src/routes/*.js          one file per area of the spec
src/seed.js, seed-data.js  deterministic seed
scripts/smoke.mjs        end-to-end check against a running mock
```
