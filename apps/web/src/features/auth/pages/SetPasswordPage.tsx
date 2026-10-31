import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Anchor, Button, PasswordInput, Stack } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { authApi } from '@/lib/api/endpoints'
import type { Portal } from '@/lib/api/types'
import { passwordSchema } from '@/lib/validation'
import { AuthShell } from '../components/AuthShell'
import { PasswordRules } from '../components/PasswordRules'
import { applyServerErrors } from '../form-errors'
import { homePathFor } from '../session'
import { useAuth } from '../useAuth'

const schema = z
  .object({ currentPassword: z.string().min(1, 'Enter the temporary password'), newPassword: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Choose a different password' })
type Values = z.infer<typeof schema>

/** Forced change after logging in with a temporary password (admin-created or CSV-imported users). */
export function SetPasswordPage({ portal }: { portal: Portal }) {
  const { user, applySession, logout } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, control, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '' },
  })
  const newPasswordValue = useWatch({ control, name: 'newPassword' }) ?? ''

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setFormError(null)
    try {
      const updated = applySession(await authApi.changePassword({ currentPassword, newPassword }))
      navigate(homePathFor(updated), { replace: true })
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['currentPassword', 'newPassword']))
    }
  })

  return (
    <AuthShell
      portal={portal}
      title="Choose your own password"
      subtitle={`${user ? `${user.name.split(' ')[0]}, you're` : "You're"} logged in with a temporary password from your admin. Pick one only you know.`}
      footer={
        <Anchor component="button" type="button" onClick={logout}>
          Log out
        </Anchor>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <Stack>
          {formError && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
              {formError}
            </Alert>
          )}
          <PasswordInput
            label="Temporary password"
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
            <PasswordRules value={newPasswordValue} />
          </div>
          <PasswordInput
            label="Confirm new password"
            autoComplete="new-password"
            {...register('confirmPassword')}
            error={formState.errors.confirmPassword?.message}
          />
          <Button type="submit" loading={formState.isSubmitting} fullWidth>
            Save password
          </Button>
        </Stack>
      </form>
    </AuthShell>
  )
}
