import { Button, Group, Table, Text, TextInput, Tooltip } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { StatusText } from '@/components/StatusBadge'
import { useAuth } from '@/features/auth/useAuth'
import { paymentTermLabel, PERIOD_LABEL } from '@/features/subscriptions/constants'
import { TemplateDrawer } from '@/features/subscriptions/TemplateDrawer'
import { templatesApi } from '@/lib/api/endpoints'
import type { QuotationTemplate } from '@/lib/api/types'
import { pluralize } from '@/lib/format'
import { tokens } from '@/theme'

const PAGE_SIZE = 20
const TABS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
] as const
type Tab = (typeof TABS)[number]['value']

/** Quotation templates: the starting point for most quotes. Admin and staff edit; finance reads. */
export function TemplatesPage() {
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'staff'
  const [params, setParams] = useSearchParams()
  const tab = (params.get('show') as Tab | null) ?? 'active'
  const page = Number(params.get('page') ?? 1)
  const [search] = useDebouncedValue((params.get('search') ?? '').trim(), 300)
  const [target, setTarget] = useState<QuotationTemplate | 'new' | null>(null)

  const query = {
    search: search || undefined,
    isActive: tab === 'all' ? undefined : tab === 'active',
    page,
    limit: PAGE_SIZE,
    sort: 'name',
  }
  const list = useQuery({
    queryKey: ['quotation-templates', 'list', query],
    queryFn: () => templatesApi.list(query),
    placeholderData: keepPreviousData,
  })

  // Counts for the tabs (they follow the search, not the tab).
  const activeCount = useQuery({
    queryKey: ['quotation-templates', 'count', true, search],
    queryFn: () => templatesApi.list({ isActive: true, search: search || undefined, limit: 1 }),
    select: (r) => r.meta.total,
  })
  const archivedCount = useQuery({
    queryKey: ['quotation-templates', 'count', false, search],
    queryFn: () => templatesApi.list({ isActive: false, search: search || undefined, limit: 1 }),
    select: (r) => r.meta.total,
  })
  const counts: Record<Tab, number | undefined> = {
    active: activeCount.data,
    archived: archivedCount.data,
    all: activeCount.data !== undefined && archivedCount.data !== undefined ? activeCount.data + archivedCount.data : undefined,
  }

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
  const firstRow = meta ? (meta.page - 1) * meta.limit + 1 : 0
  const lastRow = meta ? Math.min(meta.page * meta.limit, meta.total) : 0
  const hasFilters = Boolean(search)

  return (
    <>
      <PageHeader
        title="Quotation templates"
        description={
          canEdit
            ? 'Ready-made quotes: a plan, its lines and terms. Pick one in the quote builder to start in seconds.'
            : 'Ready-made quotes the sales team starts from. You can read them; admins and staff edit them.'
        }
        actions={
          canEdit && (
            <Button leftSection={<IconPlus size={16} stroke={1.75} />} onClick={() => setTarget('new')}>
              New template
            </Button>
          )
        }
      />

      <div className="panel">
        <div className="filter-tabs" role="tablist" aria-label="Show templates">
          {TABS.map((t) => (
            <button
              key={t.value}
              className="filter-tab"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => update({ show: t.value === 'active' ? undefined : t.value })}
            >
              {t.label}
              {counts[t.value] !== undefined && <span className="count">{counts[t.value]}</span>}
            </button>
          ))}
        </div>

        <Group px={20} py={12} gap="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <TextInput
            aria-label="Search templates"
            placeholder="Search by name"
            leftSection={<IconSearch size={15} stroke={1.5} />}
            defaultValue={params.get('search') ?? ''}
            onChange={(e) => update({ search: e.currentTarget.value.trim() || undefined })}
            w={300}
          />
        </Group>

        <QueryState isLoading={list.isLoading} error={list.error} onRetry={() => list.refetch()} rows={4} what="templates" />
        {list.data && (
          <>
            {list.data.data.length > 0 && (
              <Table.ScrollContainer minWidth={820}>
                <Table className="data-table">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Plan</Table.Th>
                      <Table.Th>Valid for</Table.Th>
                      <Table.Th>Payment terms</Table.Th>
                      <Table.Th ta="right">Lines</Table.Th>
                      <Table.Th ta="right">Times used</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {list.data.data.map((t) => (
                      <Table.Tr
                        key={t.id}
                        className="row-link"
                        tabIndex={0}
                        onClick={() => setTarget(t)}
                        onKeyDown={(e) => e.key === 'Enter' && setTarget(t)}
                        aria-label={`${canEdit && t.isActive ? 'Edit' : 'View'} ${t.name}`}
                      >
                        <Table.Td fw={500}>{t.name}</Table.Td>
                        <Table.Td>
                          {t.plan?.name ?? '—'}
                          {t.plan && (
                            <Text span size="xs" c="dimmed" ml={6}>
                              {PERIOD_LABEL[t.plan.billingPeriod].toLowerCase()}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td className="num">{pluralize(t.validityDays, 'day')}</Table.Td>
                        <Table.Td c="dimmed">{paymentTermLabel(t.paymentTermDays)}</Table.Td>
                        <Table.Td ta="right">
                          <Tooltip
                            label={t.lines.map((l) => `${l.quantity} × ${l.productName}${l.variantLabel ? ` (${l.variantLabel})` : ''}`).join(', ')}
                            withArrow
                            multiline
                            maw={320}
                          >
                            <Text span size="sm" className="num">
                              {t.lines.length}
                            </Text>
                          </Tooltip>
                        </Table.Td>
                        <Table.Td ta="right" className="num">
                          {t.usedCount ?? 0}
                        </Table.Td>
                        <Table.Td>
                          {t.isActive ? (
                            <StatusText label="Active" color={tokens.status.good} />
                          ) : (
                            <StatusText label="Archived" color={tokens.status.closed} />
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}

            {!list.data.data.length && (
              <Group p={24} gap="sm">
                <Text size="sm" c="dimmed">
                  {hasFilters
                    ? 'No templates match that search.'
                    : tab === 'archived'
                      ? 'Nothing archived. Templates you archive show up here.'
                      : 'No templates yet. Make one for the deal you quote most often.'}
                </Text>
                {hasFilters ? (
                  <Button size="compact-sm" variant="default" onClick={() => update({ search: undefined })}>
                    Clear search
                  </Button>
                ) : (
                  canEdit &&
                  tab !== 'archived' && (
                    <Button size="compact-sm" variant="default" onClick={() => setTarget('new')}>
                      New template
                    </Button>
                  )
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
                  <Button size="compact-sm" variant="default" disabled={page >= meta.totalPages} onClick={() => update({ page: String(page + 1) })}>
                    Next
                  </Button>
                </Group>
              </Group>
            )}
          </>
        )}
      </div>

      <TemplateDrawer target={target} canEdit={canEdit} onClose={() => setTarget(null)} />
    </>
  )
}
