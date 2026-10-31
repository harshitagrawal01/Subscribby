import { Button, Group, Stack, Text } from '@mantine/core'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { InvoiceTable } from '@/features/portal/InvoiceTable'
import { portalApi } from '@/lib/api/endpoints'
import type { InvoiceStatus } from '@/lib/api/types'
import { tokens } from '@/theme'

const PAGE_SIZE = 20

type Tab = 'all' | 'unpaid' | 'paid'
const TABS: { value: Tab; label: string; filter: { status?: InvoiceStatus; unpaid?: boolean } }[] = [
  { value: 'all', label: 'All', filter: {} },
  { value: 'unpaid', label: 'Unpaid', filter: { unpaid: true } },
  { value: 'paid', label: 'Paid', filter: { status: 'paid' } },
]

const EMPTY: Record<Tab, string> = {
  all: 'No invoices yet. They appear here once your first billing period starts.',
  unpaid: 'Nothing to pay. Every invoice is settled.',
  paid: 'No paid invoices yet.',
}

export function PortalInvoicesPage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.value === params.get('tab'))?.value ?? 'all') as Tab
  const page = Number(params.get('page') ?? 1)
  const filter = TABS.find((t) => t.value === tab)!.filter

  const query = { ...filter, page, limit: PAGE_SIZE, sort: '-invoiceDate' }
  const list = useQuery({
    queryKey: ['portal', 'invoices', query],
    queryFn: () => portalApi.invoices(query),
    placeholderData: keepPreviousData,
  })
  // Tab counts: one tiny request per tab (the portal list doesn't return status counts).
  const counts = useQuery({
    queryKey: ['portal', 'invoices', 'counts'],
    queryFn: async () => {
      const results = await Promise.all(TABS.map((t) => portalApi.invoices({ ...t.filter, limit: 1 })))
      return Object.fromEntries(TABS.map((t, i) => [t.value, results[i].meta.total])) as Record<Tab, number>
    },
  })

  const setTab = (value: Tab) => {
    const next = new URLSearchParams()
    if (value !== 'all') next.set('tab', value)
    setParams(next, { replace: true })
  }
  const setPage = (value: number) => {
    const next = new URLSearchParams(params)
    next.set('page', String(value))
    setParams(next, { replace: true })
  }

  const meta = list.data?.meta

  return (
    <>
      <PageHeader title="Invoices" description="Every invoice we've sent you, newest first. Open one to see the details or print it." />
      <div className="panel">
        <div className="filter-tabs" role="tablist" aria-label="Filter invoices">
          {TABS.map((t) => (
            <button key={t.value} className="filter-tab" role="tab" aria-selected={tab === t.value} onClick={() => setTab(t.value)}>
              {t.label}
              <span className="count">{counts.data?.[t.value] ?? ''}</span>
            </button>
          ))}
        </div>

        <QueryState isLoading={list.isLoading} error={list.error} onRetry={() => list.refetch()} rows={5} what="your invoices" />
        {list.data &&
          (list.data.data.length ? (
            <InvoiceTable invoices={list.data.data} />
          ) : (
            <Stack gap={4} p={28}>
              <Text size="sm" c="dimmed">
                {EMPTY[tab]}
              </Text>
              {tab !== 'all' && (
                <Group mt={8}>
                  <Button size="compact-sm" variant="default" onClick={() => setTab('all')}>
                    Show all invoices
                  </Button>
                </Group>
              )}
            </Stack>
          ))}

        {meta && meta.totalPages > 1 && (
          <Group justify="space-between" px={20} py={12} style={{ borderTop: `1px solid ${tokens.line}` }}>
            <Text size="sm" c="dimmed">
              <span className="num">
                {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)}
              </span>{' '}
              of <span className="num">{meta.total}</span>
            </Text>
            <Group gap={6}>
              <Button size="compact-sm" variant="default" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button size="compact-sm" variant="default" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </Group>
          </Group>
        )}
      </div>
    </>
  )
}
