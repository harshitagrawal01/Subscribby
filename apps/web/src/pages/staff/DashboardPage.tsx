import { Anchor, Card, Group, SegmentedControl, SimpleGrid, Table, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { staffPath } from '@/features/auth/staff-base'
import { QueryState } from '@/components/QueryState'
import { invoicesApi, paymentsApi, reportsApi } from '@/lib/api/endpoints'
import { formatDate, formatMoney, formatMoneyCompact } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/labels'

const RANGES = {
  this_month: () => ({ from: dayjs().startOf('month'), to: dayjs().endOf('month') }),
  last_month: () => ({ from: dayjs().subtract(1, 'month').startOf('month'), to: dayjs().subtract(1, 'month').endOf('month') }),
  last_90: () => ({ from: dayjs().subtract(89, 'day'), to: dayjs() }),
}
type RangeKey = keyof typeof RANGES

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card withBorder radius="md" p="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Text fz={26} fw={700} className="num" mt={4}>
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Card>
  )
}

export function DashboardPage() {
  const [range, setRange] = useState<RangeKey>('this_month')
  const { from, to } = RANGES[range]()
  const filters = { from: from.format('YYYY-MM-DD'), to: to.format('YYYY-MM-DD') }

  const summary = useQuery({ queryKey: ['reports', 'summary', filters], queryFn: () => reportsApi.summary(filters) })
  const overdue = useQuery({
    queryKey: ['invoices', { overdue: true, sort: 'dueDate', limit: 5 }],
    queryFn: () => invoicesApi.list({ overdue: true, sort: 'dueDate', limit: 5 }),
  })
  const payments = useQuery({
    queryKey: ['payments', { sort: '-paymentDate', limit: 5 }],
    queryFn: () => paymentsApi.list({ sort: '-paymentDate', limit: 5 }),
  })
  const s = summary.data

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Active subscriptions, revenue, what's owed and what's overdue."
        actions={
          <SegmentedControl
            value={range}
            onChange={(v) => setRange(v as RangeKey)}
            data={[
              { label: 'This month', value: 'this_month' },
              { label: 'Last month', value: 'last_month' },
              { label: 'Last 90 days', value: 'last_90' },
            ]}
          />
        }
      />

      <QueryState isLoading={summary.isLoading} error={summary.error} />
      {s && (
        <SimpleGrid cols={{ base: 2, md: 3, lg: 6 }} mb="lg">
          <Kpi label="Active subscriptions" value={s.activeSubscriptions.toLocaleString('en-IN')} hint={`${s.newSubscriptions} new in range`} />
          <Kpi label="MRR" value={formatMoneyCompact(s.mrr)} hint="Monthly recurring, before tax" />
          <Kpi label="Collected" value={formatMoneyCompact(s.revenueCollected)} hint="Payments in range" />
          <Kpi label="Invoiced" value={formatMoneyCompact(s.invoicedAmount)} hint="Confirmed + paid in range" />
          <Kpi label="Outstanding" value={formatMoneyCompact(s.outstandingAmount)} hint="Unpaid right now" />
          <Kpi label="Overdue" value={formatMoneyCompact(s.overdueAmount)} hint={`${s.overdueCount} invoices`} />
        </SimpleGrid>
      )}

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder radius="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Overdue invoices</Title>
            <Anchor component={Link} to={staffPath('/invoices?overdue=true')} size="sm">
              See all
            </Anchor>
          </Group>
          <QueryState isLoading={overdue.isLoading} error={overdue.error} />
          {overdue.data && (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Invoice</Table.Th>
                  <Table.Th>Customer</Table.Th>
                  <Table.Th>Days late</Table.Th>
                  <Table.Th ta="right">Balance</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {overdue.data.data.map((inv) => (
                  <Table.Tr key={inv.id}>
                    <Table.Td>
                      <Anchor component={Link} to={staffPath(`/invoices/${inv.id}`)} size="sm">
                        {inv.number}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>{inv.customer.name}</Table.Td>
                    <Table.Td c="red">{inv.daysOverdue}</Table.Td>
                    <Table.Td ta="right" className="num">
                      {formatMoney(inv.balance)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>

        <Card withBorder radius="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Recent payments</Title>
            <Anchor component={Link} to={staffPath('/payments')} size="sm">
              See all
            </Anchor>
          </Group>
          <QueryState isLoading={payments.isLoading} error={payments.error} />
          {payments.data && (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Customer</Table.Th>
                  <Table.Th>Method</Table.Th>
                  <Table.Th ta="right">Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {payments.data.data.map((p) => (
                  <Table.Tr key={p.id}>
                    <Table.Td>{formatDate(p.paymentDate)}</Table.Td>
                    <Table.Td>{p.customer?.name ?? '—'}</Table.Td>
                    <Table.Td>{PAYMENT_METHOD_LABELS[p.method]}</Table.Td>
                    <Table.Td ta="right" className="num">
                      {formatMoney(p.amount)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      </SimpleGrid>
      <Text size="xs" c="dimmed" mt="md">
        Still to add: revenue-by-month bar chart, subscriptions-by-plan donut, aging buckets (GET /reports/revenue-by-month,
        /reports/subscriptions-by-plan, /reports/aging), plan and customer filters, CSV export.
      </Text>
    </>
  )
}
