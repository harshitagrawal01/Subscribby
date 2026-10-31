import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Anchor, Button, Stack, Text, TextInput } from '@mantine/core'
import { IconMailCheck } from '@tabler/icons-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { authApi } from '@/lib/api/endpoints'
import type { Portal } from '@/lib/api/types'
import { emailSchema } from '@/lib/validation'
import { AuthShell } from '../components/AuthShell'
import { portalPaths } from '../session'

const schema = z.object({ email: emailSchema })
type Values = z.infer<typeof schema>

export function ForgotPasswordPage({ portal }: { portal: Portal }) {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) })
  const paths = portalPaths(portal)

  const onSubmit = handleSubmit(async ({ email }) => {
    // The API answers 200 whether or not the email exists, so there is no error branch to show.
    const result = await authApi.forgotPassword({ email, portal }).catch(() => null)
    setDevResetUrl(result?.devResetUrl ?? null)
    setSentTo(email)
  })

  return (
    <AuthShell
      portal={portal}
      title="Forgot password"
      subtitle="We'll email you a link to set a new password. It works once and expires in 30 minutes."
      footer={
        <Anchor component={Link} to={paths.login}>
          Back to login
        </Anchor>
      }
    >
      {sentTo ? (
        <Stack>
          <Alert color="teal" icon={<IconMailCheck size={16} />}>
            If an account exists for <b>{sentTo}</b>, a reset link is on its way.
          </Alert>
          {devResetUrl && (
            <Text size="xs" c="dimmed">
              Development only:{' '}
              <Anchor component={Link} to={new URL(devResetUrl).pathname + new URL(devResetUrl).search} size="xs">
                open the reset link
              </Anchor>
            </Text>
          )}
        </Stack>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <Stack>
            <TextInput label="Email" type="email" autoComplete="email" {...register('email')} error={formState.errors.email?.message} />
            <Button type="submit" loading={formState.isSubmitting} fullWidth>
              Send reset link
            </Button>
          </Stack>
        </form>
      )}
    </AuthShell>
  )
}
