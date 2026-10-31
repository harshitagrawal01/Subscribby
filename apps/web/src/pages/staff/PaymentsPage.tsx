import { Anchor, Button, Group, Select, Table, Text, TextInput } from '@mantine/core'
import { useDebouncedValue, useDisclosure } from '@mantine/hooks'
import { IconDownload, IconPlus, IconSearch } from '@tabler/icons-react'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { staffPath } from '@/features/auth/staff-base'
import { useAuth } from '@/features/auth/useAuth'
import { CustomerSelect } from '@/features/billing/CustomerSelect'
import { DateRangeFilter } from '@/features/billing/DateRangeFilter'
import { downloadCsv } from '@/features/billing/download'
import { Pager } from '@/features/billing/Pager'
import { RecordPaymentModal } from '@/features/billing/RecordPaymentModal'
import { ReversePaymentModal, type ReversiblePayment } from '@/features/billing/ReversePaymentModal'
import { useUrlFilters } from '@/features/billing/useUrlFilters'
import { paymentsApi } from '@/lib/api/endpoints'
import type { PaymentMethod } from '@/lib/api/types'
import { formatDate, formatMoney, pluralize } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/labels'
import { notifyError } from '@/lib/notify'
import { tokens } from '@/theme'

const PAGE_SIZE = 20
const METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]

export function PaymentsPage() {
  const { user } = useAuth()
  const { params, update, clear, get } = useUrlFilters()
  const [recordOpened, record] = useDisclosure(false)
  const [reversing, setReversing] = useState<ReversiblePayment | null>(null)
  const isAdmin = user?.role === 'admin'
  const canRecord = user?.role === 'admin' || user?.role === 'staff' || user?.role === 'finance'

  const page = Number(params.get('page') ?? 1)
  const [search] = useDebouncedValue((params.get('search') ?? '').trim(), 300)
  const method = get('method') as PaymentMethod | undefined
  const customerId = get('customerId')
  const dateFrom = get('dateFrom')
  const dateTo = get('dateTo')
  const filters = { search: search || undefined, method, customerId, dateFrom, dateTo }
  const query = { ...filters, page, limit: PAGE_SIZE, sort: '-paymentDate,-createdAt' }

  const list = useQuery({
    queryKey: ['payments', 'list', query],
    queryFn: () => paymentsApi.list(query),
    placeholderData: keepPreviousData,
  })
  const exportCsv = useMutation({
    mutationFn: () => downloadCsv('payments', filters),
    onError: (error) => notifyError(error, 'The export failed. Try again.'),
  })

  const meta = list.data?.meta
  const hasFilters = Boolean(search || method || customerId || dateFrom || dateTo)
  const rangeText =
    dateFrom && dateTo
      ? `from ${formatDate(dateFrom)} to ${formatDate(dateTo)}`
      : hasFilters
        ? 'matching these filters'
        : 'all time'

  return (
    <>
      <PageHeader
        title="Payments"
        description="Money received against confirmed invoices, newest first."
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
            {canRecord && (
              <Button leftSection={<IconPlus size={16} stroke={1.75} />} onClick={record.open}>
                Record payment
              </Button>
            )}
          </>
        }
      />

      <div className="panel">
        <Group px={20} py={16} justify="space-between" align="flex-end" style={{ borderBottom: `1px solid ${tokens.line}` }}>
          <div>
            <Text size="sm" c="dimmed">
              Received, {rangeText}
            </Text>
            <Text className="num" fz={28} fw={600} lh={1.15} mt={4} style={{ letterSpacing: '-0.02em' }}>
              {meta ? formatMoney(meta.totalAmount) : '—'}
            </Text>
          </div>
          {meta && (
            <Text size="sm" c="dimmed">
              {pluralize(meta.total, 'payment')}
            </Text>
          )}
        </Group>

        <Group px={20} py={12} gap="sm" style={{ borderBottom: `1px solid ${tokens.line}` }}>
          <TextInput
            aria-label="Search"
            placeholder="Search by invoice number or customer"
            leftSection={<IconSearch size={15} stroke={1.5} />}
            defaultValue={params.get('search') ?? ''}
            onChange={(e) => update({ search: e.currentTarget.value.trim() || undefined })}
            w={280}
          />
          <Select
            aria-label="Method"
            placeholder="Any method"
            clearable
            data={METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
            value={method ?? null}
            onChange={(v) => update({ method: v ?? undefined })}
            w={170}
          />
          <CustomerSelect aria-label="Customer" value={customerId} onChange={(id) => update({ customerId: id })} w={210} />
          <DateRangeFilter
            label="Paid between"
            from={dateFrom}
            to={dateTo}
            onChange={(from, to) => update({ dateFrom: from, dateTo: to })}
          />
        </Group>

        <QueryState isLoading={list.isLoading} error={list.error} onRetry={() => list.refetch()} rows={8} what="payments" />
        {list.data && (
          <>
            <Table.ScrollContainer minWidth={900}>
              <Table className="data-table">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Paid on</Table.Th>
                    <Table.Th>Invoice</Table.Th>
                    <Table.Th>Customer</Table.Th>
                    <Table.Th>Method</Table.Th>
                    <Table.Th ta="right">Amount</Table.Th>
                    <Table.Th>Note</Table.Th>
                    <Table.Th>Recorded by</Table.Th>
                    {isAdmin && <Table.Th />}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {list.data.data.map((p) => (
                    <Table.Tr key={p.id}>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDate(p.paymentDate)}</Table.Td>
                      <Table.Td>
                        {p.invoice ? (
                          <Anchor component={Link} to={staffPath(`/invoices/${p.invoice.id}`)} className="mono" size="sm">
                            {p.invoice.number}
                          </Anchor>
                        ) : (
                          '—'
                        )}
                      </Table.Td>
                      <Table.Td maw={220}>
                        <Text size="sm" fw={500} truncate title={p.customer?.name}>
                          {p.customer?.name ?? '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>{PAYMENT_METHOD_LABELS[p.method]}</Table.Td>
                      <Table.Td ta="right" className="num" fw={500}>
                        {formatMoney(p.amount)}
                      </Table.Td>
                      <Table.Td maw={220}>
                        <Text size="sm" c={p.note ? undefined : 'dimmed'} truncate title={p.note || undefined}>
                          {p.note || '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                        {p.recordedBy?.name ?? '—'}
                      </Table.Td>
                      {isAdmin && (
                        <Table.Td ta="right" w={90}>
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="red"
                            onClick={() =>
                              setReversing({
                                id: p.id,
                                amount: p.amount,
                                paymentDate: p.paymentDate,
                                invoiceNumber: p.invoice?.number,
                              })
                            }
                          >
                            Reverse
                          </Button>
                        </Table.Td>
                      )}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            {!list.data.data.length && (
              <Group p={24} gap="sm">
                <Text size="sm" c="dimmed">
                  {hasFilters ? 'No payments match these filters.' : 'No payments yet. Record one when money comes in.'}
                </Text>
                {hasFilters ? (
                  <Button size="compact-sm" variant="default" onClick={clear}>
                    Clear filters
                  </Button>
                ) : (
                  canRecord && (
                    <Button size="compact-sm" variant="default" onClick={record.open}>
                      Record payment
                    </Button>
                  )
                )}
              </Group>
            )}

            <Pager meta={list.data.meta} onPage={(p) => update({ page: String(p) })} />
          </>
        )}
      </div>

      <RecordPaymentModal opened={recordOpened} onClose={record.close} />
      <ReversePaymentModal payment={reversing} onClose={() => setReversing(null)} />
    </>
  )
}
