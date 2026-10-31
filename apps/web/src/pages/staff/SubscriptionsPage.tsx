import { Button, Group, Select, Table, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { SubscriptionStatusBadge } from '@/components/StatusBadge'
import { staffPath } from '@/features/auth/staff-base'
import { useAuth } from '@/features/auth/useAuth'
import { plansApi, subscriptionsApi } from '@/lib/api/endpoints'
import type { SubscriptionStatus } from '@/lib/api/types'
import { formatDate, formatMoney } from '@/lib/format'
import { SUBSCRIPTION_STATUS } from '@/lib/labels'

const STATUSES = Object.keys(SUBSCRIPTION_STATUS) as SubscriptionStatus[]
const PAGE_SIZE = 20

/**
 * Reference pattern for list screens: filters live in the URL (shareable, survive refresh),
 * the server paginates, and status counts come from meta.statusCounts.
 */
export function SubscriptionsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as SubscriptionStatus | null) ?? undefined
  const planId = params.get('planId') ?? undefined
  const page = Number(params.get('page') ?? 1)
  const [search] = useDebouncedValue((params.get('search') ?? '').trim(), 300)

  const query = { status, planId, page, limit: PAGE_SIZE, search: search || undefined, sort: '-createdAt' }
  const list = useQuery({
    queryKey: ['subscriptions', query],
    queryFn: () => subscriptionsApi.list(query),
    placeholderData: keepPreviousData,
  })
  const plans = useQuery({ queryKey: ['plans', 'options'], queryFn: () => plansApi.list({ limit: 100 }) })

  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next, { replace: true })
  }

  const meta = list.data?.meta
  const counts = meta?.statusCounts ?? {}
  const total = Object.values(counts).reduce<number>((a, b) => a + (b ?? 0), 0)
  const hasFilters = Boolean(status || planId || search)
  const firstRow = meta ? (meta.page - 1) * meta.limit + 1 : 0
  const lastRow = meta ? Math.min(meta.page * meta.limit, meta.total) : 0

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Quotations and subscriptions for every customer, newest first."
        actions={
          user?.role !== 'finance' && (
            <Button leftSection={<IconPlus size={16} stroke={1.75} />} onClick={() => navigate(staffPath('/subscriptions/new'))}>
              New quotation
            </Button>
          )
        }
      />

      <div className="panel">
        <div className="filter-tabs" role="tablist" aria-label="Filter by status">
          <button className="filter-tab" role="tab" aria-selected={!status} onClick={() => update({ status: undefined })}>
            All<span className="count">{total}</span>
          </button>
          {STATUSES.map((s) => (
            <button key={s} className="filter-tab" role="tab" aria-selected={status === s} onClick={() => update({ status: s })}>
              {SUBSCRIPTION_STATUS[s].label}
              <span className="count">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>

        <Group px={20} py={12} gap="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <TextInput
            aria-label="Search"
            placeholder="Search by number or customer"
            leftSection={<IconSearch size={15} stroke={1.5} />}
            defaultValue={params.get('search') ?? ''}
            onChange={(e) => update({ search: e.currentTarget.value.trim() || undefined })}
            w={300}
          />
          <Select
            aria-label="Plan"
            placeholder="Any plan"
            clearable
            data={plans.data?.data.map((p) => ({ value: p.id, label: p.name })) ?? []}
            value={planId ?? null}
            onChange={(v) => update({ planId: v ?? undefined })}
            w={200}
          />
        </Group>

        <QueryState isLoading={list.isLoading} error={list.error} onRetry={() => list.refetch()} rows={8} what="subscriptions" />
        {list.data && (
          <>
            <Table.ScrollContainer minWidth={880}>
              <Table className="data-table">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Number</Table.Th>
                    <Table.Th>Customer</Table.Th>
                    <Table.Th>Plan</Table.Th>
                    <Table.Th>Term</Table.Th>
                    <Table.Th>Next invoice</Table.Th>
                    <Table.Th ta="right">Per period</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {list.data.data.map((sub) => (
                    <Table.Tr key={sub.id} className="row-link" onClick={() => navigate(staffPath(`/subscriptions/${sub.id}`))}>
                      <Table.Td className="mono">{sub.number}</Table.Td>
                      <Table.Td fw={500}>{sub.customer.name}</Table.Td>
                      <Table.Td>
                        {sub.plan.name}
                        <Text span size="xs" c="dimmed" ml={6}>
                          {sub.plan.billingPeriod}
                        </Text>
                      </Table.Td>
                      <Table.Td c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                        {formatDate(sub.startDate)} to {formatDate(sub.expiryDate)}
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDate(sub.nextInvoiceDate)}</Table.Td>
                      <Table.Td ta="right" className="num">
                        {formatMoney(sub.recurringTotal)}
                      </Table.Td>
                      <Table.Td>
                        <SubscriptionStatusBadge status={sub.status} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            {!list.data.data.length && (
              <Group p={24} gap="sm">
                <Text size="sm" c="dimmed">
                  {hasFilters ? 'No subscriptions match these filters.' : 'No subscriptions yet. Start with a quotation.'}
                </Text>
                {hasFilters && (
                  <Button size="compact-sm" variant="default" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                    Clear filters
                  </Button>
                )}
              </Group>
            )}

            {meta && meta.total > 0 && (
              <Group justify="space-between" px={20} py={12} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
                <Text size="sm" c="dimmed">
                  <span className="num">
                    {firstRow}–{lastRow}
                  </span>{' '}
                  of <span className="num">{meta.total}</span>
                </Text>
                <Group gap={6}>
                  <Button size="compact-sm" variant="default" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                    Previous
                  </Button>
                  <Button
                    size="compact-sm"
                    variant="default"
                    disabled={page >= meta.totalPages}
                    onClick={() => update({ page: String(page + 1) })}
                  >
                    Next
                  </Button>
                </Group>
              </Group>
            )}
          </>
        )}
      </div>
    </>
  )
}
