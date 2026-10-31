import { Anchor, Button, Group, Skeleton, Stack, Text, Title } from '@mantine/core'
import { IconMail, IconReceipt } from '@tabler/icons-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { QueryState } from '@/components/QueryState'
import { InvoiceStatusBadge, SubscriptionStatusBadge } from '@/components/StatusBadge'
import { useAuth } from '@/features/auth/useAuth'
import { periodWord } from '@/features/portal/format'
import h from '@/features/portal/home.module.css'
import { authApi, metaApi, portalApi } from '@/lib/api/endpoints'
import type { SubscriptionListItem } from '@/lib/api/types'
import { formatDate, formatMoney, pluralize } from '@/lib/format'
import { tokens } from '@/theme'

const PAGE_SIZE = 20

const greetingWord = () => {
  const hr = new Date().getHours()
  return hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'
}

/** "₹2,950.00" → big rupees, smaller symbol and paise. */
function BigMoney({ paise }: { paise: number }) {
  const text = formatMoney(paise)
  const m = text.match(/^(\D*)([\d,]+)(\.\d+)?$/)
  if (!m) return <>{text}</>
  return (
    <>
      <span className={h.cur}>{m[1]}</span>
      {m[2]}
      {m[3] && <small>{m[3]}</small>}
    </>
  )
}

function ReceiptWatermark() {
  return (
    <svg className={h.watermark} viewBox="0 0 100 120" aria-hidden="true">
      <path d="M10 0h80v108l-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6z" fill="#FBF7EF" />
      <rect x="22" y="22" width="56" height="6" rx="3" fill="#223A5E" />
      <rect x="22" y="40" width="40" height="5" rx="2.5" fill="#223A5E" />
      <rect x="22" y="54" width="48" height="5" rx="2.5" fill="#223A5E" />
      <rect x="22" y="80" width="56" height="8" rx="4" fill="#223A5E" />
    </svg>
  )
}

