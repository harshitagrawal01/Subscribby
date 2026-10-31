import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Anchor, Button, PasswordInput, Stack } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { isApiError } from '@/lib/api/client'
import { authApi } from '@/lib/api/endpoints'
import type { Portal } from '@/lib/api/types'
import { passwordSchema } from '@/lib/validation'
import { AuthShell } from '../components/AuthShell'
import { PasswordRules } from '../components/PasswordRules'
import { homePathFor, portalPaths } from '../session'
import { useAuth } from '../useAuth'

const schema = z
  .object({ newPassword: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
type Values = z.infer<typeof schema>

/** Opened from the emailed link: /reset-password?token=... or /staff/reset-password?token=... */
export function ResetPasswordPage({ portal }: { portal: Portal }) {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const { applySession } = useAuth()
  const [formError, setFormError] = useState<string | null>(token ? null : 'This link is missing its token.')
  const paths = portalPaths(portal)
  const { register, handleSubmit, control, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '' },
  })
  const newPasswordValue = useWatch({ control, name: 'newPassword' }) ?? ''

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    setFormError(null)
    try {
      const user = applySession(await authApi.resetPassword({ token, newPassword }))
      navigate(homePathFor(user), { replace: true })
    } catch (error) {
      setFormError(
        isApiError(error) && error.code === 'TOKEN_INVALID'
          ? 'This link has expired or was already used. Ask for a new one below.'
          : isApiError(error)
            ? error.message
            : 'Something went wrong. Try again.',
      )
    }
  })

  return (
    <AuthShell
      portal={portal}
      title="Choose a new password"
      footer={
        <Anchor component={Link} to={paths.forgot}>
          Email me a new link
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
          <Button type="submit" loading={formState.isSubmitting} disabled={!token} fullWidth>
            Save password
          </Button>
        </Stack>
      </form>
    </AuthShell>
  )
}
