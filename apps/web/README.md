# Subscribby web

React web app for Subscribby: the **customer site** (sign up, log in, see subscriptions and invoices) and the **staff console** (admin, internal staff, finance lead). Built for the Odoo hackathon, where the client is the fictional **Brightloop Software**.

The backend lives in `apps/api` (Express + MongoDB). Until it's ready, `mock-api/` here serves the same API from memory.

## Run it

Requires Node 22.9+ (see `.nvmrc`). Everything runs from this folder.

```bash
cd apps/web
npm install           # first time only
npm run staff-path    # first time only: creates your private staff console URL and prints it
npm run dev:all       # mock API on http://localhost:4000 + web app on http://localhost:5173
```

Then open:

- Customer site: http://localhost:5173/login (or `/signup`)
- Staff console: the URL printed by `npm run staff-path` (also saved as a comment in `.env.local`)

Other commands:

| Command | Does |
| --- | --- |
| `npm run dev` | Web app only (use with the real backend) |
| `npm run mock` / `npm run dev:mock` | Mock API only (`dev:mock` restarts on changes) |
| `npm run mock:smoke` | Checks a running mock end to end |
| `npm run typecheck` / `npm run lint` / `npm run build` | Checks and production build |

Reset the mock's data with `curl -X POST localhost:4000/api/v1/__mock/reset`. Emails it would have sent (reset links) are at http://localhost:4000/api/v1/__mock/emails.

The app calls `/api/v1/...` on its own origin. In development Vite forwards that to port 4000 (`VITE_API_PROXY_TARGET` in `.env.local`); in production CloudFront routes it to Elastic Beanstalk.

### Using the real backend instead of the mock

Stop the mock, start the API on port 4000 (`docker compose up` from the repo root), and run `npm run dev`. Both use the same routes and response shapes, so the app shouldn't notice.

## Test accounts (seeded by the mock)

| Role | Log in at | Email | Password |
| --- | --- | --- | --- |
| Admin | staff console | `admin@brightloop.test` | `Admin@2026!` |
| Internal staff | staff console | `riya@brightloop.test` | `Staff@2026!` |
| Finance lead | staff console | `meera@brightloop.test` | `Finance@2026!` |
| Customer (Acme Ltd) | `/login` | `billing@acme.test` | `Customer@2026!` |
| Customer (Kite Stores) | `/login` | `asha@kite.test` | `Customer@2026!` |

`new.staff@brightloop.test` / `Welcome@2026!` must change its password on first login; `karan@brightloop.test` / `Staff@2026!` is disabled. Full list in `mock-api/README.md`.

## Structure

Vite + React 19 + TypeScript, Mantine UI, React Router, TanStack Query, react-hook-form + zod.

```text
apps/web/
  src/
    lib/api/types.ts       Types that mirror the spec (money in paise, dates as YYYY-MM-DD)
    lib/api/client.ts      fetch wrapper: Bearer token, error envelope → ApiError, session errors
    lib/api/endpoints.ts   One typed function per endpoint, grouped by area
    lib/format.ts          formatMoney (paise → ₹), dates
    lib/validation.ts      Password rule (spec section 5), email
    features/auth/         AuthProvider, guards, staff path gate, login/sign-up/forgot/reset/set-password pages
    layouts/               StaffLayout (role-based sidebar), PortalLayout
    pages/staff/           Staff console screens
    pages/portal/          Customer portal screens
    router.tsx             All routes, both portals
  mock-api/                In-memory mock of the backend (see its README)
  scripts/staff-path.mjs   Generates the private staff console path
```

## Routes

| Customer site | Staff console |
| --- | --- |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | `/<secret>/login`, `/<secret>/forgot-password`, `/<secret>/reset-password` (no sign-up) |
| `/set-password` (forced change) | `/<secret>/set-password` (forced change after a temporary password) |
| `/portal/subscriptions`, `/portal/invoices`, `/portal/profile` | `/<secret>/dashboard`, `/<secret>/subscriptions`, `/<secret>/invoices`, `/<secret>/payments`, `/<secret>/customers`, `/<secret>/products`, `/<secret>/plans`, `/<secret>/templates`, `/<secret>/profile` |
| | Admin only: `/<secret>/taxes`, `/<secret>/discounts`, `/<secret>/users`, `/<secret>/users/import` |

## Staff console URL

The staff console has no guessable address like `/staff` or `/admin`. It lives under a random 16-character path segment, for example `/x7k2m9q4v8p3t6wz/login`.

- `npm run staff-path` makes a new segment. It writes only its **SHA-256** to `.env.local` (`VITE_STAFF_PATH_HASH`) and the path to `mock-api/.env` (`STAFF_PORTAL_PATH`, for staff reset-password links). Both files are gitignored, so everyone on the team runs it once (or shares the same segment privately).
- The app checks the first path segment against the hash (`features/auth/staff-base.ts`, `StaffGate.tsx`). The segment never appears in the JavaScript bundle, and `robots.txt` doesn't mention it.
- `/staff/login`, `/admin` or any wrong segment shows the same 404 page as any unknown URL, so probing reveals nothing.
- Customer pages never link to the console. Staff get the URL from the admin.
- **Production:** build with `VITE_STAFF_PATH_HASH`, and give the API `STAFF_PORTAL_PATH` so staff reset emails link to the right place. Rotate by generating a new segment and updating both.
- This is an extra layer, not the security itself. `POST /api/v1/auth/staff/login` can still be called directly, so the backend keeps its rate limits, generic `INVALID_CREDENTIALS` errors and role checks.

## Status

- **Done:** project setup, API layer, the login system (both portals, sign-up, forgot and reset, forced password change, role guards, private staff path), both layouts, Dashboard (live numbers) and the Subscriptions list (reference pattern for list screens).
- **To build:** every other screen. Each one is a placeholder that lists what it must show and which endpoints it uses; open it in the app to see its checklist.

## Conventions

- Never compute prices or totals in the browser. Subscription and invoice totals come from the API (`POST /subscriptions/preview` for live quotes).
- Money is paise everywhere in code; convert only in inputs (`rupeesToPaise`) and display (`formatMoney`).
- Show buttons from `allowedActions` in the response, not from your own status logic.
- List filters live in the URL (`useSearchParams`), as in `pages/staff/SubscriptionsPage.tsx`.
- Server field errors: `applyServerErrors(error, setError, fields)` puts `error.details` on the right inputs.
