import { Anchor, Button, Group, Skeleton, Stack, Table, Text, Title } from '@mantine/core'
import { IconArrowLeft, IconPlus } from '@tabler/icons-react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { InvoiceStatusBadge, StatusText, SubscriptionStatusBadge } from '@/components/StatusBadge'
import { staffPath } from '@/features/auth/staff-base'
import classes from '@/features/catalog/CustomerDetail.module.css'
import { ConfirmModal, DetailList, EmptyLine, Pager } from '@/features/catalog/components'
import { CustomerForm } from '@/features/catalog/CustomerForm'
import { useRole, useUrlFilters } from '@/features/catalog/hooks'
import { ACTIVE_STATUS, PORTAL_STATUS } from '@/features/catalog/labels'
import { isApiError } from '@/lib/api/client'
import { customersApi, invoicesApi, paymentsApi, subscriptionsApi } from '@/lib/api/endpoints'
import type { Address, Customer } from '@/lib/api/types'
import { formatDate, formatMoney } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/labels'
import { notifyDone, notifyError } from '@/lib/notify'
import { tokens } from '@/theme'

const TAB_PAGE_SIZE = 10
const TABS = ['subscriptions', 'invoices', 'payments'] as const
type Tab = (typeof TABS)[number]
const TAB_LABELS: Record<Tab, string> = { subscriptions: 'Subscriptions', invoices: 'Invoices', payments: 'Payments' }

const addressText = (a: Address | undefined) => {
  if (!a) return null
  const cityLine = [a.city, a.state, a.postalCode].filter(Boolean).join(', ')
  const text = [a.line1, a.line2, cityLine, a.country && a.country !== 'IN' ? a.country : a.line1 ? 'India' : '']
    .filter(Boolean)
    .join('\n')
  return text || null
}

