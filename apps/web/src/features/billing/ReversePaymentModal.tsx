import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { paymentsApi } from '@/lib/api/endpoints'
import type { Id, Paise } from '@/lib/api/types'
import { formatDate, formatMoney } from '@/lib/format'
import { notifyDone, notifyError } from '@/lib/notify'
import { requiredText } from '@/lib/validation'
import { invalidateBilling } from './invalidate'

const schema = z.object({
  reason: requiredText('Say why this payment is being reversed').pipe(z.string().max(500, 'Keep it under 500 characters')),
})
type Values = z.infer<typeof schema>

export interface ReversiblePayment {
  id: Id
  amount: Paise
  paymentDate: string
  invoiceNumber?: string
}

/** Admin only: undo a mistaken payment. The invoice balance goes back up. */
export function ReversePaymentModal({ payment, onClose }: { payment: ReversiblePayment | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { reason: '' },
  })
  const close = () => {
    reset()
    onClose()
  }
  const reverse = useMutation({
    mutationFn: ({ reason }: Values) => paymentsApi.remove(payment!.id, reason),
    onSuccess: () => {
      invalidateBilling(queryClient)
      notifyDone(
        `Payment of ${formatMoney(payment!.amount)} reversed${payment!.invoiceNumber ? ` on ${payment!.invoiceNumber}` : ''}.`,
      )
      close()
    },
    onError: (error) => notifyError(error, 'The payment was not reversed. Try again.'),
  })

  return (
    <Modal
      opened={Boolean(payment)}
      onClose={close}
      title={
        <Text component="span" fw={600} ff="heading" fz={18}>
          Reverse this payment?
        </Text>
      }
    >
      {payment && (
        <form onSubmit={handleSubmit((v) => reverse.mutate(v))} noValidate>
          <Stack gap="md">
            <Text size="sm">
              <span className="num">{formatMoney(payment.amount)}</span> received on {formatDate(payment.paymentDate)}
              {payment.invoiceNumber && (
                <>
                  {' '}
                  for <span className="mono">{payment.invoiceNumber}</span>
                </>
              )}{' '}
              will be removed and added back to the invoice balance. A paid invoice goes back to unpaid.
            </Text>
            <Textarea
              label="Reason"
              placeholder="For example: recorded twice, bounced cheque"
              autosize
              minRows={2}
              data-autofocus
              {...register('reason')}
              error={formState.errors.reason?.message}
            />
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={close}>
                Keep payment
              </Button>
              <Button type="submit" color="red" loading={reverse.isPending}>
                Reverse payment
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  )
}
