import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Group, Stack, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/PageHeader'
import { applyServerErrors } from '@/features/auth/form-errors'
import { useAuth } from '@/features/auth/useAuth'
import { ACCESS_LEVELS } from '@/features/people/access'
import { ChangePasswordForm } from '@/features/people/ChangePasswordForm'
import { ProfileSection, ReadOnlyField } from '@/features/people/ProfileSection'
import { authApi } from '@/lib/api/endpoints'
import { formatDateTime } from '@/lib/format'
import { ROLE_LABELS } from '@/lib/labels'
import { notifyDone } from '@/lib/notify'
import { requiredText } from '@/lib/validation'

const schema = z.object({
  name: requiredText('Enter your name').pipe(z.string().min(2, 'Use at least 2 characters').max(80, 'Keep it under 80 characters')),
})
type Values = z.infer<typeof schema>

export function StaffProfilePage() {
  const { user, refresh } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, reset, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    values: { name: user?.name ?? '' },
  })

  if (!user) return null
  const level = ACCESS_LEVELS.find((l) => l.value === user.role)

  const onSubmit = handleSubmit(async ({ name }) => {
    setFormError(null)
    try {
      const updated = await authApi.updateMe({ name })
      await refresh()
      reset({ name: updated.name })
      notifyDone('Name saved')
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['name']))
    }
  })

  return (
    <>
      <PageHeader title="Your profile" description="How you appear in Subscribby, and the password you log in with." />
      <Stack gap={16} maw={760}>
        <ProfileSection title="Details" description="Your name shows on quotations you prepare and in activity history.">
          <form onSubmit={onSubmit} noValidate>
            <Stack gap="md" maw={420}>
              {formError && (
                <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                  {formError}
                </Alert>
              )}
              <TextInput label="Full name" autoComplete="name" {...register('name')} error={formState.errors.name?.message} />
              <ReadOnlyField label="Email" value={user.email} note="Ask an admin if this needs to change." />
              <ReadOnlyField label="Access level" value={ROLE_LABELS[user.role]} note={level?.description} />
              {user.lastLoginAt && <ReadOnlyField label="Last login" value={formatDateTime(user.lastLoginAt)} />}
              <Group>
                <Button type="submit" loading={formState.isSubmitting}>
                  Save name
                </Button>
              </Group>
            </Stack>
          </form>
        </ProfileSection>

        <ProfileSection title="Password" description="Changing it logs you out on other devices. This one stays logged in.">
          <ChangePasswordForm />
        </ProfileSection>
      </Stack>
    </>
  )
}
