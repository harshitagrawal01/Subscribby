import { Alert, Anchor, Button, Group, Modal, Stack, Text, Title } from '@mantine/core'
import { IconAlertCircle, IconArrowLeft } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { QueryState } from '@/components/QueryState'
import { SubscriptionStatusBadge } from '@/components/StatusBadge'
import { paymentTermsText, periodWord } from '@/features/portal/format'
import { InvoiceTable } from '@/features/portal/InvoiceTable'
import { LinesTable } from '@/features/portal/LinesTable'
import classes from '@/features/portal/portal.module.css'
import { isApiError } from '@/lib/api/client'
import { portalApi } from '@/lib/api/endpoints'
import type { Subscription } from '@/lib/api/types'
import { formatDate, formatMoney } from '@/lib/format'
import { notifyDone } from '@/lib/notify'

type PortalAction = 'accept' | 'reject' | 'pause' | 'resume' | 'renew' | 'close'

/** What each action does, in the customer's words, for the confirm dialog. */
function actionCopy(action: PortalAction, sub: Subscription) {
  const amount = `${formatMoney(sub.totals.total)} per ${periodWord(sub.plan.billingPeriod)}`
  switch (action) {
    case 'accept':
      return {
        title: `Accept quotation ${sub.number}?`,
        body: `You're agreeing to ${sub.plan.name} at ${amount} including tax, starting ${formatDate(sub.startDate)} and running until ${formatDate(sub.expiryDate)}. We'll invoice you every ${periodWord(sub.plan.billingPeriod)}.`,
        button: 'Accept quotation',
        done: `Quotation ${sub.number} accepted. Thank you!`,
        danger: false,
      }
    case 'reject':
      return {
        title: `Decline quotation ${sub.number}?`,
        body: `We'll let the team know you've declined ${sub.plan.name} at ${amount}. You can't reopen this quotation afterwards, but you can always ask for a new one.`,
        button: 'Decline quotation',
        done: `Quotation ${sub.number} declined`,
        danger: true,
      }
    case 'pause':
      return {
        title: `Pause ${sub.number}?`,
        body: 'No invoices are created while the subscription is paused. You can resume it at any time.',
        button: 'Pause subscription',
        done: `${sub.number} paused`,
        danger: false,
      }
    case 'resume':
      return {
        title: `Resume ${sub.number}?`,
        body: `Billing starts again at ${amount}. Paused time is never billed.`,
        button: 'Resume subscription',
        done: `${sub.number} resumed`,
        danger: false,
      }
    case 'renew':
      return {
        title: `Renew ${sub.number}?`,
        body: `The end date moves forward by one more term from ${formatDate(sub.expiryDate)}, at ${amount}.`,
        button: 'Renew subscription',
        done: `${sub.number} renewed`,
        danger: false,
      }
    case 'close':
      return {
        title: `Close ${sub.number}?`,
        body: 'No more invoices will be created. Invoices you already have still need to be paid.',
        button: 'Close subscription',
        done: `${sub.number} closed`,
        danger: true,
      }
  }
}

const SELF_SERVICE: PortalAction[] = ['pause', 'resume', 'renew', 'close']
const ACTION_LABEL: Record<PortalAction, string> = {
  accept: 'Accept quotation',
  reject: 'Decline',
  pause: 'Pause',
  resume: 'Resume',
  renew: 'Renew',
  close: 'Close subscription',
}

function closeReasonText(reason: string | null | undefined) {
  switch (reason) {
    case 'rejected':
      return 'You declined this quotation.'
    case 'quotation_expired':
      return 'This quotation expired before it was accepted.'
    case 'cancelled':
      return 'This subscription was cancelled.'
    case 'expired':
      return 'This subscription reached its end date.'
    case 'closed_early':
      return 'This subscription was closed before its end date.'
    default:
      return 'This subscription is closed.'
  }
}

export function PortalSubscriptionDetailPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<PortalAction | null>(null)
  const [shownAction, setShownAction] = useState<PortalAction | null>(null)
  if (pending && pending !== shownAction) setShownAction(pending)

  const sub = useQuery({ queryKey: ['portal', 'subscription', id], queryFn: () => portalApi.subscription(id) })
  // The portal invoice list has no subscription filter, so filter the customer's own invoices here.
  const invoices = useQuery({
    queryKey: ['portal', 'invoices', { limit: 100 }],
    queryFn: () => portalApi.invoices({ limit: 100, sort: '-invoiceDate' }),
  })

  const act = useMutation({
    mutationFn: (action: PortalAction) => portalApi.action(id, action),
    onSuccess: (updated, action) => {
      queryClient.setQueryData(['portal', 'subscription', id], updated)
      queryClient.invalidateQueries({ queryKey: ['portal'] })
      notifyDone(actionCopy(action, updated).done)
      setPending(null)
    },
  })

  if (sub.isLoading || sub.error || !sub.data) {
    const notFound = isApiError(sub.error) && sub.error.code === 'NOT_FOUND'
    return (
      <>
        <BackLink />
        {notFound ? (
          <Stack gap={6} className="panel" p={28}>
            <Text fw={500}>We can't find this subscription</Text>
            <Text size="sm" c="dimmed">
              It may have been removed, or the link belongs to another account.{' '}
              <Anchor component={Link} to="/portal/subscriptions">
                Back to your subscriptions
              </Anchor>
            </Text>
          </Stack>
        ) : (
          <div className="panel">
            <QueryState isLoading={sub.isLoading} error={sub.error} onRetry={() => sub.refetch()} rows={6} what="this subscription" />
          </div>
        )}
      </>
    )
  }

  const s = sub.data
  const period = periodWord(s.plan.billingPeriod)
  const canAccept = s.allowedActions.includes('accept')
  const canReject = s.allowedActions.includes('reject')
  const selfService = SELF_SERVICE.filter((a) => s.allowedActions.includes(a))
  const ownInvoices = invoices.data?.data.filter((inv) => inv.subscription.id === s.id) ?? []
  const copy = shownAction ? actionCopy(shownAction, s) : null

  return (
    <>
      <BackLink />
      <Group justify="space-between" align="flex-end" mb={20} wrap="wrap" gap="md">
        <div>
          <Group gap={12} align="baseline">
            <Title order={1} fz={26}>
              {s.plan.name}
            </Title>
            <SubscriptionStatusBadge status={s.status} />
          </Group>
          <Text size="sm" c="dimmed" mt={4}>
            <span className="mono">{s.number}</span> · {formatMoney(s.totals.total)} per {period}, including tax
          </Text>
        </div>
        {selfService.length > 0 && (
          <Group gap={8}>
            {selfService.map((action) => (
              <Button key={action} variant="default" color={action === 'close' ? 'red' : undefined} onClick={() => setPending(action)}>
                {ACTION_LABEL[action]}
              </Button>
            ))}
          </Group>
        )}
      </Group>

      {(canAccept || canReject) && (
        <div className={classes.callout}>
          <div>
            <Text fw={500}>Please review this quotation</Text>
            <Text size="sm" c="dimmed" mt={2}>
              Accept by {formatDate(s.quotationValidUntil)} to start on {formatDate(s.startDate)}. Nothing is charged until the first invoice.
            </Text>
          </div>
          <Group gap={8}>
            {canReject && (
              <Button variant="default" onClick={() => setPending('reject')}>
                Decline
              </Button>
            )}
            {canAccept && <Button onClick={() => setPending('accept')}>Accept quotation</Button>}
          </Group>
        </div>
      )}

      {s.status === 'quotation' && !canAccept && (
        <Alert color="orange" variant="light" mb={16} icon={<IconAlertCircle size={16} />}>
          This quotation can no longer be accepted. Ask us for an updated one.
        </Alert>
      )}
      {s.status === 'confirmed' && (
        <Text size="sm" c="dimmed" mb={16}>
          You've accepted this subscription. It starts on {formatDate(s.startDate)}, and your first invoice follows from then.
        </Text>
      )}
      {s.status === 'closed' && (
        <Text size="sm" c="dimmed" mb={16}>
          {closeReasonText(s.closeReason)}
        </Text>
      )}
      {s.isExpired && s.status !== 'closed' && (
        <Alert color="orange" variant="light" mb={16} icon={<IconAlertCircle size={16} />}>
          This subscription passed its end date on {formatDate(s.expiryDate)}. Billing has stopped until it's renewed.
        </Alert>
      )}

      <div className="panel">
        <dl className={classes.facts}>
          <div>
            <dt>Starts</dt>
            <dd>{formatDate(s.startDate)}</dd>
          </div>
          <div>
            <dt>Ends</dt>
            <dd>{formatDate(s.expiryDate)}</dd>
          </div>
          <div>
            <dt>Next invoice</dt>
            <dd>
              {s.status === 'quotation'
                ? 'After you accept'
                : s.status === 'confirmed'
                  ? `When it starts, ${formatDate(s.startDate)}`
                  : s.status === 'paused'
                    ? 'Paused'
                    : formatDate(s.nextInvoiceDate)}
            </dd>
          </div>
          <div>
            <dt>Billed</dt>
            <dd style={{ textTransform: 'capitalize' }}>{s.plan.billingPeriod}</dd>
          </div>
          <div>
            <dt>Payment terms</dt>
            <dd>{paymentTermsText(s.paymentTermDays)}</dd>
          </div>
        </dl>
      </div>

      <section className="panel" style={{ marginTop: 16, padding: '20px 24px 24px' }}>
        <Title order={2} fz={16} mb={4}>
          What's included
        </Title>
        <Text size="sm" c="dimmed" mb={12}>
          Prices for one {period}, as they would be invoiced today.
        </Text>
        <LinesTable lines={s.lines} totals={s.totals} orderDiscount={s.orderDiscount} totalLabel={`Total per ${period}`} />
      </section>

      {s.status !== 'quotation' && (
        <section className="panel" style={{ marginTop: 16 }}>
          <Group justify="space-between" px={24} pt={18} pb={8}>
            <Title order={2} fz={16}>
              Invoices
            </Title>
            {ownInvoices.length > 0 && (
              <Anchor component={Link} to="/portal/invoices" size="sm">
                All invoices
              </Anchor>
            )}
          </Group>
          <QueryState isLoading={invoices.isLoading} error={invoices.error} onRetry={() => invoices.refetch()} rows={3} what="invoices" />
          {invoices.data &&
            (ownInvoices.length ? (
              <InvoiceTable invoices={ownInvoices} showSubscription={false} />
            ) : (
              <Text size="sm" c="dimmed" px={24} pb={22}>
                No invoices yet.{' '}
                {s.status === 'confirmed'
                  ? `The first one is created when the subscription starts on ${formatDate(s.startDate)}.`
                  : s.nextInvoiceDate
                    ? `The first one is due to be created on ${formatDate(s.nextInvoiceDate)}.`
                    : ''}
              </Text>
            ))}
        </section>
      )}

      <Modal opened={Boolean(pending)} onClose={() => {
          if (act.isPending) return
          setPending(null)
          act.reset()
        }} title={copy?.title} size={480}>
        {copy && shownAction && (
          <Stack gap="md">
            {act.error && (
              <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                {isApiError(act.error) ? act.error.message : 'That didn’t work. Try again.'}
              </Alert>
            )}
            <Text size="sm">{copy.body}</Text>
            <Group justify="flex-end">
              <Button
                variant="default"
                onClick={() => {
                  setPending(null)
                  act.reset()
                }}
                disabled={act.isPending}
              >
                Not now
              </Button>
              <Button color={copy.danger ? 'red' : undefined} loading={act.isPending} onClick={() => act.mutate(shownAction)}>
                {copy.button}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  )
}

function BackLink() {
  return (
    <Anchor component={Link} to="/portal/subscriptions" size="sm" c="dimmed" className={classes.back}>
      <IconArrowLeft size={14} stroke={1.5} /> Subscriptions
    </Anchor>
  )
}
