import type { StaffRole } from '@/lib/api/types'
import { ROLE_LABELS } from '@/lib/labels'
import { PASSWORD_RULES } from '@/lib/validation'

/** Staff access levels in the order an admin thinks about them, with what each can do. */
export const ACCESS_LEVELS: { value: StaffRole; label: string; description: string }[] = [
  { value: 'staff', label: ROLE_LABELS.staff, description: 'Customers, quotations, subscriptions and invoices' },
  { value: 'finance', label: ROLE_LABELS.finance, description: 'Reads everything, records payments, sends reminders, runs reports' },
  { value: 'admin', label: ROLE_LABELS.admin, description: 'Everything, plus catalog, taxes, discounts and users' },
]

export const ACCESS_LEVEL_OPTIONS = ACCESS_LEVELS.map(({ value, label }) => ({ value, label }))

/** Friendly copy for the one error an admin can hit by accident. */
export const LAST_ADMIN_MESSAGE = 'Subscribby needs at least one active admin. Make someone else an admin first, then try again.'

// No look-alike characters (0/O, 1/l/I) so a password read out loud or copied by hand still works.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'
const SPECIAL = '!@#$%&*?'

function pick(set: string, random: number) {
  return set[random % set.length]
}

/** A random 14-character temporary password that always passes the password rule. */
export function generatePassword(length = 14): string {
  const all = UPPER + LOWER + DIGITS + SPECIAL
  for (;;) {
    const random = crypto.getRandomValues(new Uint32Array(length + length))
    const chars = [pick(UPPER, random[0]), pick(LOWER, random[1]), pick(DIGITS, random[2]), pick(SPECIAL, random[3])]
    for (let i = chars.length; i < length; i++) chars.push(pick(all, random[i]))
    // Fisher–Yates shuffle with the second half of the random values.
    for (let i = chars.length - 1; i > 0; i--) {
      const j = random[length + i] % (i + 1)
      ;[chars[i], chars[j]] = [chars[j], chars[i]]
    }
    const value = chars.join('')
    if (PASSWORD_RULES.every((rule) => rule.test(value))) return value
  }
}
