import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Anchor, Button, Group, PasswordInput, Stack, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { isApiError } from '@/lib/api/client'
import type { Portal } from '@/lib/api/types'
import { emailSchema } from '@/lib/validation'
import { AuthShell } from '../components/AuthShell'
import { homePathFor, portalPaths } from '../session'
import { useAuth } from '../useAuth'

const schema = z.object({ email: emailSchema, password: z.string().min(1, 'Password is required') })
type Values = z.infer<typeof schema>

/** One component, two pages: /login (customers) and /staff/login (admin, staff, finance). */
export function LoginPage({ portal }: { portal: Portal }) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)
  const paths = portalPaths(portal)
  const from = (location.state as { from?: string } | null)?.from

  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null)
    try {
      const user = await login(portal, email, password)
      if (user.mustChangePassword) navigate(paths.setPassword, { replace: true })
      else navigate(from ?? homePathFor(user), { replace: true })
    } catch (error) {
      if (isApiError(error) && error.code === 'INVALID_CREDENTIALS') setFormError('Wrong email or password.')
      else if (isApiError(error) && error.code === 'ACCOUNT_DISABLED') setFormError('This account is disabled. Contact your admin.')
      else setFormError(isApiError(error) ? error.message : 'Something went wrong. Try again.')
    }
  })

  return (
    <AuthShell
      portal={portal}
      title={portal === 'staff' ? 'Staff login' : 'Log in'}
      subtitle={portal === 'staff' ? 'For admin, internal staff and the finance lead.' : 'Manage your subscriptions and invoices.'}
      footer={
        portal === 'customer' ? (
          <>
            New here?{' '}
            <Anchor component={Link} to="/signup">
              Create an account
            </Anchor>
          </>
        ) : (
          'Staff accounts are created by an admin. There is no sign-up here.'
        )
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <Stack>
          {formError && (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {formError}
            </Alert>
          )}
          <TextInput label="Email" type="email" autoComplete="email" {...register('email')} error={formState.errors.email?.message} />
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            {...register('password')}
            error={formState.errors.password?.message}
          />
          <Group justify="flex-end">
            <Anchor component={Link} to={paths.forgot} size="sm">
              Forgot password?
            </Anchor>
          </Group>
          <Button type="submit" loading={formState.isSubmitting} fullWidth>
            Log in
          </Button>
        </Stack>
      </form>
    </AuthShell>
  )
}
