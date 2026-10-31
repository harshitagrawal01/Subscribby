import { isApiError } from '@/lib/api/client'
import { formatDate } from '@/lib/format'
import type { LineDraft } from './lines'

export type LineFieldErrors = Partial<Record<'productId' | 'variantId' | 'quantity' | 'unitPrice', string>>

export interface MappedErrors {
  /** Top-level fields: customerId, planId, startDate, expiryDate, paymentTermDays, salespersonId, notes. */
  fields: Record<string, string>
  /** Per editor row (index in the editor, not in the request). */
  lines: Record<number, LineFieldErrors>
  /** Problem with the lines as a whole ("Must include the plan's product"). */
  linesError: string | null
  /** Anything that isn't about one field. */
  formError: string | null
}

export const noErrors: MappedErrors = Object.freeze({ fields: Object.freeze({}), lines: Object.freeze({}), linesError: null, formError: null }) as MappedErrors

/** API messages carry "2026-12-31"; people read "31 Dec 2026". */
export const humanizeDates = (message: string) => message.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (d) => formatDate(d))

/**
 * Puts an API error from create / preview / PATCH on the right inputs.
 * indexMap[k] is the editor row that was sent as lines[k].
 */
export function mapSubscriptionError(
  error: unknown,
  ctx: { indexMap: number[]; lines: LineDraft[]; planProductId?: string },
): MappedErrors {
  if (!isApiError(error)) return { fields: {}, lines: {}, linesError: null, formError: 'Something went wrong. Try again.' }
  const out: MappedErrors = { fields: {}, lines: {}, linesError: null, formError: null }
  const message = humanizeDates(error.message)

  if (error.code === 'BELOW_MIN_QUANTITY') {
    const row = ctx.lines.findIndex((l) => l.productId && l.productId === ctx.planProductId)
    if (row >= 0) out.lines[row] = { quantity: message }
    else out.linesError = message
    return out
  }
  if (error.code === 'PLAN_NOT_AVAILABLE') {
    out.fields.startDate = message
    return out
  }

  for (const detail of error.details) {
    const text = humanizeDates(detail.message)
    const lineMatch = /^lines\[(\d+)\](?:\.(\w+))?$/.exec(detail.field)
    if (lineMatch) {
      const row = ctx.indexMap[Number(lineMatch[1])] ?? Number(lineMatch[1])
      const key = (lineMatch[2] ?? 'productId') as keyof LineFieldErrors
      out.lines[row] = { ...out.lines[row], [key === ('id' as string) ? 'productId' : key]: text }
    } else if (detail.field === 'lines') {
      out.linesError = text
    } else {
      out.fields[detail.field] = text
    }
  }
  const placed = Object.keys(out.fields).length || Object.keys(out.lines).length || out.linesError
  if (!placed) out.formError = message
  return out
}
