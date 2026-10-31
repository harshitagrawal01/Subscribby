import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Anchor, Button, Checkbox, Group, Modal, SimpleGrid, Skeleton, Stack, Text, Textarea } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useDisclosure } from '@mantine/hooks'
import { IconAlertCircle, IconArrowLeft, IconPrinter } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import { z } from 'zod'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { InvoiceStatusBadge } from '@/components/StatusBadge'
import { applyServerErrors } from '@/features/auth/form-errors'
import { staffPath } from '@/features/auth/staff-base'
import { useAuth } from '@/features/auth/useAuth'
import { invalidateBilling } from '@/features/billing/invalidate'
import { InvoiceDocument } from '@/features/billing/InvoiceDocument'
import invoiceDocumentClasses from '@/features/billing/InvoiceDocument.module.css'
import { RecordPaymentModal } from '@/features/billing/RecordPaymentModal'
import { ReversePaymentModal, type ReversiblePayment } from '@/features/billing/ReversePaymentModal'
import { invoicesApi } from '@/lib/api/endpoints'
import type { Invoice } from '@/lib/api/types'
import { formatDate, formatDateTime, formatMoney, pluralize } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/labels'
import { notifyDone, notifyError } from '@/lib/notify'
import { trimmed } from '@/lib/validation'
import { tokens } from '@/theme'

const ModalTitle = ({ children }: { children: React.ReactNode }) => (
  <Text component="span" fw={600} ff="heading" fz={18}>
    {children}
  </Text>
)

// ---------------------------------------------------------------- edit draft

const editSchema = z
  .object({
    invoiceDate: z.string().min(1, 'Pick the invoice date'),
    dueDate: z.string().min(1, 'Pick the due date'),
    notes: trimmed().max(4000, 'Keep notes under 4,000 characters'),
  })
  .refine((v) => v.dueDate >= v.invoiceDate, { path: ['dueDate'], message: 'Must be on or after the invoice date' })
type EditValues = z.infer<typeof editSchema>

function EditDraftModal({ invoice, opened, onClose }: { invoice: Invoice; opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const { control, register, handleSubmit, setError, formState } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { invoiceDate: invoice.invoiceDate, dueDate: invoice.dueDate, notes: invoice.notes ?? '' },
  })
  const save = useMutation({
    mutationFn: (values: EditValues) => invoicesApi.update(invoice.id, values),
    onSuccess: (data) => {
      queryClient.setQueryData(['invoices', 'detail', invoice.id], data)
      invalidateBilling(queryClient)
      notifyDone(`${invoice.number} updated.`)
      onClose()
    },
    onError: (error) => setFormError(applyServerErrors(error, setError, ['invoiceDate', 'dueDate', 'notes'])),
  })

  return (
    <Modal opened={opened} onClose={onClose} title={<ModalTitle>Edit draft {invoice.number}</ModalTitle>}>
      <form
        noValidate
        onSubmit={handleSubmit((v) => {
          setFormError(null)
          save.mutate(v)
        })}
      >
        <Stack gap="md">
          {formError && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
              {formError}
            </Alert>
          )}
          <Text size="sm" c="dimmed">
            Lines and amounts come from the subscription. Only the dates and notes of a draft can change.
          </Text>
          <SimpleGrid cols={2}>
            {(['invoiceDate', 'dueDate'] as const).map((name) => (
              <Controller
                key={name}
                control={control}
                name={name}
                render={({ field }) => (
                  <DateInput
                    label={name === 'invoiceDate' ? 'Invoice date' : 'Due date'}
                    valueFormat="DD MMM YYYY"
                    value={field.value || null}
                    onChange={(v) => field.onChange(v ? dayjs(v).format('YYYY-MM-DD') : '')}
                    onBlur={field.onBlur}
                    error={formState.errors[name]?.message}
                    data-autofocus={name === 'invoiceDate' || undefined}
                  />
                )}
              />
            ))}
          </SimpleGrid>
          <Textarea
            label="Notes"
            description="Printed on the invoice"
            autosize
            minRows={3}
            {...register('notes')}
            error={formState.errors.notes?.message}
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              Save changes
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------- cancel

