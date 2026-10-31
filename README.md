# Subscribby

Subscription management for a business that bills every month: products and plans, quotations that turn into subscriptions, automatic invoices, payments, taxes, discounts, and a dashboard for the finance lead. Built for the Odoo hackathon, with **Brightloop Software** as the sample business.

## Try it live

| What | Link |
| --- | --- |
| Customer site (log in) | https://subscribby.vercel.app/login |
| Customer sign-up | https://subscribby.vercel.app/signup |
| Staff console (admin, staff, finance lead) | https://subscribby.vercel.app/an2hyjzjaweeyuur/login |
| API health check | https://subscribby.vercel.app/api/v1/health |

The staff console deliberately has no guessable address like `/staff` or `/admin`; those show a normal 404. Staff use the link above. Customers and staff have separate login pages, and an account only works on its own page.

## Test accounts

| Role | Log in at | Email | Password |
| --- | --- | --- | --- |
| Admin | Staff console | `admin@brightloop.test` | `Admin@2026!` |
| Internal staff | Staff console | `riya@brightloop.test` | `Staff@2026!` |
| Finance lead | Staff console | `meera@brightloop.test` | `Finance@2026!` |
| Customer (Kite Stores) | Customer site | `asha@kite.test` | `Customer@2026!` |
| Customer (Acme Ltd) | Customer site | `billing@acme.test` | `Customer@2026!` |

What each role can do:

- **Admin:** everything, including products, plans, taxes, discounts, and adding staff (one by one or by CSV import).
- **Internal staff:** day-to-day work: quotations, subscriptions, invoices, payments, customers.
- **Finance lead:** dashboard and reports, recording payments, sending invoices. Read-only on subscriptions and the catalog.
- **Customer:** their own subscriptions and invoices only, and accepting or declining quotations.

## A quick tour

1. **Customer:** log in as `asha@kite.test`. The home page shows the amount due, the next payment and a quotation waiting for a reply. Open it and accept or decline.
2. **Staff:** log in as `riya@brightloop.test`, go to Subscriptions → New quotation, pick a customer and a quotation template, and watch the price update as you change seats. Save it, then send, confirm and activate it.
3. **Billing day:** as admin, open Invoices → Run billing. It previews what will be created before doing anything, and running it twice never bills the same period twice.
4. **Money in:** open an invoice, record a part payment, then the rest, and watch it turn Paid.
5. **Finance:** log in as `meera@brightloop.test` for the dashboard: outstanding and overdue amounts, revenue by month, subscriptions by plan, and CSV export.
6. **Users:** as admin, Users → Import from CSV with `docs/samples/sample-users.csv` (or the invalid one to see row-by-row errors). Imported users must set their own password at first login.

Passwords must be more than 8 characters with an uppercase letter, a lowercase letter and a special character. Forgot password sends a reset link by email.

## What's in the repo

```text
apps/
  api/      Express + MongoDB backend (deployed on AWS Elastic Beanstalk, database on MongoDB Atlas)
  web/      React website: customer site + staff console (deployed on Vercel)
  mobile/   Kotlin Multiplatform customer app for Android, iOS and desktop
docs/
  api/      Postman collection and backend handoff notes
  samples/  Sample CSV files for the user import
```

## Run it locally

**Website** (talks to the live API by default):

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev          # http://localhost:5173, same login links as above with localhost:5173
```

To use a local backend instead, set `VITE_API_PROXY_TARGET=http://localhost:4000` in `apps/web/.env.local`. `npm run dev:all` starts the website together with a built-in mock API that needs no database.

**Backend:**

```bash
docker compose up    # MongoDB + API on http://localhost:4000
# or, with MongoDB already running:
cd apps/api && npm install && npm run seed && npm run dev
npm test             # must-pass checks
```

**Mobile app:** open `apps/mobile` in Android Studio and run `androidApp`, or open `apps/mobile/iosApp/iosApp.xcodeproj` in Xcode. It points at the live API; see `apps/mobile/README.md` to use a local one.

## Built with

React, Vite, TypeScript, Mantine and TanStack Query on the web; Kotlin Multiplatform with Compose Multiplatform and Ktor on mobile; Node.js, Express and MongoDB (Mongoose) on the backend; Brevo for email; AWS Elastic Beanstalk, MongoDB Atlas and Vercel for hosting.
