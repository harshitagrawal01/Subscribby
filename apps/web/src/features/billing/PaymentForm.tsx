import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Group, Select, SimpleGrid, Stack, TextInput } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconAlertCircle } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { MoneyInput } from '@/components/MoneyInput'
import { applyServerErrors } from '@/features/auth/form-errors'
import { isApiError } from '@/lib/api/client'
import { invoicesApi, paymentsApi } from '@/lib/api/endpoints'
import type { Id, Paise, PaymentMethod } from '@/lib/api/types'
import { formatMoney, today } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/labels'
import { notifyDone } from '@/lib/notify'
import { trimmed } from '@/lib/validation'
import { invalidateBilling } from './invalidate'

const METHODS = Object.keys(PAYMENT_METHOD_LABELS) as [PaymentMethod, ...PaymentMethod[]]

const schema = z.object({
  method: z.enum(METHODS, { error: 'Pick how the customer paid' }),
  amount: z.number({ error: 'Enter the amount received' }).int().min(1, 'Enter an amount above ₹0'),
  paymentDate: z
    .string({ error: 'Pick the date it was paid' })
    .min(1, 'Pick the date it was paid')
    .refine((d) => d <= today(), "Can't be in the future"),
  note: trimmed().max(500, 'Keep the note under 500 characters'),
})
type Values = z.infer<typeof schema>

export interface PayableInvoice {
  id: Id
  number: string
  balance: Paise
  customerName?: string
}

/** Record a payment against one confirmed invoice. Used on the invoice page and the payments list. */
export function PaymentForm({
  invoice,
  onDone,
  onCancel,
}: {
  invoice: PayableInvoice
  onDone: () => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  // Starts as the invoice balance; refreshed if the server says the payment is now too large.
  const [balance, setBalance] = useState(invoice.balance)

  const { control, register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { method: 'bank_transfer', amount: invoice.balance, paymentDate: today(), note: '' },
  })

  const save = useMutation({
    mutationFn: (values: Values) => paymentsApi.create({ invoiceId: invoice.id, ...values, note: values.note || undefined }),
    onSuccess: (result) => {
      invalidateBilling(queryClient)
      notifyDone(
        result.invoice.status === 'paid'
          ? `${formatMoney(result.payment.amount)} recorded. ${result.invoice.number} is now paid.`
          : `${formatMoney(result.payment.amount)} recorded on ${result.invoice.number}. ${formatMoney(result.invoice.balance)} still due.`,
      )
      onDone()
    },
    onError: async (error) => {
      if (isApiError(error) && error.code === 'OVERPAYMENT') {
        // Someone may have recorded a payment meanwhile: show the balance as it is now.
        const fresh = await invoicesApi.get(invoice.id).catch(() => null)
        if (fresh) setBalance(fresh.balance)
        invalidateBilling(queryClient)
        setError('amount', {
          message: `More than the balance due${fresh ? ` of ${formatMoney(fresh.balance)}` : ''}. Lower the amount.`,
        })
        return
      }
      setFormError(applyServerErrors(error, setError, ['method', 'amount', 'paymentDate', 'note']))
    },
  })

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    if (values.amount > balance) {
      setError('amount', { message: `Can't be more than the balance due of ${formatMoney(balance)}` })
      return
    }
    save.mutate(values)
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack gap="md">
        {formError && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            {formError}
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <MoneyInput
                label="Amount received"
                description={`Balance due ${formatMoney(balance)}`}
                value={field.value}
                onChange={(v) => field.onChange(v ?? undefined)}
                onBlur={field.onBlur}
                error={formState.errors.amount?.message}
                data-autofocus
              />
            )}
          />
          <Controller
            control={control}
            name="paymentDate"
            render={({ field }) => (
              <DateInput
                label="Paid on"
                description="The day the money arrived"
                valueFormat="DD MMM YYYY"
                maxDate={today()}
                value={field.value || null}
                onChange={(v) => field.onChange(v ? dayjs(v).format('YYYY-MM-DD') : '')}
                onBlur={field.onBlur}
                error={formState.errors.paymentDate?.message}
              />
            )}
          />
        </SimpleGrid>
        <Controller
          control={control}
          name="method"
          render={({ field }) => (
            <Select
              label="Method"
              allowDeselect={false}
              data={METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
              value={field.value ?? null}
              onChange={(v) => field.onChange(v)}
              error={formState.errors.method?.message}
            />
          )}
        />
        <TextInput
          label="Note"
          placeholder="UTR, cheque number or anything that helps find it later"
          {...register('note')}
          error={formState.errors.note?.message}
        />
        <Group justify="flex-end" gap="sm" mt={4}>
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Record payment
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
