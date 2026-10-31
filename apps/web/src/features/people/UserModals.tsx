import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, CopyButton, Group, Modal, Radio, Select, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertCircle, IconCheck, IconCopy } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { applyServerErrors } from '@/features/auth/form-errors'
import { staffPath } from '@/features/auth/staff-base'
import { isApiError } from '@/lib/api/client'
import { usersApi } from '@/lib/api/endpoints'
import type { StaffRole, User } from '@/lib/api/types'
import { ROLE_LABELS } from '@/lib/labels'
import { notifyDone } from '@/lib/notify'
import { passwordSchema, requiredText, trimmed } from '@/lib/validation'
import { tokens } from '@/theme'
import { ACCESS_LEVEL_OPTIONS, ACCESS_LEVELS, LAST_ADMIN_MESSAGE } from './access'
import { TempPasswordField } from './TempPasswordField'

const errorMessage = (error: unknown) =>
  isApiError(error) && error.code === 'LAST_ADMIN'
    ? LAST_ADMIN_MESSAGE
    : isApiError(error)
      ? error.message
      : 'That didn’t work. Try again.'

/** Keeps showing the last record while a modal animates closed (the parent clears it right away). */
function useSticky<T>(value: T | null): T | null {
  const [kept, setKept] = useState(value)
  if (value && value !== kept) setKept(value)
  return value ?? kept
}

function ErrorAlert({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
      {message}
    </Alert>
  )
}

/** Sign-in details an admin can paste into a chat or read out. */
function SignInDetails({ email, password }: { email: string; password: string }) {
  const loginUrl = `${window.location.origin}${staffPath('/login')}`
  const text = `Your Subscribby login\nLogin page: ${loginUrl}\nEmail: ${email}\nTemporary password: ${password}\nYou'll choose your own password when you first log in.`
  return (
    <Stack gap="sm">
      <div style={{ border: `1px solid ${tokens.line}`, borderRadius: 6, background: tokens.page, padding: '12px 14px' }}>
        {[
          ['Login page', loginUrl],
          ['Email', email],
          ['Temporary password', password],
        ].map(([label, value]) => (
          <Group key={label} gap={12} py={3} wrap="nowrap" align="baseline">
            <Text size="xs" c="dimmed" w={120} style={{ flex: 'none' }}>
              {label}
            </Text>
            <Text size="sm" className={label === 'Temporary password' ? 'mono' : undefined} style={{ wordBreak: 'break-all', whiteSpace: 'normal' }}>
              {value}
            </Text>
          </Group>
        ))}
      </div>
      <CopyButton value={text} timeout={2000}>
        {({ copied, copy }) => (
          <Button
            variant="default"
            onClick={copy}
            leftSection={copied ? <IconCheck size={15} stroke={1.75} /> : <IconCopy size={15} stroke={1.5} />}
            color={copied ? 'green' : undefined}
          >
            {copied ? 'Copied' : 'Copy sign-in details'}
          </Button>
        )}
      </CopyButton>
    </Stack>
  )
}

// ---------------------------------------------------------------- Add user

const addSchema = z.object({
  name: requiredText('Enter their full name').pipe(z.string().min(2, 'Use at least 2 characters').max(80, 'Keep it under 80 characters')),
  email: trimmed().min(1, 'Enter their work email').pipe(z.email("That email doesn't look right")),
  role: z.enum(['staff', 'finance', 'admin'], { message: 'Choose an access level' }),
  temporaryPassword: z.string().min(1, 'Type a temporary password or press Generate').pipe(passwordSchema),
})
type AddValues = z.infer<typeof addSchema>

