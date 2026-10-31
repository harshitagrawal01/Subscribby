// All environment configuration for the mock in one place.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const config = {
  port: Number(process.env.PORT || 4000),
  // Base for password-reset links (customer: /reset-password, staff: <STAFF_PORTAL_PATH>/reset-password).
  webUrl: (process.env.WEB_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  // Artificial latency (ms) added to every request, to exercise loading states.
  delayMs: Math.max(0, Number(process.env.MOCK_DELAY_MS || 0)),
  // Portal pause / resume / renew / close (spec section 13). Off by default.
  customerSelfService: process.env.CUSTOMER_SELF_SERVICE === 'true',
  // Mock-only: pretend "today" (IST) is this date. Useful for testing billing / overdue logic.
  mockToday: DATE_RE.test(process.env.MOCK_TODAY || '') ? process.env.MOCK_TODAY : null,
  // Secret path of the staff console (e.g. /q7m2xk9vd4pt8wzr). Generate with `npm run staff-path` in apps/web.
  staffPortalPath: '/' + (process.env.STAFF_PORTAL_PATH || '/staff').replace(/^\/+|\/+$/g, ''),
  company: {
    name: process.env.COMPANY_NAME || 'Subscribby',
    address:
      process.env.COMPANY_ADDRESS ||
      '4th Floor, Prestige Tech Park, Outer Ring Road, Bengaluru, Karnataka 560103, India',
    taxId: process.env.COMPANY_TAX_ID || '29AAKCB4821M1Z7',
    email: process.env.COMPANY_EMAIL || 'billing@subscribby.test',
  },
};