export function CustomerDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { can } = useRole()
  const canEdit = can('admin', 'staff')
  const [editing, setEditing] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  const detail = useQuery({ queryKey: ['customers', 'detail', id], queryFn: () => customersApi.get(id) })
  const customer = detail.data

  const archive = useMutation({
    mutationFn: () => customersApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      notifyDone(`Archived ${customer?.name ?? 'the customer'}`)
      setConfirmArchive(false)
    },
    onError: (error) => notifyError(error, "Couldn't archive the customer. Try again."),
  })

  if (!customer) {
    return (
      <>
        <BackLink />
        {detail.isLoading ? (
          <Stack gap={12} mt={8}>
            <Skeleton h={26} w={260} />
            <Skeleton h={12} w={200} />
            <Skeleton h={220} mt={16} radius="md" />
          </Stack>
        ) : isApiError(detail.error) && detail.error.code === 'NOT_FOUND' ? (
          <EmptyLine
            action={
              <Button size="compact-sm" variant="default" onClick={() => navigate(staffPath('/customers'))}>
                Back to customers
              </Button>
            }
          >
            This customer doesn't exist or was removed.
          </EmptyLine>
        ) : (
          <QueryState isLoading={false} error={detail.error} onRetry={() => detail.refetch()} what="the customer" />
        )}
      </>
    )
  }

  const stats = customer.stats
  const quoteUrl = staffPath(`/subscriptions/new?customerId=${customer.id}`)

  return (
    <>
      <BackLink />
      <PageHeader
        title={customer.name}
        description={
          <Group gap={14} component="span" style={{ display: 'inline-flex' }}>
            <StatusText {...(customer.isActive ? PORTAL_STATUS[customer.portalStatus] : ACTIVE_STATUS.archived)} />
            <span>{customer.email}</span>
          </Group>
        }
        actions={
          canEdit &&
          customer.isActive && (
            <>
              <Button variant="default" onClick={() => setConfirmArchive(true)}>
                Archive
              </Button>
              <Button component={Link} to={quoteUrl} leftSection={<IconPlus size={16} stroke={1.75} />}>
                New quotation
              </Button>
            </>
          )
        }
      />

      {!customer.isActive && (
        <Text size="sm" c="dimmed" mb="md">
          Archived. Their history stays here, but they can't get new quotations.
        </Text>
      )}

      <div className={classes.grid}>
        <CustomerActivity customer={customer} canQuote={canEdit && customer.isActive} quoteUrl={quoteUrl} />

        <div className={classes.side}>
          <section className="panel" style={{ padding: '20px 20px 4px' }}>
            <Text size="sm" c="dimmed">
              Outstanding
            </Text>
            <Text className="num" fz={32} fw={600} lh={1.15} mt={4} style={{ letterSpacing: '-0.02em' }}>
              {formatMoney(stats?.outstandingAmount ?? 0)}
            </Text>
            <Text size="xs" c="dimmed" mb={8}>
              Unpaid balance on confirmed invoices
            </Text>
            <StatRow
              label="Overdue"
              value={formatMoney(stats?.overdueAmount ?? 0)}
              color={stats?.overdueAmount ? tokens.status.bad : undefined}
              note={stats?.overdueAmount ? 'Past the due date' : 'Nothing past due'}
            />
            <StatRow label="Paid to date" value={formatMoney(stats?.paidToDate ?? 0)} note="All payments recorded" />
            <StatRow label="Active subscriptions" value={String(stats?.activeSubscriptions ?? 0)} />
          </section>

          <section className="panel">
            <div className={classes.panelHead}>
              <Title order={2} fz={15}>
                Details
              </Title>
              {canEdit && !editing && (
                <Button size="compact-sm" variant="subtle" onClick={() => setEditing(true)}>
                  Edit details
                </Button>
              )}
            </div>
            <div style={{ padding: '0 20px 16px' }}>
              {editing ? (
                <CustomerForm
                  key={customer.id}
                  customer={customer}
                  formId="customer-details-form"
                  compact
                  onSaved={() => setEditing(false)}
                  actions={(saving) => (
                    <div className={classes.formActions}>
                      <Button type="submit" loading={saving}>
                        Save details
                      </Button>
                      <Button variant="default" onClick={() => setEditing(false)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                />
              ) : (
                <CustomerDetails customer={customer} />
              )}
            </div>
          </section>
        </div>
      </div>

      <ConfirmModal
        opened={confirmArchive}
        onClose={() => {
          setConfirmArchive(false)
          archive.reset()
        }}
        onConfirm={() => archive.mutate()}
        loading={archive.isPending}
        danger
        title={`Archive ${customer.name}?`}
        confirmLabel="Archive customer"
        error={archive.error ? (isApiError(archive.error) ? archive.error.message : "Couldn't archive. Try again.") : null}
      >
        They drop out of the customer list and can't get new quotations. Invoices, payments and their portal login stay as they are.
        A customer with active subscriptions can't be archived until those are closed.
      </ConfirmModal>
    </>
  )
}

function BackLink() {
  return (
    <Anchor component={Link} to={staffPath('/customers')} size="sm" c="dimmed" mb={10} display="inline-flex" style={{ alignItems: 'center', gap: 4 }}>
      <IconArrowLeft size={14} stroke={1.5} /> Customers
    </Anchor>
  )
}

function StatRow({ label, value, note, color }: { label: string; value: string; note?: string; color?: string }) {
  return (
    <Group
      justify="space-between"
      align="baseline"
      py={12}
      wrap="nowrap"
      style={{ borderTop: `1px solid ${tokens.line}` }}
    >
      <div>
        <Text size="sm">{label}</Text>
        {note && (
          <Text size="xs" c="dimmed">
            {note}
          </Text>
        )}
      </div>
      <Text className="num" fw={500} c={color}>
        {value}
      </Text>
    </Group>
  )
}

function CustomerDetails({ customer }: { customer: Customer }) {
  const address = addressText(customer.billingAddress)
  return (
    <DetailList
      items={[
        { label: 'Contact', value: customer.contactName || '—' },
        { label: 'Email', value: customer.email },
        { label: 'Phone', value: customer.phone || '—' },
        { label: 'Billing address', value: address ? <span className={classes.address}>{address}</span> : '—' },
        { label: 'GSTIN', value: customer.taxId ? <span className="mono">{customer.taxId}</span> : '—' },
        { label: 'Notes', value: customer.notes || '—' },
      ]}
    />
  )
}

// ---------------------------------------------------------------- tabs

function CustomerActivity({ customer, canQuote, quoteUrl }: { customer: Customer; canQuote: boolean; quoteUrl: string }) {
  const navigate = useNavigate()
  const { params, update } = useUrlFilters()
  const tabParam = params.get('tab') as Tab | null
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'subscriptions'
  const page = Number(params.get('page') ?? 1)
  const pageFor = (t: Tab) => (t === tab ? page : 1)
  const base = { customerId: customer.id, limit: TAB_PAGE_SIZE }

  const subsQuery = { ...base, page: pageFor('subscriptions'), sort: '-createdAt' }
  const subs = useQuery({
    queryKey: ['subscriptions', subsQuery],
    queryFn: () => subscriptionsApi.list(subsQuery),
    placeholderData: keepPreviousData,
  })
  const invQuery = { ...base, page: pageFor('invoices'), sort: '-invoiceDate' }
  const invoices = useQuery({
    queryKey: ['invoices', invQuery],
    queryFn: () => invoicesApi.list(invQuery),
    placeholderData: keepPreviousData,
  })
  const payQuery = { ...base, page: pageFor('payments'), sort: '-paymentDate' }
  const payments = useQuery({
    queryKey: ['payments', payQuery],
    queryFn: () => paymentsApi.list(payQuery),
    placeholderData: keepPreviousData,
  })

  const counts: Record<Tab, number | undefined> = {
    subscriptions: subs.data?.meta.total,
    invoices: invoices.data?.meta.total,
    payments: payments.data?.meta.total,
  }
  const onPage = (p: number) => update({ page: String(p), tab })

  return (
    <section className="panel">
      <div className="filter-tabs" role="tablist" aria-label="Customer activity">
        {TABS.map((t) => (
          <button key={t} className="filter-tab" role="tab" aria-selected={tab === t} onClick={() => update({ tab: t, page: undefined })}>
            {TAB_LABELS[t]}
            <span className="count">{counts[t] ?? '·'}</span>
          </button>
        ))}
      </div>

      {tab === 'subscriptions' && (
        <>
          <QueryState isLoading={subs.isLoading} error={subs.error} onRetry={() => subs.refetch()} what="subscriptions" />
          {subs.data &&
            (subs.data.data.length ? (
              <Table.ScrollContainer minWidth={560}>
                <Table className="data-table">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Number</Table.Th>
                      <Table.Th>Plan</Table.Th>
                      <Table.Th>Next invoice</Table.Th>
                      <Table.Th ta="right">Per period</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {subs.data.data.map((s) => (
                      <Table.Tr key={s.id} className="row-link" onClick={() => navigate(staffPath(`/subscriptions/${s.id}`))}>
                        <Table.Td className="mono">{s.number}</Table.Td>
                        <Table.Td>
                          {s.plan.name}
                          <Text span size="xs" c="dimmed" ml={6}>
                            {s.plan.billingPeriod}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDate(s.nextInvoiceDate)}</Table.Td>
                        <Table.Td ta="right" className="num">
                          {formatMoney(s.recurringTotal)}
                        </Table.Td>
                        <Table.Td>
                          <SubscriptionStatusBadge status={s.status} />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            ) : (
              <EmptyLine
                action={
                  canQuote && (
                    <Button size="compact-sm" variant="default" component={Link} to={quoteUrl}>
                      New quotation
                    </Button>
                  )
                }
              >
                No subscriptions yet. They start with a quotation.
              </EmptyLine>
            ))}
          <Pager meta={subs.data?.meta} onPage={onPage} />
        </>
      )}

      {tab === 'invoices' && (
        <>
          <QueryState isLoading={invoices.isLoading} error={invoices.error} onRetry={() => invoices.refetch()} what="invoices" />
          {invoices.data &&
            (invoices.data.data.length ? (
              <Table.ScrollContainer minWidth={600}>
                <Table className="data-table">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Number</Table.Th>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Due</Table.Th>
                      <Table.Th ta="right">Total</Table.Th>
                      <Table.Th ta="right">Balance</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {invoices.data.data.map((inv) => (
                      <Table.Tr key={inv.id} className="row-link" onClick={() => navigate(staffPath(`/invoices/${inv.id}`))}>
                        <Table.Td className="mono">{inv.number}</Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDate(inv.invoiceDate)}</Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }} c={inv.isOverdue ? tokens.status.bad : undefined}>
                          {formatDate(inv.dueDate)}
                        </Table.Td>
                        <Table.Td ta="right" className="num">
                          {formatMoney(inv.total)}
                        </Table.Td>
                        <Table.Td ta="right" className="num" c={inv.balance ? undefined : 'dimmed'}>
                          {formatMoney(inv.balance)}
                        </Table.Td>
                        <Table.Td>
                          <InvoiceStatusBadge status={inv.status} overdue={inv.isOverdue} />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            ) : (
              <EmptyLine>No invoices yet. The billing run creates them from active subscriptions.</EmptyLine>
            ))}
          <Pager meta={invoices.data?.meta} onPage={onPage} />
        </>
      )}

      {tab === 'payments' && (
        <>
          <QueryState isLoading={payments.isLoading} error={payments.error} onRetry={() => payments.refetch()} what="payments" />
          {payments.data &&
            (payments.data.data.length ? (
              <Table.ScrollContainer minWidth={520}>
                <Table className="data-table">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Invoice</Table.Th>
                      <Table.Th>Method</Table.Th>
                      <Table.Th ta="right">Amount</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {payments.data.data.map((p) => (
                      <Table.Tr
                        key={p.id}
                        className={p.invoice ? 'row-link' : undefined}
                        onClick={() => p.invoice && navigate(staffPath(`/invoices/${p.invoice.id}`))}
                      >
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDate(p.paymentDate)}</Table.Td>
                        <Table.Td className="mono">{p.invoice?.number ?? '—'}</Table.Td>
                        <Table.Td>
                          {PAYMENT_METHOD_LABELS[p.method]}
                          {p.note && (
                            <Text span size="xs" c="dimmed" ml={6}>
                              {p.note}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td ta="right" className="num" c={tokens.status.good}>
                          {formatMoney(p.amount)}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            ) : (
              <EmptyLine>No payments recorded for this customer yet.</EmptyLine>
            ))}
          <Pager meta={payments.data?.meta} onPage={onPage} />
        </>
      )}
    </section>
  )
}
