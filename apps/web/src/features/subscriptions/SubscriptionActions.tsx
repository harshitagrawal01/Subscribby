import { Anchor, Button, Group, Menu, Modal, Stack, Text, Textarea } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import { IconChevronDown, IconPencil } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { staffPath } from '@/features/auth/staff-base'
import { subscriptionsApi, templatesApi } from '@/lib/api/endpoints'
import type { Invoice, Subscription, SubscriptionAction } from '@/lib/api/types'
import { formatDate, formatMoney, today } from '@/lib/format'
import { notifyDone, notifyError } from '@/lib/notify'
import { PRIMARY_ACTIONS } from './constants'
import { humanizeDates } from './errors'

type ModalAction = Exclude<SubscriptionAction, 'edit' | 'accept' | 'reject'>

const LABEL: Record<ModalAction, string> = {
  send: 'Send quotation',
  confirm: 'Confirm',
  activate: 'Activate now',
  createInvoice: 'Create invoice now',
  resume: 'Resume',
  pause: 'Pause',
  renew: 'Renew',
  close: 'Close',
  cancel: 'Cancel subscription',
  delete: 'Delete draft',
}

const DESTRUCTIVE: ModalAction[] = ['close', 'cancel', 'delete']
const SECONDARY: ModalAction[] = ['renew', 'pause']

interface Props {
  sub: Subscription
  onEdit: () => void
}

