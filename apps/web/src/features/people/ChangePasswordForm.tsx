import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Group, PasswordInput, Stack } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { PasswordRules } from '@/features/auth/components/PasswordRules'
import { applyServerErrors } from '@/features/auth/form-errors'
import { useAuth } from '@/features/auth/useAuth'
import { authApi } from '@/lib/api/endpoints'
import { notifyDone } from '@/lib/notify'
import { passwordSchema } from '@/lib/validation'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Type the new password again'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Choose a different password from your current one' })
type Values = z.infer<typeof schema>

/**
 * Change your own password. The API returns a fresh session (old tokens stop working),
 * so it's applied right away and this device stays logged in.
 */
export function ChangePasswordForm() {
  const { applySession } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, control, setError, reset, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const newPassword = useWatch({ control, name: 'newPassword' }) ?? ''

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setFormError(null)
    try {
      applySession(await authApi.changePassword({ currentPassword, newPassword }))
      reset()
      notifyDone('Password changed. You stay logged in here; other devices need the new password.')
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['currentPassword', 'newPassword']))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack gap="md" maw={420}>
        {formError && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            {formError}
          </Alert>
        )}
        <PasswordInput
          label="Current password"
          autoComplete="current-password"
          {...register('currentPassword')}
          error={formState.errors.currentPassword?.message}
        />
        <div>
          <PasswordInput
            label="New password"
            autoComplete="new-password"
            {...register('newPassword')}
            error={formState.errors.newPassword?.message}
            mb={6}
          />
          <PasswordRules value={newPassword} />
        </div>
        <PasswordInput
          label="Confirm new password"
          autoComplete="new-password"
          {...register('confirmPassword')}
          error={formState.errors.confirmPassword?.message}
        />
        <Group>
          <Button type="submit" variant="default" loading={formState.isSubmitting}>
            Change password
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
