import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Checkbox, Group, NumberInput, Select, Stack, Table, Text, Textarea, TextInput } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useDebouncedValue } from '@mantine/hooks'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { MoneyInput } from '@/components/MoneyInput'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { StatusText } from '@/components/StatusBadge'
import classes from '@/features/catalog/catalog.module.css'
import { ConfirmModal, DetailList, EmptyLine, FilterBar, FormAlert, FormDrawer, FormSection, Pager } from '@/features/catalog/components'
import { ALWAYS_CHECK, useEditParam, useProductOptions, useRole, useUrlFilters } from '@/features/catalog/hooks'
import { ACTIVE_STATUS, BILLING_PERIOD_LABELS, BILLING_PERIODS, PERIOD_UNIT, PLAN_RULES, rulesInWords } from '@/features/catalog/labels'
import { placeServerErrors } from '@/features/catalog/server-errors'
import { isApiError } from '@/lib/api/client'
import { plansApi } from '@/lib/api/endpoints'
import type { BillingPeriod, Plan } from '@/lib/api/types'
import { formatDate, formatMoney, pluralize, today } from '@/lib/format'
import { notifyDone, notifyError } from '@/lib/notify'
import { requiredText, trimmed } from '@/lib/validation'

const PAGE_SIZE = 20
const PERIOD_OPTIONS = BILLING_PERIODS.map((p) => ({ value: p, label: BILLING_PERIOD_LABELS[p] }))

const availability = (plan: Pick<Plan, 'availableFrom' | 'availableUntil'>) =>
  plan.availableUntil ? `${formatDate(plan.availableFrom)} to ${formatDate(plan.availableUntil)}` : `From ${formatDate(plan.availableFrom)}`

