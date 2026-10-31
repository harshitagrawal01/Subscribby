import type { Address, BillingPeriod } from '@/lib/api/types'

const PERIOD_WORD: Record<BillingPeriod, string> = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }

/** "monthly" → "month", for "₹2,950.00 per month". */
export const periodWord = (period: BillingPeriod) => PERIOD_WORD[period]

/** Payment terms as a customer would say them. */
export const paymentTermsText = (days: number) => (days === 0 ? 'Due on receipt' : `Due ${days} days after the invoice date`)

/** Address lines without blanks: ["69, FC Road", "Pune, Maharashtra 411001", "India"]. */
export function addressLines(address: Address | undefined | null): string[] {
  if (!address) return []
  const cityLine = [address.city, [address.state, address.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const country = address.country === 'IN' ? 'India' : address.country
  return [address.line1, address.line2, cityLine, country].filter((l): l is string => Boolean(l && l.trim()))
}

/** "1 day overdue" / "12 days overdue" */
export const overdueText = (days: number) => `${days} ${days === 1 ? 'day' : 'days'} overdue`
