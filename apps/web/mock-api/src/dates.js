// Calendar-date helpers. Dates are "YYYY-MM-DD" strings (they sort correctly as strings).
// Arithmetic follows date-fns semantics (addMonths clamps to the end of the month).
import { config } from './config.js';

const istFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in Asia/Kolkata (or MOCK_TODAY). */
export function today() {
  return config.mockToday || istFormatter.format(new Date());
}

function parse(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fmt(d) {
  return d.toISOString().slice(0, 10);
}

export function isValidDate(s) {
  return typeof s === 'string' && DATE_RE.test(s) && fmt(parse(s)) === s;
}

export function addDays(s, n) {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

export function addMonths(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return fmt(new Date(Date.UTC(ny, nm, Math.min(d, lastDay))));
}

export const addYears = (s, n) => addMonths(s, 12 * n);
export const addWeeks = (s, n) => addDays(s, 7 * n);

export function addPeriod(s, period, n = 1) {
  switch (period) {
    case 'daily':
      return addDays(s, n);
    case 'weekly':
      return addWeeks(s, n);
    case 'monthly':
      return addMonths(s, n);
    case 'yearly':
      return addYears(s, n);
    default:
      throw new Error(`Unknown billing period ${period}`);
  }
}

/** Last day of the billing period that starts on `start`. */
export function periodEndFor(start, period) {
  return addDays(addPeriod(start, period, 1), -1);
}

/** a − b in days. */
export function diffDays(a, b) {
  return Math.round((parse(a) - parse(b)) / 86400000);
}

export const maxDate = (a, b) => (a > b ? a : b);
export const minDate = (a, b) => (a < b ? a : b);

/** ISO timestamp without milliseconds: "2026-10-31T09:30:00Z". */
export function toIso(d) {
  return new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
export const nowIso = () => toIso(Date.now());

/** ISO UTC timestamp for a wall-clock time in IST on the given date. */
export function istTimestamp(dateStr, hhmm = '10:00') {
  const [h, mi] = hhmm.split(':').map(Number);
  const d = parse(dateStr);
  d.setUTCHours(h, mi - 330, 0, 0);
  return toIso(d);
}

/** IST calendar date of an ISO timestamp. */
export function istDateOf(iso) {
  return istFormatter.format(new Date(iso));
}
