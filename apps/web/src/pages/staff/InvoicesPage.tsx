import { Anchor, Button, Checkbox, CloseButton, Group, Stack, Table, Text, TextInput } from '@mantine/core'
import { useDebouncedValue, useDisclosure } from '@mantine/hooks'
import { IconDownload, IconSearch } from '@tabler/icons-react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { InvoiceStatusBadge } from '@/components/StatusBadge'
import { staffPath } from '@/features/auth/staff-base'
import { useAuth } from '@/features/auth/useAuth'
import { BillingRunModal } from '@/features/billing/BillingRunModal'
import { CustomerSelect } from '@/features/billing/CustomerSelect'
import { DateRangeFilter } from '@/features/billing/DateRangeFilter'
import { downloadCsv } from '@/features/billing/download'
import { invalidateBilling } from '@/features/billing/invalidate'
import { Pager } from '@/features/billing/Pager'
import { useUrlFilters } from '@/features/billing/useUrlFilters'
import { billingApi, invoicesApi, subscriptionsApi, type InvoiceListQuery } from '@/lib/api/endpoints'
import type { BillingRunResult, BulkResult, Id, InvoiceStatus, Ref } from '@/lib/api/types'
import { formatDate, formatDateTime, formatMoney, pluralize } from '@/lib/format'
import { notifyError } from '@/lib/notify'
import { tokens } from '@/theme'

const PAGE_SIZE = 20
type Tab = 'all' | InvoiceStatus | 'overdue'
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'confirmed', label: 'Unpaid' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
]

/** The API also returns who started the run (null for the nightly job). */
type LastRun = BillingRunResult & { runBy?: Ref | null }

function LastRunLine() {
  const last = useQuery({ queryKey: ['billing', 'last-run'], queryFn: () => billingApi.lastRun() as Promise<LastRun | null> })
  if (!last.data) return <>Draft invoices come from the billing run. Confirm them, send them, then record payments.</>
  const r = last.data
  return (
    <>
      Last billing run {formatDateTime(r.finishedAt)}
      {r.runBy ? ` by ${r.runBy.name}` : ' (nightly)'}: {pluralize(r.created, 'invoice')} created
      {r.failed.length ? `, ${r.failed.length} failed` : ''}.
    </>
  )
}

interface BulkOutcome {
  action: 'confirm' | 'send'
  result: BulkResult
  numbers: Record<Id, string>
}

function BulkOutcomeNote({ outcome, onClose }: { outcome: BulkOutcome; onClose: () => void }) {
  const { result, numbers, action } = outcome
  const total = result.succeeded.length + result.failed.length
  const verb = action === 'confirm' ? 'Confirmed' : 'Sent'
  return (
    <Group
      px={20}
      py={12}
      align="flex-start"
      justify="space-between"
      wrap="nowrap"
      style={{ borderBottom: `1px solid ${tokens.line}`, background: tokens.page }}
    >
      <Stack gap={4}>
        <Text size="sm" fw={500} c={result.failed.length ? undefined : tokens.status.good}>
          {verb} {result.succeeded.length} of {pluralize(total, 'invoice')}.
          {result.failed.length ? ` ${result.failed.length} could not be ${action === 'confirm' ? 'confirmed' : 'sent'}:` : ''}
        </Text>
        {result.failed.map((f) => (
          <Text key={f.id} size="sm">
            <span className="mono">{numbers[f.id] ?? f.id}</span>{' '}
            <Text span c={tokens.status.bad} size="sm">
              {f.message}
            </Text>
          </Text>
        ))}
      </Stack>
      <CloseButton size="sm" aria-label="Dismiss" onClick={onClose} />
    </Group>
  )
}