const STATUS_TINT: Record<string, [string, string]> = {
  active: ['#E7F2EB', tokens.status.good],
  quotation: ['#FBF0DE', tokens.status.warn],
  confirmed: ['#EEF2F7', tokens.status.info],
  paused: ['#F5EEDC', tokens.status.paused],
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')

const daysFromToday = (date: string) => dayjs(date).startOf('day').diff(dayjs().startOf('day'), 'day')

function SubscriptionCard({ sub, index }: { sub: SubscriptionListItem; index: number }) {
  const navigate = useNavigate()
  const go = () => navigate(`/portal/subscriptions/${sub.id}`)
  const [bg, fg] = STATUS_TINT[sub.status] ?? ['#F1EFEA', tokens.status.closed]
  const start = dayjs(sub.startDate)
  const end = dayjs(sub.expiryDate)
  const total = Math.max(end.diff(start, 'day'), 1)
  const pct = Math.min(Math.max(dayjs().diff(start, 'day') / total, 0), 1)
  const monthsLeft = Math.max(end.diff(dayjs(), 'month'), 0)
  return (
    <div
      className={`${h.card} ${h.rise}`}
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
      role="link"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => e.key === 'Enter' && go()}
      aria-label={`${sub.plan.name}, ${sub.number}`}
    >
      <Group gap={12} wrap="nowrap" align="flex-start">
        <div className={h.tile} style={{ background: bg, color: fg, fontWeight: 600 }} aria-hidden="true">
          {initials(sub.plan.name)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Title order={3} fz={18} lh={1.25}>
            {sub.plan.name}
          </Title>
          <Text size="xs" c="dimmed" className="mono">
            {sub.number}
          </Text>
        </div>
        <SubscriptionStatusBadge status={sub.status} />
      </Group>
      <div>
        <Text fz={22} fw={600} className="num" lh={1.2}>
          {formatMoney(sub.recurringTotal)}
          <Text span size="sm" c="dimmed" fw={400}>
            {' '}
            / {periodWord(sub.plan.billingPeriod)}
          </Text>
        </Text>
        <Text size="sm" c="dimmed" mt={2}>
          {sub.status === 'quotation'
            ? `Starts ${formatDate(sub.startDate)} if accepted`
            : sub.nextInvoiceDate
              ? `Next invoice ${formatDate(sub.nextInvoiceDate)}`
              : 'No invoice scheduled'}
        </Text>
      </div>
      {sub.status !== 'quotation' && (
        <div>
          <div className={h.track} aria-hidden="true">
            <div className={h.trackFill} style={{ width: `${pct * 100}%` }} />
            <div className={h.trackNow} style={{ left: `calc(${pct * 100}% - 1px)` }} />
          </div>
          <Group justify="space-between" mt={6}>
            <Text size="xs" c="dimmed">
              {formatDate(sub.startDate)} to {formatDate(sub.expiryDate)}
            </Text>
            <Text size="xs" c="dimmed">
              {pct >= 1 ? 'Term ended' : `${pluralize(monthsLeft, 'month')} left`}
            </Text>
          </Group>
        </div>
      )}
    </div>
  )
}

export function PortalSubscriptionsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [page, setPage] = useState(1)

  const me = useQuery({ queryKey: ['me'], queryFn: () => authApi.me() })
  const meta = useQuery({ queryKey: ['meta'], queryFn: () => metaApi.get(), staleTime: Infinity })
  const summary = useQuery({ queryKey: ['portal', 'summary'], queryFn: () => portalApi.summary() })
  const query = { page, limit: PAGE_SIZE, sort: '-createdAt' }
  const subs = useQuery({
    queryKey: ['portal', 'subscriptions', query],
    queryFn: () => portalApi.subscriptions(query),
    placeholderData: keepPreviousData,
  })
  const recentQuery = { page: 1, limit: 4, sort: '-invoiceDate' }
  const recent = useQuery({ queryKey: ['portal', 'invoices', recentQuery], queryFn: () => portalApi.invoices(recentQuery) })
  const unpaidQuery = { page: 1, limit: 1, unpaid: true, sort: 'dueDate' }
  const unpaid = useQuery({ queryKey: ['portal', 'invoices', unpaidQuery], queryFn: () => portalApi.invoices(unpaidQuery) })

  const s = summary.data
  const company = me.data?.customer?.name
  const periodOf = (id: string) => subs.data?.data.find((x) => x.id === id)?.plan.billingPeriod
  const listMeta = subs.data?.meta
  const firstUnpaid = unpaid.data?.data[0]
  const next = s?.nextInvoice
  const singleUnpaid = Boolean(firstUnpaid && unpaid.data?.meta.total === 1)

  return (
    <>
      <header className={`${h.greeting} ${h.rise}`}>
        <Title order={1}>
          {greetingWord()}, {user?.name.split(' ')[0] ?? 'there'}
        </Title>
        <Text c="dimmed" mt={6}>
          {company ? `${company} · ` : ''}your subscriptions and bills with Subscribby
        </Text>
      </header>

      <div className={h.top}>
        <section className={`${h.hero} ${h.rise}`} aria-label="Amount due">
          <ReceiptWatermark />
          <div className={h.heroBody}>
            <div className={h.heroLabel}>Amount due</div>
            {s ? (
              <>
                <div className={h.figure}>
                  <BigMoney paise={s.outstandingAmount} />
                  {s.outstandingAmount === 0 && <span className={h.stamp}>PAID</span>}
                </div>
                <div className={h.dueLine}>
                  {s.outstandingAmount === 0 ? (
                    "You're all paid up. Every invoice is settled."
                  ) : s.overdueCount > 0 ? (
                    <>
                      <span style={{ color: '#FFC2B8', fontWeight: 600 }}>{pluralize(s.overdueCount, 'invoice')} overdue</span>
                      {firstUnpaid && (
                        <>
                          {' '}
                          · <span className="mono">{firstUnpaid.number}</span> was due {formatDate(firstUnpaid.dueDate)}
                        </>
                      )}
                    </>
                  ) : firstUnpaid ? (
                    <>
                      Due {formatDate(firstUnpaid.dueDate)} for <span className="mono">{firstUnpaid.number}</span>
                    </>
                  ) : (
                    'Nothing is overdue.'
                  )}
                </div>
                {s.outstandingAmount > 0 && (
                  <Button
                    className={h.creamBtn}
                    onClick={() => navigate(singleUnpaid && firstUnpaid ? `/portal/invoices/${firstUnpaid.id}` : '/portal/invoices?tab=unpaid')}
                  >
                    {singleUnpaid ? 'View invoice' : 'See unpaid invoices'}
                  </Button>
                )}
              </>
            ) : summary.error ? (
              <QueryState isLoading={false} error={summary.error} onRetry={() => summary.refetch()} what="your balance" />
            ) : (
              <Stack gap={10} mt={10}>
                <Skeleton h={44} w={260} opacity={0.25} />
                <Skeleton h={12} w={200} opacity={0.25} />
              </Stack>
            )}
          </div>
          <div className={h.stub}>
            <div>
              Next invoice
              <b>{next ? `${formatDate(next.date)} · ${formatMoney(next.amount)}` : s ? 'None scheduled' : '…'}</b>
            </div>
            <div>
              Active
              <b>{s ? pluralize(s.activeSubscriptions, 'subscription') : '…'}</b>
            </div>
          </div>
        </section>

        <aside className={`${h.cal} ${h.rise}`} style={{ animationDelay: '60ms' }} aria-label="Next payment">
          <div className={h.calHead}>{next ? dayjs(next.date).format('MMMM YYYY') : 'Next payment'}</div>
          <div className={h.calBody}>
            {next ? (
              <>
                <Text size="xs" c="dimmed">
                  Next payment
                </Text>
                <div className={h.calDay}>{dayjs(next.date).format('D')}</div>
                <Text size="sm" c="dimmed">
                  {dayjs(next.date).format('dddd')}
                </Text>
                <Text fw={600} className="num" mt={8}>
                  {formatMoney(next.amount)}
                </Text>
                <Text size="xs" c="dimmed">
                  {(() => {
                    const d = daysFromToday(next.date)
                    return d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`
                  })()}
                </Text>
              </>
            ) : s ? (
              <Text size="sm" c="dimmed">
                No payment is scheduled.
              </Text>
            ) : (
              <Skeleton h={80} />
            )}
          </div>
        </aside>
      </div>

      {s && s.pendingQuotations.length > 0 && (
        <>
          <Title order={2} fz={18} className={h.sectionTitle}>
            {s.pendingQuotations.length === 1 ? 'A quotation is waiting for you' : `${s.pendingQuotations.length} quotations are waiting for you`}
          </Title>
          {s.pendingQuotations.map((q) => {
            const period = periodOf(q.id)
            const days = daysFromToday(q.quotationValidUntil)
            return (
              <div key={q.id} className={`${h.quote} ${h.rise}`}>
                <div className={h.tile} style={{ background: '#FBF0DE', color: tokens.status.warn }} aria-hidden="true">
                  <IconReceipt size={24} stroke={1.5} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <Title order={3} fz={19}>
                    {q.plan.name}
                  </Title>
                  <Text size="sm" mt={2}>
                    <span className="num" style={{ fontWeight: 600 }}>
                      {formatMoney(q.recurringTotal)}
                    </span>
                    {period && <Text span c="dimmed">{` per ${periodWord(period)}, incl. tax`}</Text>}
                    <Text span c="dimmed">
                      {' · '}
                      <span className="mono">{q.number}</span>
                    </Text>
                  </Text>
                  <Text size="sm" mt={2} c={tokens.status.warn} fw={500}>
                    {days < 0
                      ? 'The reply date has passed'
                      : days === 0
                        ? 'Reply by today'
                        : `Reply within ${pluralize(days, 'day')}, by ${formatDate(q.quotationValidUntil)}`}
                  </Text>
                </div>
                <div className={h.quoteActions}>
                  <Button variant="subtle" color="gray" onClick={() => navigate(`/portal/subscriptions/${q.id}`)}>
                    Decline
                  </Button>
                  <Button onClick={() => navigate(`/portal/subscriptions/${q.id}`)}>Review quotation</Button>
                </div>
              </div>
            )
          })}
        </>
      )}

      <Title order={2} fz={18} className={h.sectionTitle}>
        Subscriptions
      </Title>
      {subs.isLoading ? (
        <div className={h.grid}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={190} radius={12} />
          ))}
        </div>
      ) : subs.error ? (
        <div className="panel">
          <QueryState isLoading={false} error={subs.error} onRetry={() => subs.refetch()} what="your subscriptions" />
        </div>
      ) : subs.data && subs.data.data.length ? (
        <>
          <div className={h.grid}>
            {subs.data.data.map((sub, i) => (
              <SubscriptionCard key={sub.id} sub={sub} index={i} />
            ))}
          </div>
          {listMeta && listMeta.totalPages > 1 && (
            <Group justify="space-between" mt={12}>
              <Text size="sm" c="dimmed">
                Page <span className="num">{listMeta.page}</span> of <span className="num">{listMeta.totalPages}</span>
              </Text>
              <Group gap={6}>
                <Button size="compact-sm" variant="default" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button size="compact-sm" variant="default" disabled={page >= listMeta.totalPages} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </Group>
            </Group>
          )}
        </>
      ) : (
        <div className="panel">
          <Stack gap={4} p={28}>
            <Text fw={500}>No subscriptions yet</Text>
            <Text size="sm" c="dimmed">
              When we send you a quotation it appears here, ready for you to review and accept.
            </Text>
          </Stack>
        </div>
      )}

      {recent.data && recent.data.data.length > 0 && (
        <>
          <Group justify="space-between" align="baseline" className={h.sectionTitle}>
            <Title order={2} fz={18}>
              Recent invoices
            </Title>
            <Anchor component={Link} to="/portal/invoices" size="sm">
              See all
            </Anchor>
          </Group>
          <div className={h.rows}>
            {recent.data.data.map((inv) => {
              const go = () => navigate(`/portal/invoices/${inv.id}`)
              const tint = inv.isOverdue
                ? ['#FBE9E7', tokens.status.bad]
                : inv.status === 'paid'
                  ? ['#E7F2EB', tokens.status.good]
                  : ['#EEF2F7', tokens.status.info]
              return (
                <div key={inv.id} className={h.row} role="link" tabIndex={0} onClick={go} onKeyDown={(e) => e.key === 'Enter' && go()}>
                  <div className={h.tile} style={{ width: 36, height: 36, background: tint[0], color: tint[1] }} aria-hidden="true">
                    <IconReceipt size={18} stroke={1.5} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" className="mono" fw={500}>
                      {inv.number}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Issued {formatDate(inv.invoiceDate)} · due {formatDate(inv.dueDate)}
                    </Text>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Text size="sm" fw={600} className="num">
                      {formatMoney(inv.total)}
                    </Text>
                    <InvoiceStatusBadge status={inv.status} overdue={inv.isOverdue} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <aside className={h.help}>
        <div className={h.tile} style={{ background: '#EEF2F7', color: '#223A5E' }} aria-hidden="true">
          <IconMail size={22} stroke={1.5} />
        </div>
        <div>
          <Title order={3} fz={17}>
            Questions about a bill?
          </Title>
          <Text size="sm" c="dimmed">
            Write to us
            {meta.data?.company.email ? (
              <>
                {' at '}
                <Anchor href={`mailto:${meta.data.company.email}`}>{meta.data.company.email}</Anchor>
              </>
            ) : null}{' '}
            and we will help you sort it out.
          </Text>
        </div>
      </aside>
    </>
  )
}
