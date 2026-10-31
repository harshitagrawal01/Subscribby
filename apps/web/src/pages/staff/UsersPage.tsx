import { ActionIcon, Button, Group, Menu, Select, Table, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconDots, IconFileImport, IconKey, IconPlus, IconSearch, IconShieldHalf, IconUserCheck, IconUserOff } from '@tabler/icons-react'
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { StatusText } from '@/components/StatusBadge'
import { staffPath } from '@/features/auth/staff-base'
import { useAuth } from '@/features/auth/useAuth'
import { ACCESS_LEVEL_OPTIONS } from '@/features/people/access'
import { AccessLevelModal, AddUserModal, ResetPasswordModal, ToggleStatusModal } from '@/features/people/UserModals'
import { usersApi } from '@/lib/api/endpoints'
import type { StaffRole, User, UserStatus } from '@/lib/api/types'
import { formatDate, formatDateTime } from '@/lib/format'
import { ROLE_LABELS } from '@/lib/labels'
import { tokens } from '@/theme'

const PAGE_SIZE = 20
const STAFF_ROLES: StaffRole[] = ['admin', 'staff', 'finance']
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
]

type Tab = 'staff' | 'customers'
type Dialog = { kind: 'level' | 'status' | 'password'; user: User } | null

function UserStatusText({ status }: { status: UserStatus }) {
  return status === 'active' ? (
    <StatusText label="Active" color={tokens.status.good} />
  ) : (
    <StatusText label="Disabled" color={tokens.status.closed} />
  )
}

function PasswordNote({ user }: { user: User }) {
  if (!user.mustChangePassword)
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    )
  return (
    <Text size="sm" c={tokens.status.warn} title="Has a temporary password and picks their own at next login">
      Must change password
    </Text>
  )
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (!total) return null
  const first = (page - 1) * PAGE_SIZE + 1
  const last = Math.min(page * PAGE_SIZE, total)
  return (
    <Group justify="space-between" px={20} py={12} style={{ borderTop: `1px solid ${tokens.line}` }}>
      <Text size="sm" c="dimmed">
        <span className="num">
          {first}–{last}
        </span>{' '}
        of <span className="num">{total}</span>
      </Text>
      <Group gap={6}>
        <Button size="compact-sm" variant="default" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="compact-sm" variant="default" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </Group>
    </Group>
  )
}

