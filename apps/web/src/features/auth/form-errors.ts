import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { isApiError } from '@/lib/api/client'

/**
 * Puts server field errors (error.details) on the matching inputs.
 * Returns a message for the form-level alert when the error isn't about one field.
 */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: Path<T>[]) {
  if (!isApiError(error)) return 'Something went wrong. Try again.'
  let placed = false
  for (const detail of error.details) {
    if ((fields as string[]).includes(detail.field)) {
      setError(detail.field as Path<T>, { message: detail.message })
      placed = true
    }
  }
  return placed ? null : error.message
}
