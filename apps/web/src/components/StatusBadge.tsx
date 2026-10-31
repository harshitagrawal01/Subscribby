import { Group, Text } from '@mantine/core'
import type { InvoiceStatus, SubscriptionStatus } from '@/lib/api/types'
import { INVOICE_STATUS, SUBSCRIPTION_STATUS } from '@/lib/labels'

/** Status as a small dot and plain text. No pills. */
export function StatusText({ label, color }: { label: string; color: string }) {
  return (
    <Group gap={6} wrap="nowrap" component="span" style={{ display: 'inline-flex' }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 7, background: color, flex: 'none' }} />
      <Text span size="sm" c={color} fw={500}>
        {label}
      </Text>
    </Group>
  )
}

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return <StatusText {...SUBSCRIPTION_STATUS[status]} />
}

export function InvoiceStatusBadge({ status, overdue }: { status: InvoiceStatus; overdue?: boolean }) {
  return <StatusText {...INVOICE_STATUS[overdue ? 'overdue' : status]} />
}
