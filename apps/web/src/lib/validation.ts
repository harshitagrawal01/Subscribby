import { z } from 'zod'

/** Password rule from spec section 5: more than 8 characters, upper, lower, special. */
export const PASSWORD_RULES = [
  { id: 'length', label: 'More than 8 characters', test: (v: string) => v.length > 8 },
  { id: 'upper', label: 'An uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'A lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { id: 'special', label: 'A special character', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const

export const passwordSchema = z.string().superRefine((value, ctx) => {
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(value))
  if (missing.length) {
    ctx.addIssue({ code: 'custom', message: `Needs ${missing.map((r) => r.label.toLowerCase()).join(', ')}` })
  }
})

export const emailSchema = z.email('Enter a valid email')
