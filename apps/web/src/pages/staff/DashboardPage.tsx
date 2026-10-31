import { Anchor, Box, Button, Group, Select, Skeleton, Stack, Table, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { staffPath } from '@/features/auth/staff-base'
import { isApiError } from '@/lib/api/client'
import { invoicesApi, paymentsApi, reportsApi } from '@/lib/api/endpoints'
import type { AgingBucket, InvoiceListItem } from '@/lib/api/types'
import { formatDate, formatMoney } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/labels'
import { tokens } from '@/theme'

const RANGES = {
  this_month: { label: 'This month', get: () => ({ from: dayjs().startOf('month'), to: dayjs().endOf('month') }) },
  last_month: {
    label: 'Last month',
    get: () => ({ from: dayjs().subtract(1, 'month').startOf('month'), to: dayjs().subtract(1, 'month').endOf('month') }),
  },
  last_90: { label: 'Last 90 days', get: () => ({ from: dayjs().subtract(89, 'day'), to: dayjs() }) },
}
type RangeKey = keyof typeof RANGES

const AGING: Record<AgingBucket['bucket'], { label: string; color: string }> = {
  current: { label: 'Not due yet', color: '#9DB0C9' },
  '1-30': { label: '1–30 days late', color: '#C98A2B' },
  '31-60': { label: '31–60 days', color: '#B8642A' },
  '61-90': { label: '61–90 days', color: '#B4452E' },
  '90+': { label: 'Over 90 days', color: tokens.status.bad },
}

function AgingBar({ buckets }: { buckets: AgingBucket[] }) {
  const total = buckets.reduce((sum, b) => sum + b.amount, 0)
  if (!total) return null
  return (
    <Stack gap={12}>
      <div
        style={{ display: 'flex', height: 10, borderRadius: 2, overflow: 'hidden', background: tokens.line, gap: 2 }}
        role="img"
        aria-label="Outstanding amount by how late it is"
      >
        {buckets
          .filter((b) => b.amount > 0)
          .map((b) => (
            <div key={b.bucket} style={{ width: `${(b.amount / total) * 100}%`, background: AGING[b.bucket].color }} />
          ))}
      </div>
      <Group gap={20} wrap="wrap">
        {buckets.map((b) => (
          <div key={b.bucket}>
            <Group gap={6} wrap="nowrap">
              <span style={{ width: 8, height: 8, borderRadius: 1, background: AGING[b.bucket].color }} />
              <Text size="xs" c="dimmed">
                {AGING[b.bucket].label}
              </Text>
            </Group>
            <Text size="sm" className="num" mt={2}>
              {formatMoney(b.amount)}
            </Text>
          </div>
        ))}
      </Group>
    </Stack>
  )
}

function StatRow({ label, value, note, last }: { label: string; value: string; note?: string; last?: boolean }) {
  return (
    <Group
      justify="space-between"
      align="baseline"
      py={12}
      wrap="nowrap"
      style={{ borderBottom: last ? undefined : `1px solid ${tokens.line}` }}
    >
      <div>
        <Text size="sm">{label}</Text>
        {note && (
          <Text size="xs" c="dimmed">
            {note}
          </Text>
        )}
      </div>
      <Text className="num" fw={500}>
        {value}
      </Text>
    </Group>
  )
}

function SendReminder({ invoice }: { invoice: InvoiceListItem }) {
  const queryClient = useQueryClient()
  const send = useMutation({
    mutationFn: () => invoicesApi.send(invoice.id),
    onSuccess: () => {
      notifications.show({ message: `Reminder for ${invoice.number} sent to ${invoice.customer.name}` })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (error) =>
      notifications.show({ color: 'red', message: isApiError(error) ? error.message : 'Reminder not sent. Try again.' }),
  })
  return (
    <Button
      size="compact-xs"
      variant="subtle"
      color="ink"
      loading={send.isPending}
      onClick={(e) => {
        e.stopPropagation()
        send.mutate()
      }}
    >
      Send reminder
    </Button>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [range, setRange] = useState<RangeKey>('this_month')
  const { from, to } = RANGES[range].get()
  const filters = { from: from.format('YYYY-MM-DD'), to: to.format('YYYY-MM-DD') }

  const summary = useQuery({ queryKey: ['reports', 'summary', filters], queryFn: () => reportsApi.summary(filters) })
  const aging = useQuery({ queryKey: ['reports', 'aging'], queryFn: () => reportsApi.aging() })
  const overdue = useQuery({
    queryKey: ['invoices', { overdue: true, sort: '-daysOverdue', limit: 6 }],
    queryFn: () => invoicesApi.list({ overdue: true, sort: '-daysOverdue', limit: 6 }),
  })
  const payments = useQuery({
    queryKey: ['payments', { sort: '-paymentDate', limit: 6 }],
    queryFn: () => paymentsApi.list({ sort: '-paymentDate', limit: 6 }),
  })
  const s = summary.data
  const periodName = range === 'last_90' ? 'the last 90 days' : from.format('MMMM')

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${range === 'last_90' ? 'Last 90 days' : from.format('MMMM YYYY')} · updated ${dayjs().format('D MMM, h:mm A')}`}
        actions={
          <Select
            aria-label="Period"
            w={160}
            value={range}
            onChange={(v) => v && setRange(v as RangeKey)}
            allowDeselect={false}
            data={Object.entries(RANGES).map(([value, r]) => ({ value, label: r.label }))}
          />
        }
      />

      <div className="dash-grid">
        <section className="panel" style={{ padding: 24 }}>
          <Text size="sm" c="dimmed">
            Outstanding right now
          </Text>
          {s ? (
            <>
              <Text className="num" fz={36} fw={600} lh={1.1} mt={8} style={{ letterSpacing: '-0.02em' }}>
                {formatMoney(s.outstandingAmount)}
              </Text>
              <Text size="sm" mt={6}>
                <Text span c={tokens.status.bad} fw={500} className="num">
                  {formatMoney(s.overdueAmount)}
                </Text>{' '}
                of it is overdue, across {s.overdueCount} invoices.
              </Text>
            </>
          ) : (
            <Stack gap={10} mt={10}>
              <Skeleton h={34} w={280} />
              <Skeleton h={12} w={220} />
            </Stack>
          )}
          <Box mt="auto" pt={28}>
            <Text size="xs" c="dimmed" mb={10}>
              Unpaid amount by how late it is
            </Text>
            {aging.data ? <AgingBar buckets={aging.data} /> : <Skeleton h={10} />}
          </Box>
        </section>

        <section className="panel" style={{ padding: '4px 20px' }}>
          {s ? (
            <>
              <StatRow label="Collected" note={`Payments in ${periodName}`} value={formatMoney(s.revenueCollected)} />
              <StatRow label="Invoiced" note="Confirmed and paid invoices" value={formatMoney(s.invoicedAmount)} />
              <StatRow label="Monthly recurring revenue" note="Before tax" value={formatMoney(s.mrr)} />
              <StatRow
                label="Active subscriptions"
                note={`${s.newSubscriptions} started in ${periodName}`}
                value={String(s.activeSubscriptions)}
                last
              />
            </>
          ) : (
            <QueryState isLoading={summary.isLoading} error={summary.error} onRetry={() => summary.refetch()} rows={4} what="figures" />
          )}
        </section>

        <section className="panel">
          <Group justify="space-between" px={20} pt={16} pb={10}>
            <Title order={2} fz={15}>
              Overdue invoices
            </Title>
            <Anchor component={Link} to={staffPath('/invoices?overdue=true')} size="sm">
              All overdue
            </Anchor>
          </Group>
          <QueryState isLoading={overdue.isLoading} error={overdue.error} onRetry={() => overdue.refetch()} what="overdue invoices" />
          {overdue.data &&
            (overdue.data.data.length ? (
              <Table.ScrollContainer minWidth={560}>
                <Table className="data-table">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Invoice</Table.Th>
                      <Table.Th>Customer</Table.Th>
                      <Table.Th>Late by</Table.Th>
                      <Table.Th ta="right">Balance</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {overdue.data.data.map((inv) => (
                      <Table.Tr key={inv.id} className="row-link" onClick={() => navigate(staffPath(`/invoices/${inv.id}`))}>
                        <Table.Td className="mono">{inv.number}</Table.Td>
                        <Table.Td maw={200}>
                          <Text size="sm" truncate title={inv.customer.name}>
                            {inv.customer.name}
                          </Text>
                        </Table.Td>
                        <Table.Td className="num" c={tokens.status.bad} title={`Was due ${formatDate(inv.dueDate)}`}>
                          {inv.daysOverdue} {inv.daysOverdue === 1 ? 'day' : 'days'}
                        </Table.Td>
                        <Table.Td ta="right" className="num">
                          {formatMoney(inv.balance)}
                        </Table.Td>
                        <Table.Td ta="right" w={120}>
                          <SendReminder invoice={inv} />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            ) : (
              <Text size="sm" c="dimmed" px={20} pb={20}>
                Nothing overdue. Every confirmed invoice is paid or not yet due.
              </Text>
            ))}
        </section>

        <section className="panel">
          <Group justify="space-between" px={20} pt={16} pb={6}>
            <Title order={2} fz={15}>
              Latest payments
            </Title>
            <Anchor component={Link} to={staffPath('/payments')} size="sm">
              All payments
            </Anchor>
          </Group>
          <QueryState isLoading={payments.isLoading} error={payments.error} onRetry={() => payments.refetch()} what="payments" />
          <Stack gap={0} px={20} pb={8}>
            {payments.data?.data.map((p, i) => (
              <Group
                key={p.id}
                justify="space-between"
                wrap="nowrap"
                py={10}
                style={{ borderTop: i ? `1px solid ${tokens.line}` : undefined }}
              >
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" truncate>
                    {p.customer?.name ?? 'Unknown customer'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {PAYMENT_METHOD_LABELS[p.method]} · {formatDate(p.paymentDate)}
                  </Text>
                </div>
                <Text size="sm" className="num" c={tokens.status.good}>
                  +{formatMoney(p.amount)}
                </Text>
              </Group>
            ))}
          </Stack>
        </section>
      </div>
    </>
  )
}
