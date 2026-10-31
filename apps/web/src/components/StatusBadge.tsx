import { Badge } from '@mantine/core'
import type { InvoiceStatus, SubscriptionStatus } from '@/lib/api/types'
import { INVOICE_STATUS, SUBSCRIPTION_STATUS } from '@/lib/labels'

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const s = SUBSCRIPTION_STATUS[status]
  return (
    <Badge color={s.color} variant="light">
      {s.label}
    </Badge>
  )
}

export function InvoiceStatusBadge({ status, overdue }: { status: InvoiceStatus; overdue?: boolean }) {
  const s = INVOICE_STATUS[overdue ? 'overdue' : status]
  return (
    <Badge color={s.color} variant="light">
      {s.label}
    </Badge>
  )
}