function CancelInvoiceModal({ invoice, opened, onClose }: { invoice: Invoice; opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [rebill, setRebill] = useState(true)
  const cancel = useMutation({
    mutationFn: () => invoicesApi.cancel(invoice.id, rebill),
    onSuccess: (data) => {
      queryClient.setQueryData(['invoices', 'detail', invoice.id], data)
      invalidateBilling(queryClient)
      notifyDone(`${invoice.number} cancelled.${rebill ? ' The next billing run will bill this period again.' : ''}`)
      onClose()
    },
    onError: (error) => notifyError(error, 'The invoice was not cancelled. Try again.'),
  })
  return (
    <Modal opened={opened} onClose={onClose} title={<ModalTitle>Cancel {invoice.number}?</ModalTitle>}>
      <Stack gap="md">
        <Text size="sm">
          The invoice becomes void and can't be paid. Any discount it used is given back. This can't be undone.
        </Text>
        <Checkbox
          checked={rebill}
          onChange={(e) => setRebill(e.currentTarget.checked)}
          label="Bill this period again"
          description={`The next billing run creates a new invoice for ${formatDate(invoice.periodStart)} to ${formatDate(invoice.periodEnd)}. Works when this is the subscription's latest invoice.`}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Keep invoice
          </Button>
          <Button color="red" loading={cancel.isPending} onClick={() => cancel.mutate()}>
            Cancel invoice
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

// ---------------------------------------------------------------- aside

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Group justify="space-between" align="baseline" py={8} wrap="nowrap" style={{ borderBottom: `1px solid ${tokens.line}` }}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" ta="right" component="div">
        {children}
      </Text>
    </Group>
  )
}

function PaymentsPanel({
  invoice,
  canReverse,
  onReverse,
}: {
  invoice: Invoice
  canReverse: boolean
  onReverse: (p: ReversiblePayment) => void
}) {
  return (
    <section className="panel">
      <Group justify="space-between" px={18} pt={14} pb={6}>
        <Text component="h2" fw={600} ff="heading" fz={15} m={0}>
          Payments
        </Text>
        {invoice.payments.length > 0 && (
          <Anchor component={Link} to={staffPath(`/payments?search=${encodeURIComponent(invoice.number)}`)} size="sm">
            In payments list
          </Anchor>
        )}
      </Group>
      {invoice.payments.length ? (
        <Stack gap={0} px={18} pb={8}>
          {invoice.payments.map((p, i) => (
            <div key={p.id} style={{ borderTop: i ? `1px solid ${tokens.line}` : undefined, padding: '10px 0' }}>
              <Group justify="space-between" wrap="nowrap" align="baseline">
                <Text size="sm" className="num" fw={500} c={tokens.status.good}>
                  {formatMoney(p.amount)}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatDate(p.paymentDate)}
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                {PAYMENT_METHOD_LABELS[p.method]}
                {p.recordedBy ? ` · recorded by ${p.recordedBy.name}` : ''}
              </Text>
              {p.note && <Text size="xs">{p.note}</Text>}
              {canReverse && (
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="red"
                  px={0}
                  mt={2}
                  onClick={() =>
                    onReverse({ id: p.id, amount: p.amount, paymentDate: p.paymentDate, invoiceNumber: invoice.number })
                  }
                >
                  Reverse
                </Button>
              )}
            </div>
          ))}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed" px={18} pb={16}>
          {invoice.status === 'draft'
            ? 'Payments can be recorded once the invoice is confirmed.'
            : invoice.status === 'cancelled'
              ? 'No payments. The invoice is cancelled.'
              : 'Nothing received yet.'}
        </Text>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- page

export function InvoiceDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [editOpened, edit] = useDisclosure(false)
  const [cancelOpened, cancel] = useDisclosure(false)
  const [payOpened, pay] = useDisclosure(false)
  const [reversing, setReversing] = useState<ReversiblePayment | null>(null)

  const detail = useQuery({ queryKey: ['invoices', 'detail', id], queryFn: () => invoicesApi.get(id) })
  const invoice = detail.data

  const onUpdated = (data: Invoice, message: string) => {
    queryClient.setQueryData(['invoices', 'detail', id], data)
    invalidateBilling(queryClient)
    notifyDone(message)
  }
  const confirm = useMutation({
    mutationFn: () => invoicesApi.confirm(id),
    onSuccess: (data) => onUpdated(data, `${data.number} confirmed. Lines and amounts are now locked.`),
    onError: (error) => notifyError(error, 'The invoice was not confirmed. Try again.'),
  })
  const send = useMutation({
    mutationFn: () => invoicesApi.send(id),
    onSuccess: (data) => onUpdated(data, `${data.number} emailed to ${data.customerSnapshot.email}.`),
    onError: (error) => notifyError(error, 'The invoice was not sent. Try again.'),
  })

  const back = (
    <Anchor component={Link} to={staffPath('/invoices')} size="sm" c="dimmed" className={invoiceDocumentClasses.noPrint}>
      <Group gap={4} component="span" style={{ display: 'inline-flex' }}>
        <IconArrowLeft size={14} stroke={1.5} /> Invoices
      </Group>
    </Anchor>
  )

  if (!invoice)
    return (
      <>
        {back}
        {detail.isLoading ? (
          <Stack gap={12} mt={16}>
            <Skeleton h={26} w={320} />
            <Skeleton h={560} radius="md" />
          </Stack>
        ) : (
          <div className="panel" style={{ marginTop: 16 }}>
            <QueryState isLoading={false} error={detail.error} onRetry={() => detail.refetch()} what="this invoice" />
          </div>
        )}
      </>
    )

  const can = (a: Invoice['allowedActions'][number]) => invoice.allowedActions.includes(a)
  const isAdmin = user?.role === 'admin'

  return (
    <>
      {back}
      <div style={{ marginTop: 8 }}>
        <PageHeader
          title={
            <>
              Invoice{' '}
              <Text span className="mono" fz={20} fw={500}>
                {invoice.number}
              </Text>
            </>
          }
          description={
            <Group gap={8} component="span" style={{ display: 'inline-flex' }}>
              <InvoiceStatusBadge status={invoice.status} overdue={invoice.isOverdue} />
              <span>
                · {invoice.customer.name} · {formatMoney(invoice.total)}
              </span>
            </Group>
          }
          actions={
            <Group gap={8} className={invoiceDocumentClasses.noPrint}>
              {can('cancel') && (
                <Button variant="subtle" color="red" onClick={cancel.open}>
                  Cancel invoice
                </Button>
              )}
              {can('edit') && (
                <Button variant="default" onClick={edit.open}>
                  Edit dates and notes
                </Button>
              )}
              <Button variant="default" leftSection={<IconPrinter size={16} stroke={1.5} />} onClick={() => window.print()}>
                Print
              </Button>
              {can('send') && (
                <Button
                  variant={can('recordPayment') || invoice.status === 'paid' ? 'default' : 'filled'}
                  loading={send.isPending}
                  onClick={() => send.mutate()}
                >
                  {invoice.sentCount ? (invoice.isOverdue ? 'Send reminder' : 'Resend') : 'Send to customer'}
                </Button>
              )}
              {can('recordPayment') && <Button onClick={pay.open}>Record payment</Button>}
              {can('confirm') && (
                <Button loading={confirm.isPending} onClick={() => confirm.mutate()}>
                  Confirm invoice
                </Button>
              )}
            </Group>
          }
        />
      </div>

      <div className={invoiceDocumentClasses.layout}>
        <InvoiceDocument invoice={invoice} />

        <Stack gap={16} className={invoiceDocumentClasses.noPrint}>
          <section className="panel" style={{ padding: '6px 18px 10px' }}>
            <Fact label="Balance due">
              <Text span className="num" fw={600} c={invoice.isOverdue ? tokens.status.bad : undefined}>
                {invoice.status === 'cancelled' ? '—' : formatMoney(invoice.balance)}
              </Text>
            </Fact>
            <Fact label="Paid so far">
              <span className="num">{formatMoney(invoice.amountPaid)}</span>
            </Fact>
            <Fact label="Emailed">
              {invoice.sentCount ? (
                <>
                  {pluralize(invoice.sentCount, 'time')}
                  <Text size="xs" c="dimmed">
                    last {formatDateTime(invoice.sentAt)}
                  </Text>
                </>
              ) : (
                <Text span size="sm" c="dimmed">
                  Not yet
                </Text>
              )}
            </Fact>
            <Group justify="space-between" align="baseline" py={8} wrap="nowrap">
              <Text size="sm" c="dimmed">
                Created by
              </Text>
              <Text size="sm">{invoice.createdBy === 'system' ? 'Billing run' : 'Staff'}</Text>
            </Group>
          </section>

          <PaymentsPanel invoice={invoice} canReverse={isAdmin} onReverse={setReversing} />
        </Stack>
      </div>

      {can('edit') && (
        <EditDraftModal
          key={`${invoice.invoiceDate}|${invoice.dueDate}|${invoice.notes ?? ''}`}
          invoice={invoice}
          opened={editOpened}
          onClose={edit.close}
        />
      )}
      <CancelInvoiceModal invoice={invoice} opened={cancelOpened} onClose={cancel.close} />
      <RecordPaymentModal
        opened={payOpened}
        onClose={pay.close}
        invoice={{ id: invoice.id, number: invoice.number, balance: invoice.balance, customerName: invoice.customer.name }}
      />
      <ReversePaymentModal payment={reversing} onClose={() => setReversing(null)} />
    </>
  )
}
