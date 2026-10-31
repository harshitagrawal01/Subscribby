import { z } from 'zod'
import { trimmed } from '@/lib/validation'
import { type LineFieldErrors, type MappedErrors } from './errors'

const lineSchema = z.object({
  productId: z.string({ error: 'Choose a product' }).min(1, 'Choose a product'),
  variantId: z.string().nullable(),
  quantity: z.number({ error: 'Enter a quantity' }).int('Whole numbers only').min(1, 'At least 1'),
  unitPrice: z.number().int().min(0, "Can't be negative").nullable(),
})

export const linesSchema = z.array(lineSchema).min(1, 'Add at least one line')

/** Turn zod issues into the same shape as API errors, so both show on the same inputs. */
export function issuesToErrors(error: z.ZodError | undefined): MappedErrors {
  const out: MappedErrors = { fields: {}, lines: {}, linesError: null, formError: null }
  if (!error) return out
  for (const issue of error.issues) {
    const [head, index, key] = issue.path as (string | number)[]
    if (head === 'lines' && typeof index === 'number' && key) {
      const row = out.lines[index] ?? {}
      if (!row[key as keyof LineFieldErrors]) row[key as keyof LineFieldErrors] = issue.message
      out.lines[index] = row
    } else if (head === 'lines') {
      out.linesError ??= issue.message
    } else if (typeof head === 'string' && !out.fields[head]) {
      out.fields[head] = issue.message
    }
  }
  return out
}

export function mergeErrors(...all: MappedErrors[]): MappedErrors {
  const out: MappedErrors = { fields: {}, lines: {}, linesError: null, formError: null }
  for (const e of all) {
    Object.assign(out.fields, e.fields)
    for (const [k, v] of Object.entries(e.lines)) out.lines[Number(k)] = { ...out.lines[Number(k)], ...v }
    out.linesError = e.linesError ?? out.linesError
    out.formError = e.formError ?? out.formError
  }
  return out
}

/** The quote builder's own checks. The API re-checks everything (plan minimums, availability). */
export const quoteSchema = z
  .object({
    customerId: z.string({ error: 'Choose a customer' }).min(1, 'Choose a customer'),
    planId: z.string({ error: 'Choose a template or a plan' }).min(1, 'Choose a template or a plan'),
    startDate: z.string({ error: 'Pick a start date' }).min(1, 'Pick a start date'),
    expiryDate: z.string({ error: 'Pick an expiry date' }).min(1, 'Pick an expiry date'),
    paymentTermDays: z.string().min(1, 'Choose payment terms'),
    salespersonId: z.string().nullable(),
    notes: trimmed().max(4000, 'Keep notes under 4,000 characters'),
    lines: linesSchema,
  })
  .refine((v) => !v.startDate || !v.expiryDate || v.expiryDate >= v.startDate, {
    path: ['expiryDate'],
    message: 'Must be on or after the start date',
  })
