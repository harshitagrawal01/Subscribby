import { Button, Card, Group, Pagination, Select, Table, Tabs, Text, TextInput } from '@mantine/core'
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

/**
 * Reference pattern for list screens: filters live in the URL (shareable, survive refresh),
 * the server paginates, and status tab counts come from meta.statusCounts.
 */
export function SubscriptionsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as SubscriptionStatus | null) ?? undefined
  const planId = params.get('planId') ?? undefined
  const page = Number(params.get('page') ?? 1)
  const [search] = useDebouncedValue(params.get('search') ?? '', 300)

  const query = { status, planId, page, limit: 20, search: search || undefined, sort: '-createdAt' }
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

  const counts = list.data?.meta.statusCounts ?? {}
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Every quotation and subscription, from draft to closed."
        actions={
          user?.role !== 'finance' && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => navigate(staffPath('/subscriptions/new'))}>
              New subscription
            </Button>
          )
        }
      />

      <Card withBorder radius="md" p={0}>
        <Tabs value={status ?? 'all'} onChange={(v) => update({ status: v === 'all' ? undefined : (v ?? undefined) })}>
          <Tabs.List px="md" pt="xs">
            <Tabs.Tab value="all">All ({total})</Tabs.Tab>
            {STATUSES.map((s) => (
              <Tabs.Tab key={s} value={s}>
                {SUBSCRIPTION_STATUS[s].label} ({counts[s] ?? 0})
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>

        <Group p="md" gap="sm">
          <TextInput
            placeholder="Search number or customer"
            leftSection={<IconSearch size={16} />}
            defaultValue={params.get('search') ?? ''}
            onChange={(e) => update({ search: e.currentTarget.value || undefined })}
            w={280}
          />
          <Select
            placeholder="All plans"
            clearable
            data={plans.data?.data.map((p) => ({ value: p.id, label: p.name })) ?? []}
            value={planId ?? null}
            onChange={(v) => update({ planId: v ?? undefined })}
            w={220}
          />
        </Group>

        <QueryState isLoading={list.isLoading} error={list.error} />
        {list.data && (
          <>
            <Table.ScrollContainer minWidth={900}>
              <Table highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Number</Table.Th>
                    <Table.Th>Customer</Table.Th>
                    <Table.Th>Plan</Table.Th>
                    <Table.Th>Start</Table.Th>
                    <Table.Th>Expiry</Table.Th>
                    <Table.Th>Next invoice</Table.Th>
                    <Table.Th ta="right">Per period</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {list.data.data.map((sub) => (
                    <Table.Tr key={sub.id} style={{ cursor: 'pointer' }} onClick={() => navigate(staffPath(`/subscriptions/${sub.id}`))}>
                      <Table.Td fw={600}>{sub.number}</Table.Td>
                      <Table.Td>{sub.customer.name}</Table.Td>
                      <Table.Td>
                        {sub.plan.name}
                        <Text span size="xs" c="dimmed">
                          {' '}
                          · {sub.plan.billingPeriod}
                        </Text>
                      </Table.Td>
                      <Table.Td>{formatDate(sub.startDate)}</Table.Td>
                      <Table.Td>{formatDate(sub.expiryDate)}</Table.Td>
                      <Table.Td>{formatDate(sub.nextInvoiceDate)}</Table.Td>
                      <Table.Td ta="right" className="num">
                        {formatMoney(sub.recurringTotal)}
                      </Table.Td>
                      <Table.Td>
                        <SubscriptionStatusBadge status={sub.status} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {!list.data.data.length && (
                    <Table.Tr>
                      <Table.Td colSpan={8}>
                        <Text c="dimmed" ta="center" py="lg">
                          No subscriptions match these filters.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            <Group justify="space-between" p="md">
              <Text size="sm" c="dimmed">
                {list.data.meta.total.toLocaleString('en-IN')} results
              </Text>
              <Pagination total={list.data.meta.totalPages} value={page} onChange={(p) => update({ page: String(p) })} />
            </Group>
          </>
        )}
      </Card>
    </>
  )
}
