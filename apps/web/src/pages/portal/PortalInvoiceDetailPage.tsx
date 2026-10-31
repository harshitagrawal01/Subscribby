import { Anchor, Button, Group, Stack, Text } from '@mantine/core'
import { IconArrowLeft, IconPrinter } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { QueryState } from '@/components/QueryState'
import { overdueText } from '@/features/portal/format'
import { InvoicePaper } from '@/features/portal/InvoicePaper'
import classes from '@/features/portal/portal.module.css'
import { isApiError } from '@/lib/api/client'
import { portalApi } from '@/lib/api/endpoints'
import { formatDate, formatMoney } from '@/lib/format'
import { tokens } from '@/theme'

export function PortalInvoiceDetailPage() {
  const { id = '' } = useParams()
  const invoice = useQuery({ queryKey: ['portal', 'invoice', id], queryFn: () => portalApi.invoice(id) })
  const inv = invoice.data
  const notFound = isApiError(invoice.error) && invoice.error.code === 'NOT_FOUND'

  return (
    <>
      <Anchor component={Link} to="/portal/invoices" size="sm" c="dimmed" className={classes.back}>
        <IconArrowLeft size={14} stroke={1.5} /> Invoices
      </Anchor>

      {!inv ? (
        notFound ? (
          <Stack gap={6} className="panel" p={28}>
            <Text fw={500}>We can't find this invoice</Text>
            <Text size="sm" c="dimmed">
              It may belong to another account, or the link is incomplete.{' '}
              <Anchor component={Link} to="/portal/invoices">
                See your invoices
              </Anchor>
            </Text>
          </Stack>
        ) : (
          <div className="panel">
            <QueryState isLoading={invoice.isLoading} error={invoice.error} onRetry={() => invoice.refetch()} rows={8} what="this invoice" />
          </div>
        )
      ) : (
        <Stack gap={16} maw={880}>
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <Text size="sm">
              {inv.status === 'paid' ? (
                <Text span c={tokens.status.good} fw={500}>
                  Paid in full. Thank you.
                </Text>
              ) : inv.status === 'cancelled' ? (
                <Text span c="dimmed">
                  This invoice was cancelled. Nothing is owed on it.
                </Text>
              ) : inv.isOverdue ? (
                <>
                  <Text span c={tokens.status.bad} fw={500}>
                    {formatMoney(inv.balance)} is {overdueText(inv.daysOverdue)}.
                  </Text>{' '}
                  <Text span c="dimmed">
                    It was due on {formatDate(inv.dueDate)}.
                  </Text>
                </>
              ) : (
                <>
                  <Text span fw={500} className="num">
                    {formatMoney(inv.balance)}
                  </Text>{' '}
                  <Text span c="dimmed">
                    due by {formatDate(inv.dueDate)}.
                  </Text>
                </>
              )}
            </Text>
            <Button leftSection={<IconPrinter size={16} stroke={1.5} />} onClick={() => window.print()}>
              Print or save as PDF
            </Button>
          </Group>
          <InvoicePaper invoice={inv} />
        </Stack>
      )}
    </>
  )
}
