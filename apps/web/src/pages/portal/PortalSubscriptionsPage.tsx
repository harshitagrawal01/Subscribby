import { Anchor, Button, Group, Skeleton, Stack, Table, Text, Title } from '@mantine/core'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { SubscriptionStatusBadge } from '@/components/StatusBadge'
import { useAuth } from '@/features/auth/useAuth'
import { periodWord } from '@/features/portal/format'
import classes from '@/features/portal/portal.module.css'
import { authApi, portalApi } from '@/lib/api/endpoints'
import { formatDate, formatMoney, pluralize } from '@/lib/format'
import { tokens } from '@/theme'

const PAGE_SIZE = 20

export function PortalSubscriptionsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [page, setPage] = useState(1)

  const me = useQuery({ queryKey: ['me'], queryFn: () => authApi.me() })
  const summary = useQuery({ queryKey: ['portal', 'summary'], queryFn: () => portalApi.summary() })
  const query = { page, limit: PAGE_SIZE, sort: '-createdAt' }
  const subs = useQuery({
    queryKey: ['portal', 'subscriptions', query],
    queryFn: () => portalApi.subscriptions(query),
    placeholderData: keepPreviousData,
  })

  const s = summary.data
  const company = me.data?.customer?.name
  const periodOf = (id: string) => subs.data?.data.find((x) => x.id === id)?.plan.billingPeriod
  const meta = subs.data?.meta

  return (
    <>
      <PageHeader
        title={company ?? 'Your subscriptions'}
        description={`Hi ${user?.name.split(' ')[0] ?? 'there'}. Here's what you have with Subscribby and what's due.`}
      />

      {/* Hero: what you owe, then what's coming next. */}
      <section className={`panel ${classes.hero}`} aria-label="Billing summary">
        <div>
          <Text size="sm" c="dimmed">
            Amount due
          </Text>
          {s ? (
            <>
              <Text className={classes.bigFigure} mt={8}>
                {formatMoney(s.outstandingAmount)}
              </Text>
              <Text size="sm" mt={8}>
                {s.outstandingAmount === 0 ? (
                  'Nothing to pay right now. Every invoice is settled.'
                ) : s.overdueCount > 0 ? (
                  <>
                    <Text span c={tokens.status.bad} fw={500}>
                      {pluralize(s.overdueCount, 'invoice')} overdue.
                    </Text>{' '}
                    <Anchor component={Link} to="/portal/invoices?tab=unpaid">
                      See unpaid invoices
                    </Anchor>
                  </>
                ) : (
                  <>
                    Nothing is overdue.{' '}
                    <Anchor component={Link} to="/portal/invoices?tab=unpaid">
                      See unpaid invoices
                    </Anchor>
                  </>
                )}
              </Text>
            </>
          ) : summary.error ? (
            <QueryState isLoading={false} error={summary.error} onRetry={() => summary.refetch()} what="your balance" />
          ) : (
            <Stack gap={10} mt={10}>
              <Skeleton h={36} w={240} />
              <Skeleton h={12} w={200} />
            </Stack>
          )}
        </div>
        <div>
          <Text size="sm" c="dimmed">
            Next invoice
          </Text>
          {s ? (
            s.nextInvoice ? (
              <>
                <Text fz={22} fw={600} mt={8} lh={1.2}>
                  {formatDate(s.nextInvoice.date)}
                </Text>
                <Text size="sm" mt={6}>
                  <span className="num">{formatMoney(s.nextInvoice.amount)}</span>
                  <Text span c="dimmed">
                    {' '}
                    for <span className="mono">{s.nextInvoice.subscriptionNumber}</span>
                  </Text>
                </Text>
              </>
            ) : (
              <Text size="sm" mt={8}>
                No invoice is scheduled.
              </Text>
            )
          ) : (
            <Stack gap={10} mt={10}>
              <Skeleton h={22} w={140} />
              <Skeleton h={12} w={180} />
            </Stack>
          )}
          {s && (
            <Text size="sm" c="dimmed" mt={14}>
              {pluralize(s.activeSubscriptions, 'active subscription')}
            </Text>
          )}
        </div>
      </section>

      {/* Quotations waiting for an answer: the main thing to do here. */}
      {s && s.pendingQuotations.length > 0 && (
        <>
          <Title order={2} fz={17} className={classes.sectionTitle}>
            {s.pendingQuotations.length === 1 ? 'A quotation is waiting for you' : `${s.pendingQuotations.length} quotations are waiting for you`}
          </Title>
          <div className="panel">
            {s.pendingQuotations.map((q) => {
              const period = periodOf(q.id)
              return (
                <div key={q.id} className={classes.quote}>
                  <div style={{ minWidth: 0 }}>
                    <Text fw={500}>{q.plan.name}</Text>
                    <Text size="sm" c="dimmed">
                      <span className="mono">{q.number}</span> · reply by {formatDate(q.quotationValidUntil)}
                    </Text>
                  </div>
                  <div className={classes.quoteAmount} style={{ textAlign: 'right' }}>
                    <Text className="num" fw={500}>
                      {formatMoney(q.recurringTotal)}
                    </Text>
                    {period && (
                      <Text size="xs" c="dimmed">
                        per {periodWord(period)}, incl. tax
                      </Text>
                    )}
                  </div>
                  <Button onClick={() => navigate(`/portal/subscriptions/${q.id}`)}>Review</Button>
                </div>
              )
            })}
          </div>
        </>
      )}

      <Title order={2} fz={17} className={classes.sectionTitle}>
        Subscriptions
      </Title>
      <div className="panel">
        <QueryState isLoading={subs.isLoading} error={subs.error} onRetry={() => subs.refetch()} rows={3} what="your subscriptions" />
        {subs.data &&
          (subs.data.data.length ? (
            <>
              <Table.ScrollContainer minWidth={640}>
                <Table className="data-table" verticalSpacing={14}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Plan</Table.Th>
                      <Table.Th>Number</Table.Th>
                      <Table.Th>Next invoice</Table.Th>
                      <Table.Th ta="right">Amount</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {subs.data.data.map((sub) => (
                      <Table.Tr
                        key={sub.id}
                        className="row-link"
                        tabIndex={0}
                        onClick={() => navigate(`/portal/subscriptions/${sub.id}`)}
                        onKeyDown={(e) => e.key === 'Enter' && navigate(`/portal/subscriptions/${sub.id}`)}
                      >
                        <Table.Td fw={500}>{sub.plan.name}</Table.Td>
                        <Table.Td className="mono" c="dimmed">
                          {sub.number}
                        </Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          {sub.status === 'quotation' ? (
                            <Text span size="sm" c="dimmed">
                              Starts {formatDate(sub.startDate)} if accepted
                            </Text>
                          ) : (
                            formatDate(sub.nextInvoiceDate)
                          )}
                        </Table.Td>
                        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                          <span className="num">{formatMoney(sub.recurringTotal)}</span>
                          <Text span size="xs" c="dimmed">
                            {' '}
                            / {periodWord(sub.plan.billingPeriod)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <SubscriptionStatusBadge status={sub.status} />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
              {meta && meta.totalPages > 1 && (
                <Group justify="space-between" px={20} py={12} style={{ borderTop: `1px solid ${tokens.line}` }}>
                  <Text size="sm" c="dimmed">
                    Page <span className="num">{meta.page}</span> of <span className="num">{meta.totalPages}</span>
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
            </>
          ) : (
            <Stack gap={4} p={28}>
              <Text fw={500}>No subscriptions yet</Text>
              <Text size="sm" c="dimmed">
                When we send you a quotation it appears here, ready for you to review and accept.
              </Text>
            </Stack>
          ))}
      </div>
    </>
  )
}
