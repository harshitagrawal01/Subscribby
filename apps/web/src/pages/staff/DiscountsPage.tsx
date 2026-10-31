import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Input, MultiSelect, NumberInput, Radio, SegmentedControl, Stack, Table, Text, TextInput } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useDebouncedValue } from '@mantine/hooks'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { MoneyInput } from '@/components/MoneyInput'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { StatusText } from '@/components/StatusBadge'
import classes from '@/features/catalog/catalog.module.css'
import { ConfirmModal, EmptyLine, FilterBar, FormAlert, FormDrawer, FormSection, Pager, UsageBar } from '@/features/catalog/components'
import { ALWAYS_CHECK, useEditParam, useProductOptions, useRole, useUrlFilters } from '@/features/catalog/hooks'
import { DISCOUNT_STATE, DISCOUNT_STATES, discountAppliesText, discountValueText } from '@/features/catalog/labels'
import { placeServerErrors } from '@/features/catalog/server-errors'
import { isApiError } from '@/lib/api/client'
import { discountsApi } from '@/lib/api/endpoints'
import type { Discount, DiscountState } from '@/lib/api/types'
import { formatDate, formatMoney, today } from '@/lib/format'
import { notifyDone, notifyError } from '@/lib/notify'
import { requiredText } from '@/lib/validation'

const PAGE_SIZE = 20

