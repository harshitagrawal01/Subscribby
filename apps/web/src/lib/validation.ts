import { z } from 'zod'

/** Password rule from the API: more than 8 characters, upper, lower, special. */
export const PASSWORD_RULES = [
  { id: 'length', label: 'More than 8 characters', test: (v: string) => v.length > 8 },
  { id: 'upper', label: 'An uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'A lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { id: 'special', label: 'A special character', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const

/**
 * New passwords are never trimmed silently (that would change what the person typed),
 * but a space at either end is almost always a mistake, so it's rejected with a clear message.
 */
export const passwordSchema = z.string().superRefine((value, ctx) => {
  if (value !== value.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Remove the space at the start or end' })
    return
  }
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(value))
  if (missing.length) {
    ctx.addIssue({ code: 'custom', message: `Needs ${missing.map((r) => r.label.toLowerCase()).join(', ')}` })
  }
})

/** Text inputs: leading and trailing spaces are always removed before validating or sending. */
export const trimmed = () => z.string().trim()

export const requiredText = (message: string) => trimmed().min(1, message)

export const emailSchema = trimmed().min(1, 'Enter your email').pipe(z.email("That email doesn't look right"))
