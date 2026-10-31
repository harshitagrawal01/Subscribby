const { addDays, addWeeks, addMonths, addYears, differenceInCalendarDays, parseISO, format } = require("date-fns");

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns today's calendar date in Asia/Kolkata (IST) as "YYYY-MM-DD".
 */
function todayIST(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

function isValidDateString(str) {
  if (typeof str !== "string" || !DATE_REGEX.test(str)) return false;
  const d = parseISO(str);
  return !isNaN(d.getTime()) && format(d, "yyyy-MM-dd") === str;
}

function addDaysStr(dateStr, days) {
  const d = parseISO(dateStr);
  return format(addDays(d, days), "yyyy-MM-dd");
}

/**
 * Computes periodEnd = periodStart + 1 billing period - 1 day
 */
function computePeriodEnd(periodStartStr, billingPeriod) {
  const start = parseISO(periodStartStr);
  let nextStart;
  switch (billingPeriod) {
    case "daily":
      nextStart = addDays(start, 1);
      break;
    case "weekly":
      nextStart = addWeeks(start, 1);
      break;
    case "monthly":
      nextStart = addMonths(start, 1);
      break;
    case "yearly":
      nextStart = addYears(start, 1);
      break;
    default:
      nextStart = addMonths(start, 1);
  }
  return format(addDays(nextStart, -1), "yyyy-MM-dd");
}

function defaultExpiryDate(startDateStr) {
  const start = parseISO(startDateStr);
  return format(addDays(addYears(start, 1), -1), "yyyy-MM-dd");
}

function daysBetween(laterDateStr, earlierDateStr) {
  return differenceInCalendarDays(parseISO(laterDateStr), parseISO(earlierDateStr));
}

module.exports = {
  DATE_REGEX,
  todayIST,
  isValidDateString,
  addDaysStr,
  computePeriodEnd,
  defaultExpiryDate,
  daysBetween,
};