export function DiscountsPage() {
  const { can } = useRole()
  const canEdit = can('admin')
  const products = useProductOptions()
  const { params, update, clear } = useUrlFilters()
  const drawer = useEditParam()
  const stateParam = params.get('state') as DiscountState | null
  const state = stateParam && DISCOUNT_STATES.includes(stateParam) ? stateParam : undefined
  const page = Number(params.get('page') ?? 1)
  const [search] = useDebouncedValue((params.get('search') ?? '').trim(), 300)

  const query = { state, search: search || undefined, page, limit: PAGE_SIZE, sort: '-createdAt' }
  const list = useQuery({ queryKey: ['discounts', 'list', query], queryFn: () => discountsApi.list(query), placeholderData: keepPreviousData })
  // The API has no per-state counts, so one wide fetch feeds the tab counts.
  const all = useQuery({ queryKey: ['discounts', 'counts'], queryFn: () => discountsApi.list({ limit: 100 }) })
  const counts = (all.data?.data ?? []).reduce<Partial<Record<DiscountState, number>>>((acc, d) => {
    acc[d.state] = (acc[d.state] ?? 0) + 1
    return acc
  }, {})
  const total = all.data?.meta.total

  return (
    <>
      <PageHeader
        title="Discounts"
        description="Applied automatically while running. One product discount per line and one subscription discount per invoice, the biggest wins."
        actions={
          canEdit && (
            <Button leftSection={<IconPlus size={16} stroke={1.75} />} onClick={drawer.openNew}>
              New discount
            </Button>
          )
        }
      />

      <div className="panel">
        <div className="filter-tabs" role="tablist" aria-label="Filter by state">
          <button className="filter-tab" role="tab" aria-selected={!state} onClick={() => update({ state: undefined })}>
            All<span className="count">{total ?? '·'}</span>
          </button>
          {DISCOUNT_STATES.map((s) => (
            <button key={s} className="filter-tab" role="tab" aria-selected={state === s} onClick={() => update({ state: s })}>
              {DISCOUNT_STATE[s].label}
              <span className="count">{all.data ? (counts[s] ?? 0) : '·'}</span>
            </button>
          ))}
        </div>
        <FilterBar>
          <TextInput
            aria-label="Search discounts"
            placeholder="Search by name"
            leftSection={<IconSearch size={15} stroke={1.5} />}
            defaultValue={params.get('search') ?? ''}
            onChange={(e) => update({ search: e.currentTarget.value.trim() || undefined })}
            w={260}
          />
        </FilterBar>

        <QueryState isLoading={list.isLoading} error={list.error} onRetry={() => list.refetch()} rows={5} what="discounts" />
        {list.data && (
          <>
            {list.data.data.length > 0 && (
              <Table.ScrollContainer minWidth={1060}>
                <Table className="data-table">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th ta="right">Discount</Table.Th>
                      <Table.Th ta="right">Min purchase</Table.Th>
                      <Table.Th ta="right">Min qty</Table.Th>
                      <Table.Th>Valid</Table.Th>
                      <Table.Th>Used</Table.Th>
                      <Table.Th>Applies to</Table.Th>
                      <Table.Th>State</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {list.data.data.map((d) => (
                      <Table.Tr
                        key={d.id}
                        className={`${canEdit ? 'row-link' : ''} ${d.state === 'inactive' ? classes.archivedRow : ''}`}
                        onClick={canEdit ? () => drawer.openEdit(d.id) : undefined}
                      >
                        <Table.Td fw={500}>{d.name}</Table.Td>
                        <Table.Td ta="right" className="num">
                          {discountValueText(d)}
                        </Table.Td>
                        <Table.Td ta="right" className="num">
                          {d.minPurchaseAmount ? formatMoney(d.minPurchaseAmount) : '—'}
                        </Table.Td>
                        <Table.Td ta="right" className="num">
                          {d.minQuantity ?? '—'}
                        </Table.Td>
                        <Table.Td c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                          {formatDate(d.startDate)} to {formatDate(d.endDate)}
                        </Table.Td>
                        <Table.Td>
                          <UsageBar used={d.usedCount} limit={d.usageLimit} />
                        </Table.Td>
                        <Table.Td maw={220}>
                          <Text size="sm" truncate title={discountAppliesText(d, products.byId)}>
                            {discountAppliesText(d, products.byId)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <StatusText {...DISCOUNT_STATE[d.state]} />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
            {!list.data.data.length && (
              <EmptyLine
                action={
                  state || search ? (
                    <Button size="compact-sm" variant="default" onClick={() => clear()}>
                      Show all discounts
                    </Button>
                  ) : (
                    canEdit && (
                      <Button size="compact-sm" variant="default" onClick={drawer.openNew}>
                        Add a discount
                      </Button>
                    )
                  )
                }
              >
                {search
                  ? 'No discounts match this search.'
                  : state
                    ? `No ${DISCOUNT_STATE[state].label.toLowerCase()} discounts.`
                    : 'No discounts yet. Invoices are priced at the plan and product prices.'}
              </EmptyLine>
            )}
            <Pager meta={list.data.meta} onPage={(p) => update({ page: String(p) })} />
          </>
        )}
      </div>

      {canEdit && <DiscountDrawer editing={drawer.editing} onClose={drawer.close} />}
    </>
  )
}

// ---------------------------------------------------------------- drawer

function DiscountDrawer({ editing, onClose }: { editing: string | null; onClose: () => void }) {
  const isNew = editing === 'new'
  const detail = useQuery({
    queryKey: ['discounts', 'detail', editing],
    queryFn: () => discountsApi.get(editing!),
    enabled: Boolean(editing) && !isNew,
  })
  const discount = isNew ? undefined : detail.data
  return (
    <DiscountFormDrawer
      key={discount ? `discount-${discount.id}-${discount.isActive}` : `pending-${editing}`}
      opened={Boolean(editing)}
      onClose={onClose}
      discount={discount}
      loading={!isNew && detail.isLoading}
      loadError={isNew ? null : detail.error}
      onRetry={() => detail.refetch()}
    />
  )
}

const optionalCount = z.number().int('Use a whole number').nullable()

const schema = z
  .object({
    name: requiredText('Enter a name, like Bulk seats 10%').max(80, 'Keep it under 80 characters'),
    type: z.enum(['percentage', 'fixed']),
    value: z.number({ error: 'Enter the discount' }).nullable(),
    minPurchaseAmount: z.number().int().min(0, 'Must be ₹0 or more').nullable(),
    minQuantity: optionalCount,
    startDate: z.string({ error: 'Pick a start date' }).min(1, 'Pick a start date'),
    endDate: z.string({ error: 'Pick an end date' }).min(1, 'Pick an end date'),
    usageLimit: optionalCount,
    kind: z.enum(['products', 'subscription']),
    productIds: z.array(z.string()),
    usedCount: z.number(),
  })
  .superRefine((v, ctx) => {
    if (v.value == null) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter the discount' })
    else if (v.type === 'percentage' && (v.value <= 0 || v.value > 100))
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Use a percentage above 0 and up to 100' })
    else if (v.type === 'fixed' && v.value < 1) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter an amount above ₹0' })
    if (v.minQuantity != null && v.minQuantity < 1)
      ctx.addIssue({ code: 'custom', path: ['minQuantity'], message: 'Must be at least 1, or leave it empty' })
    if (v.startDate && v.endDate && v.endDate < v.startDate)
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Must be on or after the start date' })
    if (v.usageLimit != null && v.usageLimit < Math.max(1, v.usedCount))
      ctx.addIssue({
        code: 'custom',
        path: ['usageLimit'],
        message: v.usedCount ? `Can't be below the ${v.usedCount} uses already made` : 'Must be at least 1, or leave it empty',
      })
    if (v.kind === 'products' && !(v.productIds ?? []).length)
      ctx.addIssue({ code: 'custom', path: ['productIds'], message: 'Pick at least one product' })
  }, ALWAYS_CHECK)
type Values = z.input<typeof schema>
type Output = z.output<typeof schema>

interface DiscountFormDrawerProps {
  opened: boolean
  onClose: () => void
  discount: Discount | undefined
  loading: boolean
  loadError: unknown
  onRetry: () => void
}

const countInput = (value: number | null | undefined, onChange: (v: number | null) => void) => ({
  value: value ?? '',
  onChange: (v: string | number) => onChange(v === '' ? null : Number(v)),
  allowDecimal: false,
  allowNegative: false,
  min: 1,
  hideControls: true,
  styles: { input: { fontVariantNumeric: 'tabular-nums' } },
})

function DiscountFormDrawer({ opened, onClose, discount, loading, loadError, onRetry }: DiscountFormDrawerProps) {
  const queryClient = useQueryClient()
  const products = useProductOptions()
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)
  const { register, control, handleSubmit, setError, setValue, formState } = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: discount?.name ?? '',
      type: discount?.type ?? 'percentage',
      value: discount?.value ?? null,
      minPurchaseAmount: discount?.minPurchaseAmount ?? null,
      minQuantity: discount?.minQuantity ?? null,
      startDate: discount?.startDate ?? today(),
      endDate: discount?.endDate ?? dayjs().add(1, 'month').format('YYYY-MM-DD'),
      usageLimit: discount?.usageLimit ?? null,
      kind: discount?.appliesTo.kind ?? 'products',
      productIds: discount?.appliesTo.productIds ?? [],
      usedCount: discount?.usedCount ?? 0,
    },
  })
  const type = useWatch({ control, name: 'type' })
  const kind = useWatch({ control, name: 'kind' })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['discounts'] })

  const save = useMutation({
    mutationFn: (v: Output) => {
      const body = {
        name: v.name,
        type: v.type,
        value: v.value ?? 0,
        minPurchaseAmount: v.minPurchaseAmount || null,
        minQuantity: v.minQuantity,
        startDate: v.startDate,
        endDate: v.endDate,
        usageLimit: v.usageLimit,
        appliesTo: { kind: v.kind, productIds: v.kind === 'products' ? v.productIds : [] },
      }
      return discount ? discountsApi.update(discount.id, body) : discountsApi.create(body)
    },
    onSuccess: (saved) => {
      invalidate()
      notifyDone(`${discount ? 'Saved' : 'Added'} ${saved.name}. It's ${DISCOUNT_STATE[saved.state].label.toLowerCase()}.`)
      onClose()
    },
    onError: (error) =>
      setFormError(
        placeServerErrors(
          error,
          setError,
          ['name', 'type', 'value', 'minPurchaseAmount', 'minQuantity', 'startDate', 'endDate', 'usageLimit', 'kind', 'productIds'],
          { 'appliesTo.kind': 'kind', 'appliesTo.productIds': 'productIds', appliesTo: 'kind' },
        ),
      ),
  })

  const stop = useMutation({
    mutationFn: () => discountsApi.stop(discount!.id),
    onSuccess: (saved) => {
      invalidate()
      notifyDone(`Stopped ${saved.name}. New invoices won't get it.`)
      setConfirmStop(false)
      onClose()
    },
    onError: (error) => notifyError(error, "Couldn't stop the discount. Try again."),
  })

  const restart = useMutation({
    mutationFn: () => discountsApi.update(discount!.id, { isActive: true }),
    onSuccess: (saved) => {
      invalidate()
      notifyDone(`Turned ${saved.name} back on. It's ${DISCOUNT_STATE[saved.state].label.toLowerCase()}.`)
      onClose()
    },
    onError: (error) => notifyError(error, "Couldn't turn the discount back on. Try again."),
  })

  const title = discount ? discount.name : 'New discount'
  const subtitle = discount ? (
    <>
      {DISCOUNT_STATE[discount.state].label} · used {discount.usedCount}
      {discount.usageLimit != null ? ` of ${discount.usageLimit}` : ''} {discount.usedCount === 1 ? 'time' : 'times'}
    </>
  ) : (
    'Applies on its own to invoices that meet the conditions.'
  )

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
              <Button type="submit" form="discount-form" loading={save.isPending}>
                {discount ? 'Save discount' : 'Add discount'}
              </Button>
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              {discount && discount.isActive && (
                <Button variant="subtle" color="red" ml="auto" onClick={() => setConfirmStop(true)}>
                  Stop now
                </Button>
              )}
              {discount && !discount.isActive && (
                <Button variant="subtle" ml="auto" loading={restart.isPending} onClick={() => restart.mutate()}>
                  Turn back on
                </Button>
              )}
            </>
          )
        }
      >
        <QueryState isLoading={loading} error={loadError} onRetry={onRetry} rows={6} what="the discount" />
        {!loading && !loadError && (
          <form
            id="discount-form"
            noValidate
            onSubmit={handleSubmit((v) => {
              setFormError(null)
              save.mutate(v)
            })}
          >
            <FormAlert message={formError} />
            {discount && !discount.isActive && (
              <Text size="sm" c="dimmed" mb="md">
                Stopped. It isn't applied to new invoices until it's turned back on.
              </Text>
            )}
            <FormSection title="Discount">
              <TextInput label="Name" {...register('name')} error={formState.errors.name?.message} data-autofocus />
              <Group grow align="flex-start">
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <Input.Wrapper label="Type" id="discount-type-label">
                      <SegmentedControl
                        aria-labelledby="discount-type-label-label"
                        fullWidth
                        data={[
                          { value: 'percentage', label: 'Percentage' },
                          { value: 'fixed', label: 'Fixed amount' },
                        ]}
                        value={field.value}
                        onChange={(v) => {
                          field.onChange(v)
                          setValue('value', null)
                        }}
                      />
                    </Input.Wrapper>
                  )}
                />
                <Controller
                  control={control}
                  name="value"
                  render={({ field, fieldState }) =>
                    type === 'percentage' ? (
                      <NumberInput
                        label="Discount"
                        suffix="%"
                        decimalScale={2}
                        min={0}
                        max={100}
                        allowNegative={false}
                        hideControls
                        value={field.value ?? ''}
                        onChange={(v) => field.onChange(v === '' ? null : Number(v))}
                        onBlur={field.onBlur}
                        error={fieldState.error?.message}
                        styles={{ input: { fontVariantNumeric: 'tabular-nums' } }}
                      />
                    ) : (
                      <MoneyInput
                        label="Amount off"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        error={fieldState.error?.message}
                      />
                    )
                  }
                />
              </Group>
              <Text size="xs" c="dimmed" mt={-4}>
                {type === 'percentage'
                  ? 'Taken off the line subtotal (or the whole subscription) before tax.'
                  : 'Taken off once per invoice, never more than the amount it applies to.'}
              </Text>
            </FormSection>

            <FormSection title="Applies to">
              <Controller
                control={control}
                name="kind"
                render={({ field, fieldState }) => (
                  <Radio.Group aria-label="Applies to" value={field.value} onChange={field.onChange} error={fieldState.error?.message}>
                    <Stack gap={10}>
                      <Radio
                        value="products"
                        label="Specific products"
                        description="Each matching line gets the discount on its own subtotal."
                      />
                      {kind === 'products' && (
                        <Controller
                          control={control}
                          name="productIds"
                          render={({ field: f, fieldState: fs }) => (
                            <MultiSelect
                              aria-label="Products"
                              ml={30}
                              searchable
                              placeholder={f.value.length ? undefined : 'Pick products'}
                              nothingFoundMessage="No product with that name"
                              data={products.options(f.value)}
                              value={f.value}
                              onChange={f.onChange}
                              error={fs.error?.message}
                            />
                          )}
                        />
                      )}
                      <Radio
                        value="subscription"
                        label="Whole subscription"
                        description="Taken off the invoice total and shared across its lines."
                      />
                    </Stack>
                  </Radio.Group>
                )}
              />
            </FormSection>

            <FormSection title="Conditions" hint="It applies from the start date through the end date. Leave a condition empty to skip it.">
              <Group grow align="flex-start">
                <Controller
                  control={control}
                  name="minPurchaseAmount"
                  render={({ field, fieldState }) => (
                    <MoneyInput
                      label="Minimum purchase"
                      description="Subscription subtotal before tax"
                      placeholder="No minimum"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="minQuantity"
                  render={({ field, fieldState }) => (
                    <NumberInput
                      label="Minimum quantity"
                      description={kind === 'products' ? 'Units on the line' : 'Units across the subscription'}
                      placeholder="No minimum"
                      {...countInput(field.value, field.onChange)}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Group>
              <Group grow align="flex-start">
                <Controller
                  control={control}
                  name="startDate"
                  render={({ field, fieldState }) => (
                    <DateInput
                      label="Starts"
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
                  name="endDate"
                  render={({ field, fieldState }) => (
                    <DateInput
                      label="Ends"
                      valueFormat="DD MMM YYYY"
                      value={field.value || null}
                      onChange={(v) => field.onChange(v ?? '')}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Group>
              <Controller
                control={control}
                name="usageLimit"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Usage limit"
                    description={
                      discount?.usedCount
                        ? `Invoices it can be applied to. Used ${discount.usedCount} ${discount.usedCount === 1 ? 'time' : 'times'} so far.`
                        : 'Invoices it can be applied to. Empty means no limit.'
                    }
                    placeholder="No limit"
                    w={260}
                    {...countInput(field.value, field.onChange)}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </FormSection>
          </form>
        )}
      </FormDrawer>

      {discount && (
        <ConfirmModal
          opened={confirmStop}
          onClose={() => setConfirmStop(false)}
          onConfirm={() => stop.mutate()}
          loading={stop.isPending}
          danger
          title={`Stop ${discount.name} now?`}
          confirmLabel="Stop discount"
          error={stop.error && isApiError(stop.error) ? stop.error.message : null}
        >
          New invoices won't get this discount from now on. Invoices that already have it keep it. You can turn it back on later.
        </ConfirmModal>
      )}
    </>
  )
}
