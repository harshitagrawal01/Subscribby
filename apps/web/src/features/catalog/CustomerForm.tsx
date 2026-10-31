import { zodResolver } from '@hookform/resolvers/zod'
import { SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { customersApi } from '@/lib/api/endpoints'
import type { Customer } from '@/lib/api/types'
import { notifyDone } from '@/lib/notify'
import { requiredText, trimmed } from '@/lib/validation'
import { FormAlert, FormSection } from './components'
import { CUSTOMER_SAVE_KEY } from './hooks'
import { placeServerErrors } from './server-errors'

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

const schema = z.object({
  name: requiredText('Enter the company or person being billed').max(120, 'Keep it under 120 characters'),
  contactName: trimmed().max(80, 'Keep it under 80 characters'),
  email: trimmed().min(1, 'Enter the email invoices go to').pipe(z.email("That email doesn't look right")),
  phone: trimmed()
    .max(40, 'Keep it under 40 characters')
    .refine((v) => !v || /^[+\d][\d\s()-]{5,}$/.test(v), 'Use digits, spaces and an optional + at the start'),
  billingAddress: z.object({
    line1: trimmed().max(120, 'Too long'),
    line2: trimmed().max(120, 'Too long'),
    city: trimmed().max(60, 'Too long'),
    state: trimmed().max(60, 'Too long'),
    postalCode: trimmed().max(12, 'Too long'),
    country: trimmed().max(60, 'Too long'),
  }),
  taxId: trimmed()
    .transform((v) => v.toUpperCase())
    .refine((v) => !v || GSTIN.test(v), 'A GSTIN has 15 characters, like 29ABCDE1234F1Z5'),
  notes: trimmed().max(2000, 'Keep notes under 2,000 characters'),
})
type Values = z.input<typeof schema>
type Output = z.output<typeof schema>

const FIELDS = ['name', 'contactName', 'email', 'phone', 'billingAddress', 'taxId', 'notes']

interface Props {
  /** Edit this customer; leave out to create one. */
  customer?: Customer
  formId: string
  onSaved: (customer: Customer) => void
  /** Buttons, rendered after the fields. Gets the saving state. */
  actions?: (saving: boolean) => ReactNode
  /** Two columns where there's room (drawer), one in a narrow side panel. */
  compact?: boolean
}

/** Customer details: used by "New customer" and by the editable details on the customer page. */
export function CustomerForm({ customer, formId, onSaved, actions, compact }: Props) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const a = customer?.billingAddress ?? {}
  const { register, handleSubmit, setError, formState } = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: customer?.name ?? '',
      contactName: customer?.contactName ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
      billingAddress: {
        line1: a.line1 ?? '',
        line2: a.line2 ?? '',
        city: a.city ?? '',
        state: a.state ?? '',
        postalCode: a.postalCode ?? '',
        country: a.country || 'IN',
      },
      taxId: customer?.taxId ?? '',
      notes: customer?.notes ?? '',
    },
  })
  const e = formState.errors

  const save = useMutation({
    mutationKey: CUSTOMER_SAVE_KEY,
    mutationFn: (v: Output) => (customer ? customersApi.update(customer.id, v) : customersApi.create(v)),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      notifyDone(customer ? `Saved ${saved.name}` : `Added ${saved.name}. They get a portal login when they sign up with ${saved.email}.`)
      onSaved(saved)
    },
    onError: (error) => setFormError(placeServerErrors(error, setError, FIELDS)),
  })

  const cols = compact ? 1 : 2
  return (
    <form
      id={formId}
      noValidate
      onSubmit={handleSubmit((v) => {
        setFormError(null)
        save.mutate(v)
      })}
    >
      <Stack gap={0}>
        <FormAlert message={formError} />
        <FormSection title="Customer">
          <TextInput label="Name" description="Company or person on the invoice" {...register('name')} error={e.name?.message} data-autofocus />
          <SimpleGrid cols={cols} spacing="sm">
            <TextInput label="Contact name" {...register('contactName')} error={e.contactName?.message} autoComplete="off" />
            <TextInput label="Phone" placeholder="+91 98450 00000" {...register('phone')} error={e.phone?.message} autoComplete="off" />
          </SimpleGrid>
          <TextInput
            label="Billing email"
            type="email"
            description="Invoices and reminders go here. Signing up with this email links a portal login."
            {...register('email')}
            error={e.email?.message}
            autoComplete="off"
          />
          <TextInput
            label="GSTIN"
            placeholder="29ABCDE1234F1Z5"
            {...register('taxId')}
            error={e.taxId?.message}
            styles={{ input: { textTransform: 'uppercase' } }}
            autoComplete="off"
          />
        </FormSection>
        <FormSection title="Billing address">
          <TextInput label="Address line 1" {...register('billingAddress.line1')} error={e.billingAddress?.line1?.message} />
          <TextInput label="Address line 2" {...register('billingAddress.line2')} error={e.billingAddress?.line2?.message} />
          <SimpleGrid cols={cols} spacing="sm">
            <TextInput label="City" {...register('billingAddress.city')} error={e.billingAddress?.city?.message} />
            <TextInput label="State" {...register('billingAddress.state')} error={e.billingAddress?.state?.message} />
            <TextInput label="Postal code" {...register('billingAddress.postalCode')} error={e.billingAddress?.postalCode?.message} />
            <TextInput label="Country" {...register('billingAddress.country')} error={e.billingAddress?.country?.message} />
          </SimpleGrid>
        </FormSection>
        <FormSection title="Notes">
          <Textarea aria-label="Notes" autosize minRows={2} maxRows={6} {...register('notes')} error={e.notes?.message} />
        </FormSection>
        {actions?.(save.isPending)}
      </Stack>
    </form>
  )
}
