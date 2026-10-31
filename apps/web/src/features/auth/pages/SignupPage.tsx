import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Anchor, Button, PasswordInput, Stack, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
import { isApiError } from '@/lib/api/client'
import { emailSchema, passwordSchema } from '@/lib/validation'
import { AuthShell } from '../components/AuthShell'
import { PasswordRules } from '../components/PasswordRules'
import { applyServerErrors } from '../form-errors'
import { useAuth } from '../useAuth'

const schema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name'),
    companyName: z.string().trim().optional(),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
type Values = z.infer<typeof schema>

/** Customer sign-up. Only customers can sign up; staff accounts come from an admin. */
export function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, control, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '' },
  })
  const newPasswordValue = useWatch({ control, name: 'password' }) ?? ''

  const onSubmit = handleSubmit(async ({ confirmPassword: _confirm, ...input }) => {
    setFormError(null)
    try {
      await signup(input)
      navigate('/portal', { replace: true })
    } catch (error) {
      if (isApiError(error) && error.code === 'EMAIL_TAKEN') {
        setError('email', { message: 'An account with this email already exists.' })
        return
      }
      setFormError(applyServerErrors(error, setError, ['name', 'email', 'password']))
    }
  })

  return (
    <AuthShell
      portal="customer"
      title="Create your account"
      subtitle="See and manage your subscriptions without emailing anyone."
      footer={
        <>
          Already have an account?{' '}
          <Anchor component={Link} to="/login">
            Log in
          </Anchor>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <Stack>
          {formError && (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {formError}
            </Alert>
          )}
          <TextInput label="Full name" autoComplete="name" {...register('name')} error={formState.errors.name?.message} />
          <TextInput label="Company" description="Optional" autoComplete="organization" {...register('companyName')} />
          <TextInput label="Email" type="email" autoComplete="email" {...register('email')} error={formState.errors.email?.message} />
          <div>
            <PasswordInput
              label="Password"
              autoComplete="new-password"
              {...register('password')}
              error={formState.errors.password?.message}
              mb={6}
            />
            <PasswordRules value={newPasswordValue} />
          </div>
          <PasswordInput
            label="Confirm password"
            autoComplete="new-password"
            {...register('confirmPassword')}
            error={formState.errors.confirmPassword?.message}
          />
          <Button type="submit" loading={formState.isSubmitting} fullWidth>
            Create account
          </Button>
        </Stack>
      </form>
    </AuthShell>
  )
}
