import type { QueryClient } from '@tanstack/react-query'

/** Money moved or an invoice changed: refresh every list and figure that depends on it. */
export function invalidateBilling(queryClient: QueryClient) {
  for (const key of ['invoices', 'payments', 'reports', 'customers', 'subscriptions', 'billing']) {
    queryClient.invalidateQueries({ queryKey: [key] })
  }
}
