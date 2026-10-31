import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { isApiError } from '@/lib/api/client'

/**
 * Like applyServerErrors, but understands nested API field names:
 * "variants[2].attribute" lands on the form field "variants.2.attribute",
 * and `aliases` maps API names to form names ("appliesTo.productIds" → "productIds").
 * Returns a message for the form-level alert when nothing could be placed on a field.
 */
export function placeServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: string[],
  aliases: Record<string, string> = {},
) {
  if (!isApiError(error)) return 'Something went wrong. Try again.'
  const unplaced: string[] = []
  let placed = false
  for (const detail of error.details) {
    const normalized = detail.field.replace(/\[(\d+)\]/g, '.$1')
    const alias = Object.keys(aliases).find((key) => normalized === key || normalized.startsWith(`${key}.`))
    // "appliesTo.productIds.0" (one bad id) lands on the whole "productIds" picker.
    const name = alias ? aliases[alias] : normalized
    const known = fields.some((f) => name === f || name.startsWith(`${f}.`))
    if (known) {
      setError(name as Path<T>, { type: 'server', message: detail.message })
      placed = true
    } else {
      unplaced.push(`${detail.field}: ${detail.message}`)
    }
  }
  if (unplaced.length) return `${error.message}. ${unplaced.join('; ')}`
  return placed ? null : error.message
}