export function PlansPage() {
  const { can } = useRole()
  const canEdit = can('admin')
  const { params, update, clear } = useUrlFilters()
  const drawer = useEditParam()
  const billingPeriod = (params.get('period') as BillingPeriod | null) ?? undefined
  const showArchived = params.get('archived') === '1'
  const page = Number(params.get('page') ?? 1)
  const [search] = useDebouncedValue((params.get('search') ?? '').trim(), 300)

  const query = {
    billingPeriod,
    isActive: showArchived ? undefined : true,
    search: search || undefined,
    page,
    limit: PAGE_SIZE,
    sort: 'name',
  }
  const list = useQuery({ queryKey: ['plans', 'list', query], queryFn: () => plansApi.list(query), placeholderData: keepPreviousData })
  const hasFilters = Boolean(billingPeriod || search || showArchived)

  return (
    <>
      <PageHeader
        title="Plans"
        description={
          canEdit
            ? 'How each product is sold on repeat: price per unit per period, minimum quantity and rules.'
            : 'How each product is sold on repeat. Only an admin can change plans.'
        }
        actions={
          canEdit && (
            <Button leftSection={<IconPlus size={16} stroke={1.75} />} onClick={drawer.openNew}>
              New plan
            </Button>
          )
        }
      />

      <div className="panel">
        <FilterBar>
          <TextInput
            aria-label="Search plans"
            placeholder="Search by plan or product"
            leftSection={<IconSearch size={15} stroke={1.5} />}
            defaultValue={params.get('search') ?? ''}
            onChange={(e) => update({ search: e.currentTarget.value.trim() || undefined })}
            w={260}
          />
          <Select
            aria-label="Billing period"
            placeholder="Any period"
            clearable
            data={PERIOD_OPTIONS}
            value={billingPeriod ?? null}
            onChange={(v) => update({ period: v ?? undefined })}
            w={160}
          />
          <Checkbox
            label="Show archived"
            checked={showArchived}
            onChange={(e) => update({ archived: e.currentTarget.checked ? '1' : undefined })}
            ml="xs"
          />
        </FilterBar>

        <QueryState isLoading={list.isLoading} error={list.error} onRetry={() => list.refetch()} rows={6} what="plans" />
        {list.data && (
          <>
            {list.data.data.length > 0 && (
              <Table.ScrollContainer minWidth={1040}>
                <Table className="data-table">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Product</Table.Th>
                      <Table.Th ta="right">Price per unit</Table.Th>
                      <Table.Th>Period</Table.Th>
                      <Table.Th ta="right">Min qty</Table.Th>
                      <Table.Th>Available</Table.Th>
                      <Table.Th>Rules</Table.Th>
                      <Table.Th ta="right">Active subs</Table.Th>
                      {showArchived && <Table.Th>Status</Table.Th>}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {list.data.data.map((plan) => (
                      <Table.Tr
                        key={plan.id}
                        className={`row-link ${plan.isActive ? '' : classes.archivedRow}`}
                        onClick={() => drawer.openEdit(plan.id)}
                      >
                        <Table.Td fw={500}>{plan.name}</Table.Td>
                        <Table.Td>{plan.product?.name ?? '—'}</Table.Td>
                        <Table.Td ta="right" className="num">
                          {formatMoney(plan.price)}
                        </Table.Td>
                        <Table.Td>{BILLING_PERIOD_LABELS[plan.billingPeriod]}</Table.Td>
                        <Table.Td ta="right" className="num">
                          {plan.minQuantity}
                        </Table.Td>
                        <Table.Td c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                          {availability(plan)}
                        </Table.Td>
                        <Table.Td c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                          {rulesInWords(plan.rules)}
                        </Table.Td>
                        <Table.Td ta="right" className="num">
                          {plan.activeSubscriptions || '—'}
                        </Table.Td>
                        {showArchived && (
                          <Table.Td>
                            <StatusText {...(plan.isActive ? ACTIVE_STATUS.active : ACTIVE_STATUS.archived)} />
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
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
                        Add the first plan
                      </Button>
                    )
                  )
                }
              >
                {hasFilters ? 'No plans match these filters.' : 'No plans yet. A quotation needs a plan to price its product.'}
              </EmptyLine>
            )}
            <Pager meta={list.data.meta} onPage={(p) => update({ page: String(p) })} />
          </>
        )}
      </div>

      <PlanDrawer editing={drawer.editing} onClose={drawer.close} canEdit={canEdit} />
    </>
  )
}

// ---------------------------------------------------------------- drawer

function PlanDrawer({ editing, onClose, canEdit }: { editing: string | null; onClose: () => void; canEdit: boolean }) {
  const isNew = editing === 'new'
  const detail = useQuery({
    queryKey: ['plans', 'detail', editing],
    queryFn: () => plansApi.get(editing!),
    enabled: Boolean(editing) && !isNew,
  })
  const plan = isNew ? undefined : detail.data
  const opened = Boolean(editing) && (canEdit || !isNew)
  const title = isNew ? 'New plan' : (plan?.name ?? 'Plan')
  const subtitle = plan
    ? `${plan.product?.name ?? 'No product'} · ${BILLING_PERIOD_LABELS[plan.billingPeriod].toLowerCase()}${plan.isActive ? '' : ' · archived'}`
    : undefined

  if (!canEdit) {
    return (
      <FormDrawer opened={opened} onClose={onClose} title={title} subtitle={subtitle}>
        <QueryState isLoading={detail.isLoading} error={detail.error} onRetry={() => detail.refetch()} rows={4} what="the plan" />
        {plan && <PlanReadOnly plan={plan} />}
      </FormDrawer>
    )
  }

  return (
    <PlanFormDrawer
      key={plan ? `plan-${plan.id}` : `pending-${editing}`}
      opened={opened}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      plan={plan}
      loading={!isNew && detail.isLoading}
      loadError={isNew ? null : detail.error}
      onRetry={() => detail.refetch()}
    />
  )
}

function PlanReadOnly({ plan }: { plan: Plan }) {
  return (
    <Stack gap="lg">
      <DetailList
        items={[
          { label: 'Product', value: plan.product?.name },
          {
            label: 'Price',
            value: (
              <>
                <span className="num">{formatMoney(plan.price)}</span> per unit per {PERIOD_UNIT[plan.billingPeriod]}
              </>
            ),
          },
          { label: 'Minimum quantity', value: <span className="num">{plan.minQuantity}</span> },
          { label: 'Available', value: availability(plan) },
          { label: 'Active subscriptions', value: <span className="num">{plan.activeSubscriptions ?? 0}</span> },
          { label: 'Status', value: <StatusText {...(plan.isActive ? ACTIVE_STATUS.active : ACTIVE_STATUS.archived)} /> },
          { label: 'Description', value: plan.description || '—' },
        ]}
      />
      <div>
        <Text fw={600} size="md" mb={8}>
          Rules
        </Text>
        <Stack gap={8}>
          {PLAN_RULES.map((rule) => (
            <div key={rule.key}>
              <Text size="sm">
                {plan.rules[rule.key] ? 'Yes' : 'No'}: {rule.label.toLowerCase()}
              </Text>
              <Text size="xs" c="dimmed">
                {rule.hint}
              </Text>
            </div>
          ))}
        </Stack>
      </div>
    </Stack>
  )
}

const schema = z
  .object({
    name: requiredText('Enter the plan name').max(120, 'Keep it under 120 characters'),
    productId: z.string({ error: 'Pick the product this plan sells' }).min(1, 'Pick the product this plan sells'),
    price: z.number({ error: 'Enter the price per unit' }).int('Use whole paise').min(0, 'Must be ₹0 or more'),
    billingPeriod: z.enum(BILLING_PERIODS, { error: 'Pick a billing period' }),
    minQuantity: z.number({ error: 'Enter the minimum quantity' }).int('Use a whole number').min(1, 'Must be at least 1'),
    availableFrom: z.string({ error: 'Pick the first day it can be sold' }).min(1, 'Pick the first day it can be sold'),
    availableUntil: z.string().nullable(),
    rules: z.object({ autoClose: z.boolean(), closable: z.boolean(), pausable: z.boolean(), renewable: z.boolean() }),
    description: trimmed().max(2000, 'Keep it under 2,000 characters'),
  })
  .superRefine((v, ctx) => {
    if (typeof v.availableUntil === 'string' && v.availableUntil && typeof v.availableFrom === 'string' && v.availableUntil < v.availableFrom)
      ctx.addIssue({ code: 'custom', path: ['availableUntil'], message: 'Must be on or after the available-from date' })
  }, ALWAYS_CHECK)
type Values = z.input<typeof schema>
type Output = z.output<typeof schema>

interface PlanFormDrawerProps {
  opened: boolean
  onClose: () => void
  title: string
  subtitle?: string
  plan: Plan | undefined
  loading: boolean
  loadError: unknown
  onRetry: () => void
}

function PlanFormDrawer({ opened, onClose, title, subtitle, plan, loading, loadError, onRetry }: PlanFormDrawerProps) {
  const queryClient = useQueryClient()
  const products = useProductOptions()
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const { register, control, handleSubmit, setError, formState } = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: plan
      ? {
          name: plan.name,
          productId: plan.product?.id ?? plan.productId ?? '',
          price: plan.price,
          billingPeriod: plan.billingPeriod,
          minQuantity: plan.minQuantity,
          availableFrom: plan.availableFrom,
          availableUntil: plan.availableUntil,
          rules: { ...plan.rules },
          description: plan.description ?? '',
        }
      : {
          name: '',
          productId: '',
          price: null as unknown as number,
          billingPeriod: 'monthly',
          minQuantity: 1,
          availableFrom: today(),
          availableUntil: null,
          rules: { autoClose: false, closable: true, pausable: false, renewable: true },
          description: '',
        },
  })
  const productId = useWatch({ control, name: 'productId' })
  const period = useWatch({ control, name: 'billingPeriod' })
  const selectedProduct = productId ? products.byId.get(productId) : undefined

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['plans'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
  }

  const save = useMutation({
    mutationFn: (v: Output) => {
      const body = { ...v, availableUntil: v.availableUntil || null }
      return plan ? plansApi.update(plan.id, body) : plansApi.create(body)
    },
    onSuccess: (saved) => {
      invalidate()
      notifyDone(plan ? `Saved ${saved.name}` : `Added ${saved.name}`)
      onClose()
    },
    onError: (error) =>
      setFormError(
        placeServerErrors(error, setError, [
          'name',
          'productId',
          'price',
          'billingPeriod',
          'minQuantity',
          'availableFrom',
          'availableUntil',
          'rules',
          'description',
        ]),
      ),
  })

  const archive = useMutation({
    mutationFn: () => plansApi.archive(plan!.id),
    onSuccess: () => {
      invalidate()
      notifyDone(`Archived ${plan!.name}`)
      setConfirmArchive(false)
      onClose()
    },
    onError: (error) => notifyError(error, "Couldn't archive the plan. Try again."),
  })

  const onSubmit = handleSubmit((v) => {
    setFormError(null)
    save.mutate(v)
  })

  return (
    <>
      <FormDrawer
        opened={opened}
        onClose={onClose}
        title={title}
        subtitle={subtitle}
        footer={
          !loading &&
          !loadError && (
            <>
              <Button type="submit" form="plan-form" loading={save.isPending}>
                {plan ? 'Save plan' : 'Add plan'}
              </Button>
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              {plan?.isActive && (
                <Button variant="subtle" color="red" ml="auto" onClick={() => setConfirmArchive(true)}>
                  Archive
                </Button>
              )}
            </>
          )
        }
      >
        <QueryState isLoading={loading} error={loadError} onRetry={onRetry} rows={6} what="the plan" />
        {!loading && !loadError && (
          <form id="plan-form" onSubmit={onSubmit} noValidate>
            <FormAlert message={formError} />
            {plan && !plan.isActive && (
              <Text size="sm" c="dimmed" mb="md">
                This plan is archived. New quotations can't use it; existing subscriptions keep running.
              </Text>
            )}
            <FormSection title="Plan">
              <TextInput label="Name" {...register('name')} error={formState.errors.name?.message} data-autofocus />
              <Controller
                control={control}
                name="productId"
                render={({ field, fieldState }) => (
                  <Select
                    label="Product"
                    placeholder={products.query.isLoading ? 'Loading products…' : 'Pick a product'}
                    searchable
                    nothingFoundMessage="No product with that name"
                    data={products.options(field.value ? [field.value] : [])}
                    value={field.value || null}
                    onChange={(v) => field.onChange(v ?? '')}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Group grow align="flex-start">
                <Controller
                  control={control}
                  name="price"
                  render={({ field, fieldState }) => (
                    <MoneyInput
                      label="Price per unit"
                      description={period ? `Charged every ${PERIOD_UNIT[period]}, before tax` : 'Before tax'}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="billingPeriod"
                  render={({ field, fieldState }) => (
                    <Select
                      label="Billing period"
                      description="How often it's invoiced"
                      data={PERIOD_OPTIONS}
                      value={field.value ?? null}
                      onChange={(v) => field.onChange(v)}
                      allowDeselect={false}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Group>
              {selectedProduct && (
                <Text size="xs" c="dimmed" mt={-4}>
                  {selectedProduct.name} sells for <span className="num">{formatMoney(selectedProduct.salesPrice)}</span> on its own.
                  {selectedProduct.variants.length > 0 &&
                    ` Variant extras are added to this price (for example ${selectedProduct.variants[0].attribute}: ${selectedProduct.variants[0].value} +${formatMoney(selectedProduct.variants[0].extraPrice)}).`}
                </Text>
              )}
              <Controller
                control={control}
                name="minQuantity"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Minimum quantity"
                    description="Fewest units of the product a subscription on this plan can have"
                    min={1}
                    allowDecimal={false}
                    allowNegative={false}
                    value={field.value ?? ''}
                    onChange={(v) => field.onChange(v === '' ? null : Number(v))}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    w={220}
                    styles={{ input: { fontVariantNumeric: 'tabular-nums' } }}
                  />
                )}
              />
            </FormSection>

            <FormSection title="Availability" hint="New subscriptions must start inside these dates.">
              <Group grow align="flex-start">
                <Controller
                  control={control}
                  name="availableFrom"
                  render={({ field, fieldState }) => (
                    <DateInput
                      label="Available from"
                      valueFormat="DD MMM YYYY"
                      value={field.value || null}
                      onChange={(v) => field.onChange(v ?? '')}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="availableUntil"
                  render={({ field, fieldState }) => (
                    <DateInput
                      label="Available until"
                      placeholder="No end date"
                      valueFormat="DD MMM YYYY"
                      clearable
                      value={field.value || null}
                      onChange={(v) => field.onChange(v || null)}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Group>
            </FormSection>

            <FormSection title="Rules" hint="What staff and customers may do with a subscription on this plan.">
              {PLAN_RULES.map((rule) => (
                <Controller
                  key={rule.key}
                  control={control}
                  name={`rules.${rule.key}`}
                  render={({ field }) => (
                    <Checkbox
                      label={rule.label}
                      description={rule.hint}
                      checked={Boolean(field.value)}
                      onChange={(e) => field.onChange(e.currentTarget.checked)}
                    />
                  )}
                />
              ))}
            </FormSection>

            <FormSection title="Description">
              <Textarea
                aria-label="Description"
                placeholder="Yearly contract for teams of 10 or more"
                autosize
                minRows={2}
                maxRows={6}
                {...register('description')}
                error={formState.errors.description?.message}
              />
            </FormSection>
          </form>
        )}
      </FormDrawer>

      {plan && (
        <ConfirmModal
          opened={confirmArchive}
          onClose={() => setConfirmArchive(false)}
          onConfirm={() => archive.mutate()}
          loading={archive.isPending}
          danger
          title={`Archive ${plan.name}?`}
          confirmLabel="Archive plan"
          error={archive.error && isApiError(archive.error) ? archive.error.message : null}
        >
          New quotations won't be able to use it.{' '}
          {plan.activeSubscriptions
            ? `${pluralize(plan.activeSubscriptions, 'active subscription')} on this plan keep running and billing as before.`
            : 'No active subscriptions use it.'}
        </ConfirmModal>
      )}
    </>
  )
}