export function UsersPage() {
  const { user: me } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'customers' ? 'customers' : 'staff'
  const level = (params.get('level') as StaffRole | null) ?? undefined
  const status = (params.get('status') as UserStatus | null) ?? undefined
  const page = Number(params.get('page') ?? 1)
  const [search] = useDebouncedValue((params.get('search') ?? '').trim(), 300)
  const [adding, setAdding] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)

  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next, { replace: true })
  }

  const shared = { status, search: search || undefined }

  // The API filters one role at a time, so staff accounts are three small lists merged here.
  // Staff teams are small (well under 100 per access level).
  const staffLists = useQueries({
    queries: STAFF_ROLES.map((role) => ({
      queryKey: ['users', { role, ...shared, limit: 100 }],
      queryFn: () => usersApi.list({ role, ...shared, limit: 100, sort: 'name' }),
      placeholderData: keepPreviousData,
    })),
  })
  const customerQuery = { role: 'customer' as const, ...shared, page: tab === 'customers' ? page : 1, limit: PAGE_SIZE, sort: 'name' }
  const customers = useQuery({
    queryKey: ['users', customerQuery],
    queryFn: () => usersApi.list(customerQuery),
    placeholderData: keepPreviousData,
  })

  const staffLoading = staffLists.some((q) => q.isLoading)
  const staffError = staffLists.find((q) => q.error)?.error ?? null
  const staffAll = staffLists.every((q) => q.data)
    ? staffLists
        .flatMap((q) => q.data!.data)
        .filter((u) => !level || u.role === level)
        .sort((a, b) => a.name.localeCompare(b.name))
    : null
  const staffCount = staffLists.reduce((sum, q) => sum + (q.data?.meta.total ?? 0), 0)
  const staffPage = staffAll?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const hasFilters = Boolean(status || search || (tab === 'staff' && level))

  const rows = tab === 'staff' ? staffPage : customers.data?.data
  const total = tab === 'staff' ? (staffAll?.length ?? 0) : (customers.data?.meta.total ?? 0)

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone who can log in to Subscribby. Staff accounts are created here; customers sign up on the customer site."
        actions={
          <>
            <Button variant="default" component={Link} to={staffPath('/users/import')} leftSection={<IconFileImport size={16} stroke={1.5} />}>
              Import from CSV
            </Button>
            <Button leftSection={<IconPlus size={16} stroke={1.75} />} onClick={() => setAdding(true)}>
              Add user
            </Button>
          </>
        }
      />

      <div className="panel">
        <div className="filter-tabs" role="tablist" aria-label="Kind of account">
          <button className="filter-tab" role="tab" aria-selected={tab === 'staff'} onClick={() => update({ tab: undefined, level: undefined })}>
            Staff accounts<span className="count">{staffCount}</span>
          </button>
          <button
            className="filter-tab"
            role="tab"
            aria-selected={tab === 'customers'}
            onClick={() => update({ tab: 'customers', level: undefined })}
          >
            Customer logins<span className="count">{customers.data?.meta.total ?? 0}</span>
          </button>
        </div>

        <Group px={20} py={12} gap="sm" style={{ borderBottom: `1px solid ${tokens.line}` }}>
          <TextInput
            aria-label="Search"
            placeholder="Search by name or email"
            leftSection={<IconSearch size={15} stroke={1.5} />}
            defaultValue={params.get('search') ?? ''}
            onChange={(e) => update({ search: e.currentTarget.value.trim() || undefined })}
            w={280}
          />
          {tab === 'staff' && (
            <Select
              aria-label="Access level"
              placeholder="Any access level"
              clearable
              data={ACCESS_LEVEL_OPTIONS}
              value={level ?? null}
              onChange={(v) => update({ level: v ?? undefined })}
              w={190}
            />
          )}
          <Select
            aria-label="Status"
            placeholder="Any status"
            clearable
            data={STATUS_OPTIONS}
            value={status ?? null}
            onChange={(v) => update({ status: v ?? undefined })}
            w={150}
          />
        </Group>

        {tab === 'staff' ? (
          <QueryState
            isLoading={staffLoading}
            error={staffError}
            onRetry={() => staffLists.forEach((q) => q.refetch())}
            rows={6}
            what="staff accounts"
          />
        ) : (
          <QueryState isLoading={customers.isLoading} error={customers.error} onRetry={() => customers.refetch()} rows={6} what="customer logins" />
        )}

        {rows && (
          <>
            <Table.ScrollContainer minWidth={860}>
              <Table className="data-table">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>{tab === 'staff' ? 'Access level' : 'Signed up'}</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Password</Table.Th>
                    <Table.Th>Last login</Table.Th>
                    <Table.Th w={48} aria-label="Actions" />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((u) => {
                    const isSelf = u.id === me?.id
                    return (
                      <Table.Tr key={u.id}>
                        <Table.Td fw={500}>
                          {u.name}
                          {isSelf && (
                            <Text span size="xs" c="dimmed" fw={400} ml={6}>
                              you
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td c={u.status === 'disabled' ? 'dimmed' : undefined}>{u.email}</Table.Td>
                        <Table.Td>{tab === 'staff' ? ROLE_LABELS[u.role] : formatDate(u.createdAt?.slice(0, 10))}</Table.Td>
                        <Table.Td>
                          <UserStatusText status={u.status} />
                        </Table.Td>
                        <Table.Td>
                          <PasswordNote user={u} />
                        </Table.Td>
                        <Table.Td c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                          {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}
                        </Table.Td>
                        <Table.Td ta="right">
                          <Menu position="bottom-end" width={240}>
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${u.name}`}>
                                <IconDots size={16} stroke={1.5} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              {u.role !== 'customer' && (
                                <Menu.Item
                                  leftSection={<IconShieldHalf size={16} stroke={1.5} />}
                                  onClick={() => setDialog({ kind: 'level', user: u })}
                                >
                                  Change access level
                                </Menu.Item>
                              )}
                              <Menu.Item leftSection={<IconKey size={16} stroke={1.5} />} onClick={() => setDialog({ kind: 'password', user: u })}>
                                Set new temporary password
                              </Menu.Item>
                              <Menu.Divider />
                              {u.status === 'active' ? (
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconUserOff size={16} stroke={1.5} />}
                                  onClick={() => setDialog({ kind: 'status', user: u })}
                                >
                                  Disable account
                                </Menu.Item>
                              ) : (
                                <Menu.Item
                                  leftSection={<IconUserCheck size={16} stroke={1.5} />}
                                  onClick={() => setDialog({ kind: 'status', user: u })}
                                >
                                  Enable account
                                </Menu.Item>
                              )}
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
                      </Table.Tr>
                    )
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            {!rows.length && (
              <Group p={24} gap="sm">
                <Text size="sm" c="dimmed">
                  {hasFilters
                    ? 'Nobody matches these filters.'
                    : tab === 'staff'
                      ? 'No staff accounts yet. Add someone or import a CSV.'
                      : 'No customer has signed up on the customer site yet.'}
                </Text>
                {hasFilters ? (
                  <Button
                    size="compact-sm"
                    variant="default"
                    onClick={() => setParams(tab === 'customers' ? { tab } : {}, { replace: true })}
                  >
                    Clear filters
                  </Button>
                ) : (
                  tab === 'staff' && (
                    <Button size="compact-sm" variant="default" onClick={() => setAdding(true)}>
                      Add user
                    </Button>
                  )
                )}
              </Group>
            )}

            <Pager page={page} total={total} onPage={(p) => update({ page: String(p) })} />
          </>
        )}
      </div>

      <AddUserModal opened={adding} onClose={() => setAdding(false)} />
      <AccessLevelModal user={dialog?.kind === 'level' ? dialog.user : null} onClose={() => setDialog(null)} />
      <ToggleStatusModal
        user={dialog?.kind === 'status' ? dialog.user : null}
        isSelf={dialog?.user.id === me?.id}
        onClose={() => setDialog(null)}
      />
      <ResetPasswordModal user={dialog?.kind === 'password' ? dialog.user : null} onClose={() => setDialog(null)} />
    </>
  )
}
