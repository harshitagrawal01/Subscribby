import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Anchor, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { applyServerErrors } from '@/features/auth/form-errors'
import { useAuth } from '@/features/auth/useAuth'
import { ChangePasswordForm } from '@/features/people/ChangePasswordForm'
import { ProfileSection, ReadOnlyField } from '@/features/people/ProfileSection'
import { addressLines } from '@/features/portal/format'
import type { CustomerMe } from '@/features/portal/types'
import { authApi, metaApi } from '@/lib/api/endpoints'
import { notifyDone } from '@/lib/notify'
import { requiredText, trimmed } from '@/lib/validation'

const schema = z.object({
  name: requiredText('Enter your name').pipe(z.string().min(2, 'Use at least 2 characters').max(80, 'Keep it under 80 characters')),
  phone: trimmed()
    .max(40, 'Keep it under 40 characters')
    .refine((v) => v === '' || /^[+()\d\s-]{6,}$/.test(v), 'Use digits, spaces and an optional + country code'),
})
type Values = z.infer<typeof schema>

export function PortalProfilePage() {
  const { refresh } = useAuth()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const me = useQuery({ queryKey: ['me'], queryFn: () => authApi.me() as Promise<CustomerMe> })
  const meta = useQuery({ queryKey: ['meta'], queryFn: () => metaApi.get(), staleTime: Infinity })
  const { register, handleSubmit, setError, reset, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    values: me.data ? { name: me.data.name, phone: me.data.customer?.phone ?? '' } : undefined,
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const updated = (await authApi.updateMe(values)) as CustomerMe
      queryClient.setQueryData(['me'], updated)
      await refresh()
      reset({ name: updated.name, phone: updated.customer?.phone ?? '' })
      notifyDone('Contact details saved')
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['name', 'phone']))
    }
  })

  const customer = me.data?.customer
  const billingEmail = meta.data?.company.email

  return (
    <>
      <PageHeader title="Your profile" description="Your contact details, your company's billing details and your password." />
      {!me.data ? (
        <div className="panel">
          <QueryState isLoading={me.isLoading} error={me.error} onRetry={() => me.refetch()} rows={4} what="your profile" />
        </div>
      ) : (
        <Stack gap={16} maw={820}>
          <ProfileSection title="Contact details" description="Who we talk to about this account.">
            <form onSubmit={onSubmit} noValidate>
              <Stack gap="md" maw={420}>
                {formError && (
                  <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                    {formError}
                  </Alert>
                )}
                <TextInput label="Your name" autoComplete="name" {...register('name')} error={formState.errors.name?.message} />
                <TextInput
                  label="Phone"
                  autoComplete="tel"
                  placeholder="+91 98220 12345"
                  {...register('phone')}
                  error={formState.errors.phone?.message}
                />
                <ReadOnlyField label="Login email" value={me.data.email} note="This is also where we send quotations and invoices." />
                <Group>
                  <Button type="submit" loading={formState.isSubmitting}>
                    Save contact details
                  </Button>
                </Group>
              </Stack>
            </form>
          </ProfileSection>

          <ProfileSection title="Company" description="Printed on every invoice we send you.">
            <Stack gap="md">
              <ReadOnlyField label="Company name" value={customer?.name} />
              <ReadOnlyField label="GSTIN" value={customer?.taxId ? <span className="mono">{customer.taxId}</span> : undefined} />
              <div>
                <Text size="sm" fw={500} mb={2}>
                  Billing address
                </Text>
                {addressLines(customer?.billingAddress).length ? (
                  addressLines(customer?.billingAddress).map((line) => (
                    <Text key={line} size="md">
                      {line}
                    </Text>
                  ))
                ) : (
                  <Text c="dimmed">—</Text>
                )}
              </div>
              <Text size="sm" c="dimmed">
                Something out of date?{' '}
                {billingEmail ? (
                  <>
                    Write to{' '}
                    <Anchor href={`mailto:${billingEmail}?subject=${encodeURIComponent(`Update billing details for ${customer?.name ?? 'my account'}`)}`}>
                      {billingEmail}
                    </Anchor>{' '}
                    and we'll update it before your next invoice.
                  </>
                ) : (
                  'Contact us and we will update it before your next invoice.'
                )}
              </Text>
            </Stack>
          </ProfileSection>

          <ProfileSection title="Password" description="Changing it logs you out on other devices. This one stays logged in.">
            <ChangePasswordForm />
          </ProfileSection>
        </Stack>
      )}
    </>
  )
}