export function InvoicesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { params, update, clear, get } = useUrlFilters()
  const canManage = user?.role === 'admin' || user?.role === 'staff'
  const [billingOpened, billing] = useDisclosure(false)

  const overdue = params.get('overdue') === 'true'
  const status = get('status') as InvoiceStatus | undefined
  const tab: Tab = overdue ? 'overdue' : (status ?? 'all')
  const page = Number(params.get('page') ?? 1)
  const [search] = useDebouncedValue((params.get('search') ?? '').trim(), 300)
  const customerId = get('customerId')
  const subscriptionId = get('subscriptionId')
  const dates = { invoiceFrom: get('invoiceFrom'), invoiceTo: get('invoiceTo'), dueFrom: get('dueFrom'), dueTo: get('dueTo') }

  const filters: InvoiceListQuery = {
    status: overdue ? undefined : status,
    overdue: overdue || undefined,
    customerId,
    subscriptionId,
    search: search || undefined,
    ...dates,
  }
  const query: InvoiceListQuery = { ...filters, page, limit: PAGE_SIZE, sort: overdue ? 'dueDate' : '-invoiceDate,-number' }
  const list = useQuery({
    queryKey: ['invoices', 'list', query],
    queryFn: () => invoicesApi.list(query),
    placeholderData: keepPreviousData,
  })
  const subscription = useQuery({
    queryKey: ['subscriptions', 'detail', subscriptionId],
    queryFn: () => subscriptionsApi.get(subscriptionId!),
    enabled: Boolean(subscriptionId),
  })

  // Selection: id → number, so results can name the invoices.
  const [selected, setSelected] = useState<Record<Id, string>>({})
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null)
  const selectedIds = Object.keys(selected)
  const rows = list.data?.data ?? []
  const allOnPage = rows.length > 0 && rows.every((r) => selected[r.id])
  const someOnPage = rows.some((r) => selected[r.id])

  const toggle = (id: Id, number: string) =>
    setSelected((s) => {
      const next = { ...s }
      if (next[id]) delete next[id]
      else next[id] = number
      return next
    })
  const togglePage = () =>
    setSelected((s) => {
      const next = { ...s }
      for (const r of rows) {
        if (allOnPage) delete next[r.id]
        else next[r.id] = r.number
      }
      return next
    })

  const bulk = useMutation({
    mutationFn: (action: 'confirm' | 'send') =>
      (action === 'confirm' ? invoicesApi.bulkConfirm(selectedIds) : invoicesApi.bulkSend(selectedIds)).then((result) => ({
        action,
        result,
      })),
    onSuccess: ({ action, result }) => {
      setOutcome({ action, result, numbers: selected })
      // Keep only the failed ones selected, so they can be dealt with next.
      setSelected(Object.fromEntries(result.failed.map((f) => [f.id, selected[f.id]])))
      invalidateBilling(queryClient)
    },
    onError: (error) => notifyError(error, 'Nothing was changed. Try again.'),
  })

  const exportCsv = useMutation({
    mutationFn: () => downloadCsv('invoices', { ...filters }),
    onError: (error) => notifyError(error, 'The export failed. Try again.'),
  })

  const counts = list.data?.meta.statusCounts ?? {}
  const countFor = (t: Tab) =>
    t === 'all' ? (counts.draft ?? 0) + (counts.confirmed ?? 0) + (counts.paid ?? 0) + (counts.cancelled ?? 0) : (counts[t] ?? 0)
  const hasFilters = Boolean(status || overdue || search || customerId || subscriptionId || Object.values(dates).some(Boolean))

  return (
    <>
      <PageHeader
        title="Invoices"
        description={<LastRunLine />}
        actions={
          <>
            <Button
              variant="subtle"
              color="ink"
              leftSection={<IconDownload size={16} stroke={1.5} />}
              loading={exportCsv.isPending}
              onClick={() => exportCsv.mutate()}
            >
              Export CSV
            </Button>
            {canManage ? (
              <Button onClick={billing.open}>Run billing</Button>
            ) : (
              <Button variant="default" onClick={billing.open}>
                Preview billing
              </Button>
            )}
          </>
        }
      />

      <div className="panel">
        <div className="filter-tabs" role="tablist" aria-label="Filter by status">
          {TABS.map((t) => (
            <button
              key={t.key}
              className="filter-tab"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() =>
                update({
                  status: t.key === 'all' || t.key === 'overdue' ? undefined : t.key,
                  overdue: t.key === 'overdue' ? 'true' : undefined,
                })
              }
            >
              {t.label}
              <span className="count">{countFor(t.key)}</span>
            </button>
          ))}
        </div>

        <Group px={20} py={12} gap="sm" style={{ borderBottom: `1px solid ${tokens.line}` }}>
          <TextInput
            aria-label="Search"
            placeholder="Search by number or customer"
            leftSection={<IconSearch size={15} stroke={1.5} />}
            defaultValue={params.get('search') ?? ''}
            onChange={(e) => update({ search: e.currentTarget.value.trim() || undefined })}
            w={250}
          />
          <CustomerSelect aria-label="Customer" value={customerId} onChange={(id) => update({ customerId: id })} w={210} />
          <DateRangeFilter
            label="Invoice date"
            from={dates.invoiceFrom}
            to={dates.invoiceTo}
            onChange={(from, to) => update({ invoiceFrom: from, invoiceTo: to })}
          />
          <DateRangeFilter
            label="Due date"
            from={dates.dueFrom}
            to={dates.dueTo}
            onChange={(from, to) => update({ dueFrom: from, dueTo: to })}
          />
        </Group>

        {subscriptionId && (
          <Group px={20} py={10} gap={10} style={{ borderBottom: `1px solid ${tokens.line}` }}>
            <Text size="sm">
              For{' '}
              {subscription.data ? (
                <>
                  <Anchor component={Link} to={staffPath(`/subscriptions/${subscriptionId}`)} className="mono" size="sm">
                    {subscription.data.number}
                  </Anchor>
                  <Text span c="dimmed" size="sm">
                    {' '}
                    · {subscription.data.customer.name}
                  </Text>
                </>
              ) : (
                <Text span c="dimmed" size="sm">
                  one subscription
                </Text>
              )}
            </Text>
            <Anchor component="button" type="button" size="sm" onClick={() => update({ subscriptionId: undefined })}>
              Show all invoices
            </Anchor>
          </Group>
        )}

        {selectedIds.length > 0 && (
          <Group
            px={20}
            py={8}
            gap="sm"
            style={{ borderBottom: `1px solid ${tokens.line}`, background: 'var(--mantine-color-ink-0)' }}
          >
            <Text size="sm" fw={500}>
              {selectedIds.length} selected
            </Text>
            {canManage && (
              <Button
                size="compact-sm"
                loading={bulk.isPending && bulk.variables === 'confirm'}
                onClick={() => bulk.mutate('confirm')}
              >
                Confirm selected
              </Button>
            )}
            <Button
              size="compact-sm"
              variant="default"
              loading={bulk.isPending && bulk.variables === 'send'}
              onClick={() => bulk.mutate('send')}
            >
              Send selected
            </Button>
            <Anchor component="button" type="button" size="sm" ml="auto" onClick={() => setSelected({})}>
              Clear selection
            </Anchor>
          </Group>
        )}

        {outcome && <BulkOutcomeNote outcome={outcome} onClose={() => setOutcome(null)} />}

        <QueryState isLoading={list.isLoading} error={list.error} onRetry={() => list.refetch()} rows={8} what="invoices" />
        {list.data && (
          <>
            <Table.ScrollContainer minWidth={980}>
              <Table className="data-table">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={36} pr={0}>
                      <Checkbox
                        size="xs"
                        aria-label="Select all on this page"
                        checked={allOnPage}
                        indeterminate={someOnPage && !allOnPage}
                        onChange={togglePage}
                      />
                    </Table.Th>
                    <Table.Th>Number</Table.Th>
                    <Table.Th>Customer</Table.Th>
                    <Table.Th>Subscription</Table.Th>
                    <Table.Th>Invoice date</Table.Th>
                    <Table.Th>Due</Table.Th>
                    <Table.Th ta="right">Total</Table.Th>
                    <Table.Th ta="right">Balance</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((inv) => (
                    <Table.Tr
                      key={inv.id}
                      className="row-link"
                      onClick={() => navigate(staffPath(`/invoices/${inv.id}`))}
                      bg={selected[inv.id] ? 'var(--mantine-color-ink-0)' : undefined}
                    >
                      <Table.Td pr={0} onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          size="xs"
                          aria-label={`Select ${inv.number}`}
                          checked={Boolean(selected[inv.id])}
                          onChange={() => toggle(inv.id, inv.number)}
                        />
                      </Table.Td>
                      <Table.Td className="mono">{inv.number}</Table.Td>
                      <Table.Td maw={220}>
                        <Text size="sm" fw={500} truncate title={inv.customer.name}>
                          {inv.customer.name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Anchor
                          component={Link}
                          to={staffPath(`/subscriptions/${inv.subscription.id}`)}
                          className="mono"
                          size="sm"
                          c="dimmed"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {inv.subscription.number}
                        </Anchor>
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDate(inv.invoiceDate)}</Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }} c={inv.isOverdue ? tokens.status.bad : undefined}>
                        {formatDate(inv.dueDate)}
                      </Table.Td>
                      <Table.Td ta="right" className="num">
                        {formatMoney(inv.total)}
                      </Table.Td>
                      <Table.Td ta="right" className="num" c={inv.balance ? undefined : 'dimmed'}>
                        {inv.status === 'cancelled' ? '—' : formatMoney(inv.balance)}
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        <Group gap={6} wrap="nowrap">
                          <InvoiceStatusBadge status={inv.status} overdue={inv.isOverdue} />
                          {inv.isOverdue && (
                            <Text span size="xs" c="dimmed" className="num">
                              {pluralize(inv.daysOverdue, 'day')} late
                            </Text>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            {!rows.length && (
              <Group p={24} gap="sm">
                <Text size="sm" c="dimmed">
                  {hasFilters
                    ? 'No invoices match these filters.'
                    : 'No invoices yet. Run billing to create drafts for subscriptions that are due.'}
                </Text>
                {hasFilters ? (
                  <Button size="compact-sm" variant="default" onClick={clear}>
                    Clear filters
                  </Button>
                ) : (
                  canManage && (
                    <Button size="compact-sm" variant="default" onClick={billing.open}>
                      Run billing
                    </Button>
                  )
                )}
              </Group>
            )}

            <Pager meta={list.data.meta} onPage={(p) => update({ page: String(p) })} />
          </>
        )}
      </div>

      <BillingRunModal opened={billingOpened} onClose={billing.close} canRun={canManage} />
    </>
  )
}