/** Exactly the buttons the API says are allowed now, each behind a confirmation that names the subscription. */
export function SubscriptionActions({ sub, onEdit }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<ModalAction | null>(null)
  const [note, setNote] = useState('')
  const [newExpiry, setNewExpiry] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const allowed = sub.allowedActions
  const has = (a: SubscriptionAction) => allowed.includes(a)
  const primary = PRIMARY_ACTIONS.find(has) as ModalAction | undefined
  const secondary = SECONDARY.filter(has)
  const destructive = DESTRUCTIVE.filter(has)
  const who = sub.customer.name

  // How long a sent quotation stays valid comes from its template (14 days without one).
  const template = useQuery({
    queryKey: ['quotation-templates', sub.template?.id],
    queryFn: () => templatesApi.get(sub.template!.id),
    enabled: open === 'send' && Boolean(sub.template),
  })
  const validityDays = sub.template ? template.data?.validityDays : 14

  const refresh = (updated?: Subscription) => {
    if (updated) queryClient.setQueryData(['subscription', sub.id], updated)
    else queryClient.invalidateQueries({ queryKey: ['subscription', sub.id] })
    queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
    queryClient.invalidateQueries({ queryKey: ['reports'] })
    queryClient.invalidateQueries({ queryKey: ['customers'] })
  }

  const close = () => {
    setOpen(null)
    setNote('')
    setNewExpiry(null)
    setFieldError(null)
  }

  const run = useMutation({
    mutationFn: async (action: ModalAction): Promise<Subscription | Invoice | null> => {
      const trimmedNote = note.trim() || undefined
      switch (action) {
        case 'delete':
          await subscriptionsApi.remove(sub.id)
          return null
        case 'createInvoice':
          return subscriptionsApi.createInvoice(sub.id)
        case 'renew':
          return subscriptionsApi.action(sub.id, 'renew', newExpiry ? { newExpiryDate: newExpiry } : undefined)
        case 'close':
        case 'cancel':
          return subscriptionsApi.action(sub.id, action, trimmedNote ? { note: trimmedNote } : undefined)
        default:
          return subscriptionsApi.action(sub.id, action)
      }
    },
    onSuccess: (result, action) => {
      close()
      if (action === 'delete') {
        queryClient.removeQueries({ queryKey: ['subscription', sub.id] })
        queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
        notifyDone(`Draft ${sub.number} deleted`)
        navigate(staffPath('/subscriptions'), { replace: true })
        return
      }
      if (action === 'createInvoice') {
        const inv = result as Invoice
        refresh()
        queryClient.invalidateQueries({ queryKey: ['invoices'] })
        notifications.show({
          color: 'green',
          autoClose: 8000,
          message: (
            <>
              Draft invoice <span className="mono">{inv.number}</span> created for {formatMoney(inv.total)}.{' '}
              <Anchor size="sm" fw={500} onClick={() => navigate(staffPath(`/invoices/${inv.id}`))}>
                Open it
              </Anchor>
            </>
          ),
        })
        return
      }
      const updated = result as Subscription
      refresh(updated)
      const messages: Partial<Record<ModalAction, string>> = {
        send: `${sub.number} sent to ${who}. Valid until ${formatDate(updated.quotationValidUntil)}.`,
        confirm: updated.status === 'active' ? `${sub.number} confirmed and active` : `${sub.number} confirmed`,
        activate: `${sub.number} is active. First invoice ${formatDate(updated.nextInvoiceDate)}.`,
        pause: `${sub.number} paused. No invoices until it's resumed.`,
        resume: `${sub.number} resumed`,
        renew: `${sub.number} renewed until ${formatDate(updated.expiryDate)}`,
        close: `${sub.number} closed`,
        cancel: `${sub.number} cancelled`,
      }
      notifyDone(messages[action] ?? 'Done')
    },
    onError: (error) => {
      const details = (error as { details?: { field: string; message: string }[] }).details
      const onDate = details?.find((d) => d.field === 'newExpiryDate')
      if (onDate) setFieldError(humanizeDates(onDate.message))
      else {
        notifyError(error, 'That didn’t work. Try again.')
        if (open !== 'renew') close()
        refresh()
      }
    },
  })

  if (!allowed.length) return null

  const startPassed = sub.startDate <= today()
  const content: Record<ModalAction, { title: string; body: ReactNode; confirm: string; danger?: boolean }> = {
    send: {
      title: `Send ${sub.number} to ${who}?`,
      body: (
        <>
          It becomes a quotation the customer can accept
          {validityDays ? (
            <>
              , valid for {validityDays} days (until {formatDate(dayjs().add(validityDays, 'day').format('YYYY-MM-DD'))})
            </>
          ) : null}
          . If {who} has a portal login, {sub.customer.email ?? 'their billing email'} gets an email with the quote.
        </>
      ),
      confirm: 'Send quotation',
    },
    confirm: {
      title: `Confirm ${sub.number} for ${who}?`,
      body: startPassed
        ? `The start date (${formatDate(sub.startDate)}) has arrived, so it becomes active straight away and billing starts.`
        : `It becomes active on ${formatDate(sub.startDate)}, when billing starts.`,
      confirm: 'Confirm',
    },
    activate: {
      title: `Activate ${sub.number} now?`,
      body: `Billing starts from ${formatDate(sub.startDate)}. This normally happens by itself on the start date.`,
      confirm: 'Activate',
    },
    createInvoice: {
      title: `Invoice ${who} now?`,
      body: `Creates a draft invoice for the period starting ${formatDate(sub.nextInvoiceDate)}, exactly as the billing run would. You can review it before confirming.`,
      confirm: 'Create invoice',
    },
    pause: {
      title: `Pause ${sub.number}?`,
      body: `No invoices are created while it's paused. Paused time is never billed.`,
      confirm: 'Pause',
    },
    resume: {
      title: `Resume ${sub.number}?`,
      body: `Billing picks up from today or the next invoice date, whichever is later.`,
      confirm: 'Resume',
    },
    renew: {
      title: `Renew ${sub.number}?`,
      body: `It runs until ${formatDate(sub.expiryDate)} now. Leave the date empty to extend by one more term of the same length.`,
      confirm: 'Renew',
    },
    close: {
      title: `Close ${sub.number}?`,
      body: sub.isExpired
        ? `It passed its expiry date on ${formatDate(sub.expiryDate)}. Closing stops billing for good.`
        : `It closes today and no more invoices are created for ${who}. This can't be undone.`,
      confirm: 'Close subscription',
      danger: true,
    },
    cancel: {
      title: `Cancel ${sub.number}?`,
      body: `The ${sub.status === 'draft' ? 'draft' : sub.status === 'quotation' ? 'quotation' : 'subscription'} for ${who} is closed as cancelled. This can't be undone.`,
      confirm: 'Cancel subscription',
      danger: true,
    },
    delete: {
      title: `Delete draft ${sub.number}?`,
      body: `The draft for ${who} is removed for good. Drafts were never sent, so the customer won't notice.`,
      confirm: 'Delete draft',
      danger: true,
    },
  }
  const current = open ? content[open] : null

  return (
    <>
      <Group gap={8} wrap="wrap">
        {has('edit') && (
          <Button variant="default" leftSection={<IconPencil size={15} stroke={1.5} />} onClick={onEdit}>
            Edit
          </Button>
        )}
        {secondary.map((a) => (
          <Button key={a} variant="default" onClick={() => setOpen(a)}>
            {LABEL[a]}
          </Button>
        ))}
        {destructive.length > 0 && (
          <Menu position="bottom-end">
            <Menu.Target>
              <Button variant="default" rightSection={<IconChevronDown size={14} stroke={1.5} />}>
                More
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {destructive.map((a) => (
                <Menu.Item key={a} color="red" onClick={() => setOpen(a)}>
                  {LABEL[a]}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        )}
        {primary && <Button onClick={() => setOpen(primary)}>{LABEL[primary]}</Button>}
      </Group>

      <Modal opened={Boolean(open)} onClose={close} title={current?.title} size="md">
        {open && current && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              run.mutate(open)
            }}
          >
            <Stack gap="md">
              <Text size="sm">{current.body}</Text>
              {open === 'renew' && (
                <DateInput
                  label="New expiry date"
                  description="Optional"
                  placeholder="One more term"
                  valueFormat="DD MMM YYYY"
                  clearable
                  minDate={dayjs(sub.expiryDate).add(1, 'day').format('YYYY-MM-DD')}
                  value={newExpiry}
                  onChange={(d) => {
                    setNewExpiry(d)
                    setFieldError(null)
                  }}
                  error={fieldError}
                />
              )}
              {(open === 'close' || open === 'cancel') && (
                <Textarea
                  label="Note"
                  description="Optional. Saved in the history."
                  placeholder={open === 'close' ? 'Why it is closing' : 'Why it was cancelled'}
                  autosize
                  minRows={2}
                  value={note}
                  onChange={(e) => setNote(e.currentTarget.value)}
                  maxLength={500}
                  data-autofocus
                />
              )}
              <Group justify="flex-end" gap={8} mt={4}>
                <Button variant="default" onClick={close}>
                  {current.danger ? 'Keep it' : 'Not now'}
                </Button>
                <Button type="submit" color={current.danger ? 'red' : undefined} loading={run.isPending} data-autofocus={open !== 'close' && open !== 'cancel' ? true : undefined}>
                  {current.confirm}
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Modal>
    </>
  )
}
