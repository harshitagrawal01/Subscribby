import { sha256Hex } from '@/lib/sha256'

/**
 * The staff console lives under a secret, random first path segment (e.g. /q7m2xk9vd4pt8wzr),
 * not a guessable /staff or /admin. The bundle only contains the SHA-256 of that segment
 * (VITE_STAFF_PATH_HASH), so reading the JavaScript doesn't reveal the URL.
 *
 * Obscurity is an extra layer, not the security: the API still enforces roles, rate limits
 * and generic login errors. See README → "Staff console URL".
 */
const EXPECTED_HASH = (import.meta.env.VITE_STAFF_PATH_HASH ?? '').trim().toLowerCase()
const STORAGE_KEY = 'subscribby.staffBase'

let staffBase: string | null = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
})()

/** True only for the real secret segment. Anything else renders the normal 404. */
export function isStaffSegment(segment: string | undefined): boolean {
  if (!EXPECTED_HASH || !segment) return false
  return sha256Hex(segment) === EXPECTED_HASH
}

/** Remember the verified base so links and redirects inside the console can be built. */
export function rememberStaffBase(segment: string) {
  const base = `/${segment}`
  if (staffBase === base) return
  staffBase = base
  try {
    localStorage.setItem(STORAGE_KEY, base)
  } catch {
    /* ignore */
  }
}

/** Absolute console URL: staffPath('/invoices') → '/<secret>/invoices'. Falls back to '/' if unknown. */
export function staffPath(path = ''): string {
  return staffBase ? `${staffBase}${path}` : '/'
}