export function AddUserModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [created, setCreated] = useState<{ user: User; password: string } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, control, setError, reset, formState } = useForm<AddValues>({
    resolver: zodResolver(addSchema),
    defaultValues: { name: '', email: '', role: 'staff', temporaryPassword: '' },
  })

  const close = () => {
    onClose()
    // Clear after the closing animation so the content doesn't flash.
    setTimeout(() => {
      reset()
      setCreated(null)
      setFormError(null)
    }, 200)
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const user = await usersApi.create(values)
      queryClient.invalidateQueries({ queryKey: ['users'] })
      notifyDone(`${user.name} can log in now`)
      setCreated({ user, password: values.temporaryPassword })
    } catch (error) {
      if (isApiError(error) && error.code === 'EMAIL_TAKEN') {
        setError('email', { message: 'This email already has an account. Use a different one.' })
        return
      }
      setFormError(applyServerErrors(error, setError, ['name', 'email', 'role', 'temporaryPassword']))
    }
  })

  return (
    <Modal opened={opened} onClose={close} title={created ? 'Account ready' : 'Add a staff user'} size={520}>
      {created ? (
        <Stack gap="md">
          <Text size="sm">
            {created.user.name} is set up as <b>{ROLE_LABELS[created.user.role]}</b>. Subscribby doesn't email the password, so share these
            details with them directly. They'll choose their own password the first time they log in.
          </Text>
          <SignInDetails email={created.user.email} password={created.password} />
          <Group justify="flex-end" mt="xs">
            <Button
              variant="subtle"
              onClick={() => {
                reset()
                setCreated(null)
              }}
            >
              Add another
            </Button>
            <Button onClick={close}>Done</Button>
          </Group>
        </Stack>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <Stack gap="md">
            <ErrorAlert message={formError} />
            <TextInput label="Full name" data-autofocus {...register('name')} error={formState.errors.name?.message} />
            <TextInput
              label="Work email"
              placeholder="name@company.com"
              autoComplete="off"
              {...register('email')}
              error={formState.errors.email?.message}
            />
            <Controller
              control={control}
              name="role"
              render={({ field, fieldState }) => (
                <Select
                  label="Access level"
                  data={ACCESS_LEVEL_OPTIONS}
                  value={field.value}
                  onChange={(v) => v && field.onChange(v)}
                  allowDeselect={false}
                  error={fieldState.error?.message}
                  description={ACCESS_LEVELS.find((l) => l.value === field.value)?.description}
                  comboboxProps={{ withinPortal: true }}
                />
              )}
            />
            <Controller
              control={control}
              name="temporaryPassword"
              render={({ field, fieldState }) => (
                <TempPasswordField
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  description="They'll replace it with their own at first login."
                />
              )}
            />
            <Group justify="flex-end" mt="xs">
              <Button variant="default" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={formState.isSubmitting}>
                Add user
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------- Change access level

export function AccessLevelModal({ user: selected, onClose }: { user: User | null; onClose: () => void }) {
  const user = useSticky(selected)
  const queryClient = useQueryClient()
  const [role, setRole] = useState<StaffRole | null>(null)
  const current = (role ?? user?.role) as StaffRole | undefined
  const save = useMutation({
    mutationFn: () => usersApi.update(user!.id, { role: current }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      notifyDone(`${updated.name} is now ${ROLE_LABELS[updated.role]}`)
      close()
    },
  })
  const close = () => {
    onClose()
    setTimeout(() => {
      setRole(null)
      save.reset()
    }, 200)
  }

  return (
    <Modal opened={Boolean(selected)} onClose={close} title={user ? `Access level for ${user.name}` : ''} size={480}>
      {user && (
        <Stack gap="md">
          <ErrorAlert message={save.error ? errorMessage(save.error) : null} />
          <Radio.Group value={current} onChange={(v) => setRole(v as StaffRole)} aria-label="Access level">
            <Stack gap={10}>
              {ACCESS_LEVELS.map((level) => (
                <Radio
                  key={level.value}
                  value={level.value}
                  label={level.label}
                  description={level.description}
                  styles={{ label: { fontWeight: 500 } }}
                />
              ))}
            </Stack>
          </Radio.Group>
          <Text size="xs" c="dimmed">
            The change applies to their next request. They don't need to log in again.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={current === user.role}>
              Save access level
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------- Disable / enable

export function ToggleStatusModal({ user: selected, isSelf, onClose }: { user: User | null; isSelf: boolean; onClose: () => void }) {
  const user = useSticky(selected)
  const queryClient = useQueryClient()
  const disabling = user?.status === 'active'
  const save = useMutation({
    mutationFn: () => usersApi.update(user!.id, { status: disabling ? 'disabled' : 'active' }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      notifyDone(updated.status === 'disabled' ? `${updated.name} can no longer log in` : `${updated.name} can log in again`)
      close()
    },
  })
  const close = () => {
    onClose()
    setTimeout(() => save.reset(), 200)
  }

  return (
    <Modal opened={Boolean(selected)} onClose={close} title={user ? `${disabling ? 'Disable' : 'Enable'} ${user.name}?` : ''} size={460}>
      {user && (
        <Stack gap="md">
          <ErrorAlert message={save.error ? errorMessage(save.error) : null} />
          <Text size="sm">
            {disabling
              ? isSelf
                ? 'This is your own account. You will be logged out right away and need another admin to enable you again.'
                : `${user.name} is logged out on every device straight away and can't log in until an admin enables the account again. Their records stay as they are.`
              : `${user.name} can log in again with their current password.`}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button color={disabling ? 'red' : undefined} onClick={() => save.mutate()} loading={save.isPending}>
              {disabling ? 'Disable account' : 'Enable account'}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------- New temporary password

export function ResetPasswordModal({ user: selected, onClose }: { user: User | null; onClose: () => void }) {
  const user = useSticky(selected)
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [done, setDone] = useState(false)
  const save = useMutation({
    mutationFn: () => usersApi.resetPassword(user!.id, password),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      notifyDone(`New temporary password set for ${updated.name}`)
      setDone(true)
    },
    onError: (error) => {
      if (isApiError(error)) {
        const detail = error.details.find((d) => d.field === 'temporaryPassword')
        if (detail) setFieldError(detail.message)
      }
    },
  })
  const close = () => {
    onClose()
    setTimeout(() => {
      setPassword('')
      setFieldError(undefined)
      setDone(false)
      save.reset()
    }, 200)
  }
  const submit = () => {
    const parsed = z.string().min(1, 'Type a temporary password or press Generate').pipe(passwordSchema).safeParse(password)
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message)
      return
    }
    setFieldError(undefined)
    save.mutate()
  }

  const isCustomer = user?.role === 'customer'

  return (
    <Modal opened={Boolean(selected)} onClose={close} title={user ? `New temporary password for ${user.name}` : ''} size={520}>
      {user &&
        (done ? (
          <Stack gap="md">
            <Text size="sm">
              {user.name} is logged out everywhere and will be asked to choose a new password at their next login. Share the temporary password
              with them directly.
            </Text>
            {isCustomer ? (
              <CopyButton value={password}>
                {({ copied, copy }) => (
                  <Button variant="default" onClick={copy} leftSection={copied ? <IconCheck size={15} /> : <IconCopy size={15} stroke={1.5} />}>
                    {copied ? 'Copied' : 'Copy temporary password'}
                  </Button>
                )}
              </CopyButton>
            ) : (
              <SignInDetails email={user.email} password={password} />
            )}
            <Group justify="flex-end">
              <Button onClick={close}>Done</Button>
            </Group>
          </Stack>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
            noValidate
          >
            <Stack gap="md">
              <ErrorAlert message={save.error && !fieldError ? errorMessage(save.error) : null} />
              <Text size="sm" c="dimmed">
                Use this when someone is locked out. Their current password stops working and every device they're logged in on is signed
                out.
              </Text>
              <TempPasswordField
                value={password}
                onChange={(v) => {
                  setPassword(v)
                  if (fieldError) setFieldError(undefined)
                }}
                error={fieldError}
                label="New temporary password"
              />
              <Group justify="flex-end">
                <Button variant="default" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" loading={save.isPending}>
                  Set temporary password
                </Button>
              </Group>
            </Stack>
          </form>
        ))}
    </Modal>
  )
}
