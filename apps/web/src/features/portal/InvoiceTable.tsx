import { Table, Text } from '@mantine/core'
import { useNavigate } from 'react-router'
import { InvoiceStatusBadge } from '@/components/StatusBadge'
import type { InvoiceListItem } from '@/lib/api/types'
import { formatDate, formatMoney } from '@/lib/format'
import { tokens } from '@/theme'
import { overdueText } from './format'

/** Customer-facing invoice list. Whole row opens the invoice. */
export function InvoiceTable({ invoices, showSubscription = true }: { invoices: InvoiceListItem[]; showSubscription?: boolean }) {
  const navigate = useNavigate()
  return (
    <Table.ScrollContainer minWidth={720}>
      <Table className="data-table" verticalSpacing={13}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Invoice</Table.Th>
            {showSubscription && <Table.Th>Subscription</Table.Th>}
            <Table.Th>Invoice date</Table.Th>
            <Table.Th>Due</Table.Th>
            <Table.Th ta="right">Total</Table.Th>
            <Table.Th ta="right">Balance</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {invoices.map((inv) => (
            <Table.Tr
              key={inv.id}
              className="row-link"
              onClick={() => navigate(`/portal/invoices/${inv.id}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/portal/invoices/${inv.id}`)}
              tabIndex={0}
            >
              <Table.Td className="mono">{inv.number}</Table.Td>
              {showSubscription && (
                <Table.Td className="mono" c="dimmed">
                  {inv.subscription.number}
                </Table.Td>
              )}
              <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDate(inv.invoiceDate)}</Table.Td>
              <Table.Td style={{ whiteSpace: 'nowrap' }}>
                {formatDate(inv.dueDate)}
                {inv.isOverdue && (
                  <Text span size="xs" c={tokens.status.bad} fw={500} ml={8} className="num">
                    {overdueText(inv.daysOverdue)}
                  </Text>
                )}
              </Table.Td>
              <Table.Td ta="right" className="num">
                {formatMoney(inv.total)}
              </Table.Td>
              <Table.Td ta="right" className="num" fw={inv.balance > 0 && inv.status === 'confirmed' ? 500 : undefined}>
                {inv.status === 'cancelled' ? '—' : formatMoney(inv.balance)}
              </Table.Td>
              <Table.Td>
                <InvoiceStatusBadge status={inv.status} overdue={inv.isOverdue} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
