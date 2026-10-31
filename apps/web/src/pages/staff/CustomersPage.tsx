import { Button, Checkbox, Select, Table, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { keepPreviousData, useIsMutating, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { StatusText } from '@/components/StatusBadge'
import { staffPath } from '@/features/auth/staff-base'
import classes from '@/features/catalog/catalog.module.css'
import { EmptyLine, FilterBar, FormDrawer, Pager } from '@/features/catalog/components'
import { CustomerForm } from '@/features/catalog/CustomerForm'
import { CUSTOMER_SAVE_KEY, useEditParam, useRole, useUrlFilters } from '@/features/catalog/hooks'
import { ACTIVE_STATUS, PORTAL_STATUS } from '@/features/catalog/labels'
import { customersApi } from '@/lib/api/endpoints'
import { formatMoney } from '@/lib/format'
import { tokens } from '@/theme'

const PAGE_SIZE = 20

export function CustomersPage() {
  const navigate = useNavigate()
  const { can } = useRole()
  const canEdit = can('admin', 'staff')
  const { params, update, clear } = useUrlFilters()
  const drawer = useEditParam()
  const hasOverdue = params.get('overdue') === '1'
  const subs = params.get('subs') // 'with' | 'without'
  const showArchived = params.get('archived') === '1'
  const page = Number(params.get('page') ?? 1)
  const [search] = useDebouncedValue((params.get('search') ?? '').trim(), 300)

  const query = {
    search: search || undefined,
    hasOverdue: hasOverdue || undefined,
    hasActiveSubscription: subs === 'with' ? true : subs === 'without' ? false : undefined,
    isActive: showArchived ? undefined : true,
    page,
    limit: PAGE_SIZE,
    sort: 'name',
  }
  const list = useQuery({ queryKey: ['customers', 'list', query], queryFn: () => customersApi.list(query), placeholderData: keepPreviousData })
  const saving = useIsMutating({ mutationKey: CUSTOMER_SAVE_KEY }) > 0
  const hasFilters = Boolean(search || hasOverdue || subs || showArchived)

  return (
    <>
      <PageHeader
        title="Customers"
        description="Businesses and people you bill, with what they owe right now."
        actions={
          canEdit && (
            <Button leftSection={<IconPlus size={16} stroke={1.75} />} onClick={drawer.openNew}>
              New customer
            </Button>
          )
        }
      />

      <div className="panel">
        <FilterBar>
          <TextInput
            aria-label="Search customers"
            placeholder="Search by name, contact or email"
            leftSection={<IconSearch size={15} stroke={1.5} />}
            defaultValue={params.get('search') ?? ''}
            onChange={(e) => update({ search: e.currentTarget.value.trim() || undefined })}
            w={300}
          />
          <Select
            aria-label="Subscriptions"
            placeholder="Any subscriptions"
            clearable
            data={[
              { value: 'with', label: 'Has an active subscription' },
              { value: 'without', label: 'No active subscription' },
            ]}
            value={subs}
            onChange={(v) => update({ subs: v ?? undefined })}
            w={230}
          />
          <Checkbox
            label="Has overdue invoices"
            checked={hasOverdue}
            onChange={(e) => update({ overdue: e.currentTarget.checked ? '1' : undefined })}
            ml="xs"
          />
          <Checkbox
            label="Show archived"
            checked={showArchived}
            onChange={(e) => update({ archived: e.currentTarget.checked ? '1' : undefined })}
            ml="xs"
          />
        </FilterBar>

        <QueryState isLoading={list.isLoading} error={list.error} onRetry={() => list.refetch()} rows={8} what="customers" />
        {list.data && (
          <>
            {list.data.data.length > 0 && (
              <Table.ScrollContainer minWidth={980}>
                <Table className="data-table">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Contact</Table.Th>
                      <Table.Th>Email</Table.Th>
                      <Table.Th ta="right">Active subs</Table.Th>
                      <Table.Th ta="right">Outstanding</Table.Th>
                      <Table.Th ta="right">Overdue</Table.Th>
                      <Table.Th>Portal</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {list.data.data.map((c) => {
                      const stats = c.stats
                      return (
                        <Table.Tr
                          key={c.id}
                          className={`row-link ${c.isActive ? '' : classes.archivedRow}`}
                          onClick={() => navigate(staffPath(`/customers/${c.id}`))}
                        >
                          <Table.Td maw={240}>
                            <Text size="sm" fw={500} truncate title={c.name}>
                              {c.name}
                            </Text>
                            {!c.isActive && (
                              <Text size="xs" c={ACTIVE_STATUS.archived.color}>
                                Archived
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>{c.contactName || '—'}</Table.Td>
                          <Table.Td maw={240}>
                            <Text size="sm" c="dimmed" truncate title={c.email}>
                              {c.email}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right" className="num">
                            {stats?.activeSubscriptions || '—'}
                          </Table.Td>
                          <Table.Td ta="right" className="num">
                            {stats?.outstandingAmount ? formatMoney(stats.outstandingAmount) : '—'}
                          </Table.Td>
                          <Table.Td ta="right" className="num" c={stats?.overdueAmount ? tokens.status.bad : undefined} fw={stats?.overdueAmount ? 500 : undefined}>
                            {stats?.overdueAmount ? formatMoney(stats.overdueAmount) : '—'}
                          </Table.Td>
                          <Table.Td>
                            <StatusText {...PORTAL_STATUS[c.portalStatus]} />
                          </Table.Td>
                        </Table.Tr>
                      )
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
            {!list.data.data.length && (
              <EmptyLine
                action={
                  hasFilters ? (
                    <Button size="compact-sm" variant="default" onClick={() => clear()}>
                      Clear filters
                    </Button>
                  ) : (
                    canEdit && (
                      <Button size="compact-sm" variant="default" onClick={drawer.openNew}>
                        Add the first customer
                      </Button>
                    )
                  )
                }
              >
                {hasFilters ? 'No customers match these filters.' : 'No customers yet. Add one, or they appear when someone signs up on the customer site.'}
              </EmptyLine>
            )}
            <Pager meta={list.data.meta} onPage={(p) => update({ page: String(p) })} />
          </>
        )}
      </div>

      <FormDrawer
        opened={drawer.isNew && canEdit}
        onClose={drawer.close}
        title="New customer"
        subtitle="No login is created. They get portal access by signing up with the same email."
        size={560}
        footer={
          <>
            <Button type="submit" form="new-customer-form" loading={saving}>
              Add customer
            </Button>
            <Button variant="default" onClick={drawer.close}>
              Cancel
            </Button>
          </>
        }
      >
        {drawer.isNew && canEdit && (
          <CustomerForm formId="new-customer-form" onSaved={(c) => navigate(staffPath(`/customers/${c.id}`))} />
        )}
      </FormDrawer>
    </>
  )
}
