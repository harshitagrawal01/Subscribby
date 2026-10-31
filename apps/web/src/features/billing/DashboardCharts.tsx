import { BarChart } from '@mantine/charts'
import { Group, Skeleton, Stack, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { QueryState } from '@/components/QueryState'
import { reportsApi } from '@/lib/api/endpoints'
import type { Id } from '@/lib/api/types'
import { formatMoney, formatMoneyCompact } from '@/lib/format'
import { tokens } from '@/theme'
import { subscriptionsByPlan } from './reports'

const SERIES = {
  invoiced: { label: 'Invoiced', color: tokens.ink },
  collected: { label: 'Collected', color: '#5E9A74' },
}

interface Filters {
  planId?: Id
  customerId?: Id
}

/** Invoiced vs collected for the last six months, as grouped bars. */
export function RevenuePanel({ filters }: { filters: Filters }) {
  const range = { from: dayjs().subtract(5, 'month').format('YYYY-MM'), to: dayjs().format('YYYY-MM') }
  const query = { ...range, ...filters }
  const revenue = useQuery({ queryKey: ['reports', 'revenue-by-month', query], queryFn: () => reportsApi.revenueByMonth(query) })
  const rows = revenue.data ?? []
  const data = rows.map((r) => ({
    month: dayjs(`${r.month}-01`).format('MMM'),
    invoiced: r.invoiced / 100,
    collected: r.collected / 100,
  }))
  const invoiced = rows.reduce((s, r) => s + r.invoiced, 0)
  const collected = rows.reduce((s, r) => s + r.collected, 0)

  return (
    <section className="panel" style={{ padding: '16px 20px 12px' }}>
      <Group justify="space-between" align="flex-start" mb={12} wrap="wrap" gap="sm">
        <div>
          <Title order={2} fz={15}>
            Revenue
          </Title>
          <Text size="xs" c="dimmed" mt={2}>
            Last six months · confirmed and paid invoices vs payments received
          </Text>
        </div>
        <Group gap={18}>
          {(['invoiced', 'collected'] as const).map((key) => (
            <div key={key}>
              <Group gap={6} wrap="nowrap">
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: SERIES[key].color }} />
                <Text size="xs" c="dimmed">
                  {SERIES[key].label}
                </Text>
              </Group>
              <Text size="sm" className="num" fw={500} mt={2}>
                {revenue.data ? formatMoneyCompact(key === 'invoiced' ? invoiced : collected) : '—'}
              </Text>
            </div>
          ))}
        </Group>
      </Group>
      {revenue.isLoading ? (
        <Skeleton h={300} />
      ) : revenue.error ? (
        <QueryState isLoading={false} error={revenue.error} onRetry={() => revenue.refetch()} what="revenue" />
      ) : (
        <BarChart
          h={300}
          data={data}
          dataKey="month"
          series={(['invoiced', 'collected'] as const).map((name) => ({ name, ...SERIES[name] }))}
          gridAxis="x"
          gridColor="gray.1"
          strokeDasharray="0"
          tickLine="none"
          textColor="gray.6"
          maxBarWidth={22}
          barProps={{ radius: [4, 4, 0, 0] }}
          barChartProps={{ barGap: 2, barCategoryGap: '28%' }}
          valueFormatter={(v) => formatMoney(Math.round(v * 100))}
          yAxisProps={{ tickFormatter: (v: number) => formatMoneyCompact(v * 100), width: 64 }}
          tooltipAnimationDuration={120}
          aria-label="Bar chart of invoiced and collected amounts per month"
        />
      )}
    </section>
  )
}

/** Active subscriptions per plan, ranked, with a thin bar for share and the plan's MRR. */
export function PlansPanel({ filters }: { filters: Filters }) {
  const plans = useQuery({ queryKey: ['reports', 'subscriptions-by-plan', filters], queryFn: () => subscriptionsByPlan(filters) })
  const rows = plans.data ?? []
  const max = Math.max(1, ...rows.map((r) => r.count))
  const total = rows.reduce((s, r) => s + r.count, 0)

  return (
    <section className="panel" style={{ padding: '16px 20px 12px' }}>
      <Group justify="space-between" align="baseline" mb={8}>
        <Title order={2} fz={15}>
          Subscriptions by plan
        </Title>
        {plans.data && (
          <Text size="xs" c="dimmed">
            {total} active · MRR
          </Text>
        )}
      </Group>
      <QueryState isLoading={plans.isLoading} error={plans.error} onRetry={() => plans.refetch()} rows={5} what="plans" />
      {plans.data && !rows.length && (
        <Text size="sm" c="dimmed" py={8}>
          No active subscriptions for these filters.
        </Text>
      )}
      <Stack gap={0}>
        {rows.map((r, i) => (
          <div key={r.plan.id} style={{ padding: '9px 0', borderTop: i ? `1px solid ${tokens.line}` : undefined }}>
            <Group justify="space-between" wrap="nowrap" gap="sm">
              <Text size="sm" truncate>
                {r.plan.name}
              </Text>
              <Text size="sm" className="num" fw={500}>
                {formatMoney(r.mrr)}
              </Text>
            </Group>
            <Group gap={10} wrap="nowrap" mt={5}>
              <div style={{ flex: 1, height: 4, background: tokens.page, borderRadius: 2 }}>
                <div style={{ width: `${(r.count / max) * 100}%`, height: 4, background: tokens.ink, borderRadius: 2 }} />
              </div>
              <Text size="xs" c="dimmed" className="num" w={64} ta="right">
                {r.count} active
              </Text>
            </Group>
          </div>
        ))}
      </Stack>
    </section>
  )
}
