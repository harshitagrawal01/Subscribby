import { Anchor, Box, Group, Stack, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { QueryState } from '@/components/QueryState'
import { InvoiceStatusBadge, SubscriptionStatusBadge } from '@/components/StatusBadge'
import { staffPath } from '@/features/auth/staff-base'
import { CLOSE_REASON_LABEL, PERIOD_LABEL, PERIOD_NOUN, paymentTermLabel } from '@/features/subscriptions/constants'
import { EditSubscription } from '@/features/subscriptions/EditSubscription'
import { HistoryTimeline } from '@/features/subscriptions/HistoryTimeline'
import classes from '@/features/subscriptions/Layout.module.css'
import { PricedLinesTable, TotalsBlock } from '@/features/subscriptions/PricedLines'
import { BackLink, Section } from '@/features/subscriptions/Section'
import { StatusTrack } from '@/features/subscriptions/StatusTrack'
import { SubscriptionActions } from '@/features/subscriptions/SubscriptionActions'
import { isApiError } from '@/lib/api/client'
import { subscriptionsApi } from '@/lib/api/endpoints'
import type { Subscription } from '@/lib/api/types'
import { formatDate, formatDateTime, formatMoney, pluralize } from '@/lib/format'
import { tokens } from '@/theme'

/** The mock also returns these; types.ts doesn't list them yet. */
type SubscriptionDetail = Subscription & { pausedAt?: string | null; closedAt?: string | null }

function Fact({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <Group
      justify="space-between"
      align="baseline"
      wrap="nowrap"
      gap="md"
      py={9}
      style={{ borderBottom: last ? undefined : `1px solid ${tokens.line}` }}
    >
      <Text size="sm" c="dimmed" style={{ flex: 'none' }}>
        {label}
      </Text>
      <Text size="sm" ta="right" className="num" style={{ minWidth: 0 }}>
        {children}
      </Text>
    </Group>
  )
}

function nextInvoiceText(sub: Subscription) {
  if (sub.status === 'paused') return 'On hold while paused'
  if (sub.status === 'confirmed') return `${formatDate(sub.startDate)}, once active`
  if (sub.status === 'draft' || sub.status === 'quotation') return 'After confirmation'
  if (sub.status === 'active' && sub.nextInvoiceDate && sub.nextInvoiceDate > sub.expiryDate) return 'None before expiry'
  return formatDate(sub.nextInvoiceDate)
}

export function SubscriptionDetailPage() {
  const { id = '' } = useParams()
  const [editing, setEditing] = useState(false)
  const query = useQuery({ queryKey: ['subscription', id], queryFn: () => subscriptionsApi.get(id) as Promise<SubscriptionDetail> })
  const sub = query.data

  if (!sub) {
    const notFound = isApiError(query.error) && query.error.code === 'NOT_FOUND'
    return (
      <>
        <BackLink to={staffPath('/subscriptions')}>Subscriptions</BackLink>
        <div className="panel">
          {notFound ? (
            <Text size="sm" p="md">
              This subscription doesn't exist. It may have been a draft that was deleted.
            </Text>
          ) : (
            <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()} rows={6} what="this subscription" />
          )}
        </div>
      </>
    )
  }

  const period = PERIOD_NOUN[sub.plan.billingPeriod]
  const isEditing = editing && sub.allowedActions.includes('edit')
  const inv = sub.invoiceSummary

  return (
    <>
      <BackLink to={staffPath('/subscriptions')}>Subscriptions</BackLink>

      <Group justify="space-between" align="flex-end" wrap="wrap" gap="md" mb={20}>
        <div style={{ minWidth: 0 }}>
          <Group gap={12} mb={6}>
            <Text className="mono" c="dimmed" size="sm">
              {sub.number}
            </Text>
            <SubscriptionStatusBadge status={sub.status} />
            {sub.isExpired && (
              <Text size="sm" c={tokens.status.bad} fw={500}>
                Past its expiry date
              </Text>
            )}
          </Group>
          <Title order={1} fz={26} lh={1.2}>
            {sub.plan.name}
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            <Anchor component={Link} to={staffPath(`/customers/${sub.customer.id}`)} size="sm" fw={500}>
              {sub.customer.name}
            </Anchor>
            {' · '}
            {PERIOD_LABEL[sub.plan.billingPeriod]} billing
            {sub.template ? ` · from ${sub.template.name}` : ''}
          </Text>
        </div>
        {!isEditing && <SubscriptionActions sub={sub} onEdit={() => setEditing(true)} />}
      </Group>

      <div className="panel" style={{ padding: '18px 24px 16px', marginBottom: 16 }}>
        <StatusTrack
          status={sub.status}
          history={sub.history ?? []}
          quotationValidUntil={sub.quotationValidUntil}
          nextInvoiceDate={sub.nextInvoiceDate && sub.nextInvoiceDate <= sub.expiryDate ? sub.nextInvoiceDate : null}
          closeReason={sub.closeReason}
          pausedAt={sub.pausedAt}
        />
      </div>

      <div className={classes.layout}>
        <div className={classes.main}>
          {isEditing ? (
            <EditSubscription key={sub.updatedAt} sub={sub} onDone={() => setEditing(false)} />
          ) : (
            <>
              <section className="panel">
                <Group justify="space-between" align="baseline" px={20} pt={16} pb={10}>
                  <Title order={2} fz={16}>
                    Lines
                  </Title>
                  <Text size="xs" c="dimmed">
                    Priced as if invoiced today
                  </Text>
                </Group>
                <PricedLinesTable lines={sub.lines} />
                <Box px={20} py={16} style={{ borderTop: `1px solid ${tokens.line}` }}>
                  <Box ml="auto" maw={360}>
                    <TotalsBlock totals={sub.totals} lines={sub.lines} orderDiscount={sub.orderDiscount} totalLabel={`Total per ${period}`} />
                  </Box>
                </Box>
              </section>

              {sub.notes ? (
                <Section title="Notes">
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {sub.notes}
                  </Text>
                </Section>
              ) : null}
            </>
          )}
        </div>

        <aside className={classes.aside} style={{ position: 'static' }}>
          <section className="panel" style={{ padding: '18px 20px 10px' }}>
            <Text size="xs" c="dimmed">
              Every {period}, tax included
            </Text>
            <Text className="num" fz={30} fw={600} lh={1.15} mt={2} mb={10} style={{ letterSpacing: '-0.02em' }}>
              {formatMoney(sub.totals.total)}
            </Text>
            <Fact label="Start">{formatDate(sub.startDate)}</Fact>
            <Fact label="Expiry">
              <Text span size="sm" c={sub.isExpired ? tokens.status.bad : undefined}>
                {formatDate(sub.expiryDate)}
              </Text>
            </Fact>
            <Fact label="Next invoice">{nextInvoiceText(sub)}</Fact>
            <Fact label="Payment terms">{paymentTermLabel(sub.paymentTermDays)}</Fact>
            {(sub.quotationValidUntil || ['draft', 'quotation'].includes(sub.status)) && (
              <Fact label="Quotation valid until">{sub.quotationValidUntil ? formatDate(sub.quotationValidUntil) : 'Set when sent'}</Fact>
            )}
            <Fact label="Salesperson">{sub.salesperson?.name ?? '—'}</Fact>
            {sub.status === 'closed' && sub.closeReason && <Fact label="Closed as">{CLOSE_REASON_LABEL[sub.closeReason] ?? sub.closeReason}</Fact>}
            <Fact label="Created" last>
              {formatDateTime(sub.createdAt)}
            </Fact>
          </section>

          <section className="panel" style={{ padding: '16px 20px' }}>
            <Group justify="space-between" align="baseline" mb={10}>
              <Title order={2} fz={16}>
                Invoices
              </Title>
              {inv && inv.count > 0 && (
                <Anchor component={Link} to={staffPath(`/invoices?subscriptionId=${sub.id}`)} size="sm">
                  View all
                </Anchor>
              )}
            </Group>
            {inv && inv.count > 0 ? (
              <Stack gap={0}>
                <Fact label="Invoiced">{pluralize(inv.count, 'invoice')}</Fact>
                <Fact label="Outstanding">
                  <Text span size="sm" fw={inv.outstandingAmount ? 500 : undefined}>
                    {formatMoney(inv.outstandingAmount)}
                  </Text>
                </Fact>
                {inv.lastInvoice && (
                  <Group justify="space-between" wrap="nowrap" pt={9}>
                    <Anchor component={Link} to={staffPath(`/invoices/${inv.lastInvoice.id}`)} size="sm" className="mono">
                      {inv.lastInvoice.number}
                    </Anchor>
                    <InvoiceStatusBadge status={inv.lastInvoice.status} />
                  </Group>
                )}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                {['active', 'paused', 'closed'].includes(sub.status)
                  ? 'No invoices yet. The billing run creates them on each invoice date.'
                  : 'Invoices start once the subscription is active.'}
              </Text>
            )}
          </section>

          <section className="panel" style={{ padding: '16px 20px 6px' }}>
            <Title order={2} fz={16} mb={12}>
              History
            </Title>
            <HistoryTimeline history={sub.history ?? []} />
          </section>
        </aside>
      </div>
    </>
  )
}
