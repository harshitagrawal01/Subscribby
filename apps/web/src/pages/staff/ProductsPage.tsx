import { zodResolver } from '@hookform/resolvers/zod'
import { ActionIcon, Button, Checkbox, Group, Select, Stack, Table, Text, Textarea, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconPlus, IconSearch, IconX } from '@tabler/icons-react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { MoneyInput } from '@/components/MoneyInput'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { StatusText } from '@/components/StatusBadge'
import classes from '@/features/catalog/catalog.module.css'
import { ConfirmModal, DetailList, EmptyLine, FilterBar, FormAlert, FormDrawer, FormSection, Pager } from '@/features/catalog/components'
import { ALWAYS_CHECK, useEditParam, useRole, useUrlFilters } from '@/features/catalog/hooks'
import { ACTIVE_STATUS, PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from '@/features/catalog/labels'
import { placeServerErrors } from '@/features/catalog/server-errors'
import { isApiError } from '@/lib/api/client'
import { productsApi } from '@/lib/api/endpoints'
import type { Product, ProductType } from '@/lib/api/types'
import { formatMoney, pluralize } from '@/lib/format'
import { notifyDone, notifyError } from '@/lib/notify'
import { requiredText, trimmed } from '@/lib/validation'

const PAGE_SIZE = 20
const TYPE_OPTIONS = PRODUCT_TYPES.map((t) => ({ value: t, label: PRODUCT_TYPE_LABELS[t] }))

export function ProductsPage() {
  const { can } = useRole()
  const canEdit = can('admin')
  const { params, update, clear } = useUrlFilters()
  const drawer = useEditParam()
  const type = (params.get('type') as ProductType | null) ?? undefined
  const showArchived = params.get('archived') === '1'
  const page = Number(params.get('page') ?? 1)
  const [search] = useDebouncedValue((params.get('search') ?? '').trim(), 300)

  const query = {
    type,
    isActive: showArchived ? undefined : true,
    search: search || undefined,
    page,
    limit: PAGE_SIZE,
    sort: 'name',
  }
  const list = useQuery({ queryKey: ['products', 'list', query], queryFn: () => productsApi.list(query), placeholderData: keepPreviousData })
  const hasFilters = Boolean(type || search || showArchived)

  return (
    <>
      <PageHeader
        title="Products"
        description={
          canEdit ? 'What you sell, priced per unit before any plan, variant or tax.' : 'What we sell. Only an admin can change products.'
        }
        actions={
          canEdit && (
            <Button leftSection={<IconPlus size={16} stroke={1.75} />} onClick={drawer.openNew}>
              New product
            </Button>
          )
        }
      />

      <div className="panel">
        <FilterBar>
          <TextInput
            aria-label="Search products"
            placeholder="Search by name"
            leftSection={<IconSearch size={15} stroke={1.5} />}
            defaultValue={params.get('search') ?? ''}
            onChange={(e) => update({ search: e.currentTarget.value.trim() || undefined })}
            w={260}
          />
          <Select
            aria-label="Type"
            placeholder="Any type"
            clearable
            data={TYPE_OPTIONS}
            value={type ?? null}
            onChange={(v) => update({ type: v ?? undefined })}
            w={170}
          />
          <Checkbox
            label="Show archived"
            checked={showArchived}
            onChange={(e) => update({ archived: e.currentTarget.checked ? '1' : undefined })}
            ml="xs"
          />
        </FilterBar>

        <QueryState isLoading={list.isLoading} error={list.error} onRetry={() => list.refetch()} rows={6} what="products" />
        {list.data && (
          <>
            {list.data.data.length > 0 && (
              <Table.ScrollContainer minWidth={820}>
                <Table className="data-table">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th ta="right">Sales price</Table.Th>
                      <Table.Th ta="right">Cost price</Table.Th>
                      <Table.Th ta="right">Variants</Table.Th>
                      <Table.Th ta="right">Used in plans</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {list.data.data.map((p) => (
                      <Table.Tr
                        key={p.id}
                        className={`row-link ${p.isActive ? '' : classes.archivedRow}`}
                        onClick={() => drawer.openEdit(p.id)}
                      >
                        <Table.Td fw={500}>{p.name}</Table.Td>
                        <Table.Td>{PRODUCT_TYPE_LABELS[p.type]}</Table.Td>
                        <Table.Td ta="right" className="num">
                          {formatMoney(p.salesPrice)}
                        </Table.Td>
                        <Table.Td ta="right" className="num" c="dimmed">
                          {formatMoney(p.costPrice)}
                        </Table.Td>
                        <Table.Td ta="right" className="num">
                          {p.variants.length || '—'}
                        </Table.Td>
                        <Table.Td ta="right" className="num">
                          {p.usedInPlans || '—'}
                        </Table.Td>
                        <Table.Td>
                          <StatusText {...(p.isActive ? ACTIVE_STATUS.active : ACTIVE_STATUS.archived)} />
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
                  hasFilters ? (
                    <Button size="compact-sm" variant="default" onClick={() => clear()}>
                      Clear filters
                    </Button>
                  ) : (
                    canEdit && (
                      <Button size="compact-sm" variant="default" onClick={drawer.openNew}>
                        Add the first product
                      </Button>
                    )
                  )
                }
              >
                {hasFilters ? 'No products match these filters.' : 'No products yet. Plans and quotations need at least one.'}
              </EmptyLine>
            )}
            <Pager meta={list.data.meta} onPage={(p) => update({ page: String(p) })} />
          </>
        )}
      </div>

      <ProductDrawer editing={drawer.editing} onClose={drawer.close} canEdit={canEdit} />
    </>
  )
}

// ---------------------------------------------------------------- drawer

function ProductDrawer({ editing, onClose, canEdit }: { editing: string | null; onClose: () => void; canEdit: boolean }) {
  const isNew = editing === 'new'
  const detail = useQuery({
    queryKey: ['products', 'detail', editing],
    queryFn: () => productsApi.get(editing!),
    enabled: Boolean(editing) && !isNew,
  })
  const product = isNew ? undefined : detail.data
  const opened = Boolean(editing) && (canEdit || !isNew)
  const title = isNew ? 'New product' : (product?.name ?? 'Product')
  const subtitle = product ? `${PRODUCT_TYPE_LABELS[product.type]}${product.isActive ? '' : ' · archived'}` : undefined

  if (!canEdit) {
    return (
      <FormDrawer opened={opened} onClose={onClose} title={title} subtitle={subtitle}>
        <QueryState isLoading={detail.isLoading} error={detail.error} onRetry={() => detail.refetch()} rows={4} what="the product" />
        {product && <ProductReadOnly product={product} />}
      </FormDrawer>
    )
  }

  return (
    <ProductFormDrawer
      key={product ? `product-${product.id}` : `pending-${editing}`}
      opened={opened}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      product={product}
      loading={!isNew && detail.isLoading}
      loadError={isNew ? null : detail.error}
      onRetry={() => detail.refetch()}
    />
  )
}

function ProductReadOnly({ product }: { product: Product }) {
  return (
    <Stack gap="lg">
      <DetailList
        items={[
          { label: 'Type', value: PRODUCT_TYPE_LABELS[product.type] },
          { label: 'Sales price', value: <span className="num">{formatMoney(product.salesPrice)}</span> },
          { label: 'Cost price', value: <span className="num">{formatMoney(product.costPrice)}</span> },
          { label: 'Used in plans', value: product.usedInPlans ? pluralize(product.usedInPlans, 'active plan') : 'Not used yet' },
          { label: 'Status', value: <StatusText {...(product.isActive ? ACTIVE_STATUS.active : ACTIVE_STATUS.archived)} /> },
          { label: 'Notes', value: product.notes || '—' },
        ]}
      />
      <div>
        <Text fw={600} size="md" mb={6}>
          Variants
        </Text>
        {product.variants.length ? (
          <Table className="data-table">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Variant</Table.Th>
                <Table.Th ta="right">Extra</Table.Th>
                <Table.Th ta="right">Final price</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {product.variants.map((v) => (
                <Table.Tr key={v.id}>
                  <Table.Td>
                    {v.attribute}: {v.value}
                  </Table.Td>
                  <Table.Td ta="right" className="num">
                    +{formatMoney(v.extraPrice)}
                  </Table.Td>
                  <Table.Td ta="right" className="num">
                    {formatMoney(product.salesPrice + v.extraPrice)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text size="sm" c="dimmed">
            No variants. Every line uses the sales price.
          </Text>
        )}
      </div>
    </Stack>
  )
}

const moneyRequired = (message: string) => z.number({ error: message }).int('Use whole paise').min(0, 'Must be ₹0 or more')

const schema = z
  .object({
    name: requiredText('Enter the product name').max(120, 'Keep it under 120 characters'),
    type: z.enum(PRODUCT_TYPES, { error: 'Pick a type' }),
    salesPrice: moneyRequired('Enter the sales price'),
    costPrice: z.number().int().min(0, 'Must be ₹0 or more').nullable(),
    notes: trimmed().max(2000, 'Keep notes under 2,000 characters'),
    variants: z.array(
      z.object({
        variantId: z.string().optional(),
        attribute: requiredText('Enter an attribute, like Brand').max(60, 'Keep it under 60 characters'),
        value: requiredText('Enter a value, like Odoo').max(60, 'Keep it under 60 characters'),
        extraPrice: moneyRequired('Enter the extra price, 0 if none'),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>()
    ;(v.variants ?? []).forEach((variant, i) => {
      if (!variant?.attribute || !variant.value) return
      const key = `${variant.attribute.toLowerCase()}:${variant.value.toLowerCase()}`
      if (seen.has(key)) ctx.addIssue({ code: 'custom', path: ['variants', i, 'value'], message: 'This variant is already listed' })
      seen.add(key)
    })
  }, ALWAYS_CHECK)
type Values = z.input<typeof schema>
type Output = z.output<typeof schema>

interface ProductFormDrawerProps {
  opened: boolean
  onClose: () => void
  title: string
  subtitle?: string
  product: Product | undefined
  loading: boolean
  loadError: unknown
  onRetry: () => void
}

function ProductFormDrawer({ opened, onClose, title, subtitle, product, loading, loadError, onRetry }: ProductFormDrawerProps) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const { register, control, handleSubmit, setError, formState } = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: product
      ? {
          name: product.name,
          type: product.type,
          salesPrice: product.salesPrice,
          costPrice: product.costPrice,
          notes: product.notes ?? '',
          variants: product.variants.map((v) => ({ variantId: v.id, attribute: v.attribute, value: v.value, extraPrice: v.extraPrice })),
        }
      : { name: '', type: 'service', salesPrice: null as unknown as number, costPrice: null, notes: '', variants: [] },
  })
  const variants = useFieldArray({ control, name: 'variants' })
  const salesPrice = useWatch({ control, name: 'salesPrice' })
  const watchedVariants = useWatch({ control, name: 'variants' })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['plans'] })
  }

  const save = useMutation({
    mutationFn: (v: Output) => {
      const body = {
        name: v.name,
        type: v.type,
        salesPrice: v.salesPrice,
        costPrice: v.costPrice ?? 0,
        notes: v.notes,
        variants: v.variants.map(({ variantId, attribute, value, extraPrice }) =>
          variantId ? { id: variantId, attribute, value, extraPrice } : { attribute, value, extraPrice },
        ),
      }
      // Variants added in this form have no id yet; the API assigns one and keeps existing ids.
      return product ? productsApi.update(product.id, body as Partial<Product>) : productsApi.create(body)
    },
    onSuccess: (saved) => {
      invalidate()
      notifyDone(product ? `Saved ${saved.name}` : `Added ${saved.name}`)
      onClose()
    },
    onError: (error) => {
      setFormError(placeServerErrors(error, setError, ['name', 'type', 'salesPrice', 'costPrice', 'notes', 'variants']))
    },
  })

  const archive = useMutation({
    mutationFn: () => productsApi.archive(product!.id),
    onSuccess: () => {
      invalidate()
      notifyDone(`Archived ${product!.name}`)
      setConfirmArchive(false)
      onClose()
    },
    onError: (error) => notifyError(error, "Couldn't archive the product. Try again."),
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
        size={560}
        footer={
          !loading &&
          !loadError && (
            <>
              <Button type="submit" form="product-form" loading={save.isPending}>
                {product ? 'Save product' : 'Add product'}
              </Button>
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              {product?.isActive && (
                <Button variant="subtle" color="red" ml="auto" onClick={() => setConfirmArchive(true)}>
                  Archive
                </Button>
              )}
            </>
          )
        }
      >
        <QueryState isLoading={loading} error={loadError} onRetry={onRetry} rows={5} what="the product" />
        {!loading && !loadError && (
          <form id="product-form" onSubmit={onSubmit} noValidate>
            <FormAlert message={formError} />
            {product && !product.isActive && (
              <Text size="sm" c="dimmed" mb="md">
                This product is archived. It can't be added to new plans or quotations, but existing subscriptions keep it.
              </Text>
            )}
            <FormSection title="Product">
              <TextInput label="Name" {...register('name')} error={formState.errors.name?.message} data-autofocus />
              <Controller
                control={control}
                name="type"
                render={({ field, fieldState }) => (
                  <Select
                    label="Type"
                    data={TYPE_OPTIONS}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v)}
                    onBlur={field.onBlur}
                    allowDeselect={false}
                    error={fieldState.error?.message}
                    description="Taxes can follow the type, for example GST on services and add-ons."
                  />
                )}
              />
              <Group grow align="flex-start">
                <Controller
                  control={control}
                  name="salesPrice"
                  render={({ field, fieldState }) => (
                    <MoneyInput
                      label="Sales price"
                      description="Per unit, before tax"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="costPrice"
                  render={({ field, fieldState }) => (
                    <MoneyInput
                      label="Cost price"
                      description="What it costs you, optional"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Group>
              <Textarea label="Notes" autosize minRows={2} maxRows={6} {...register('notes')} error={formState.errors.notes?.message} />
            </FormSection>

            <FormSection title="Variants" hint="Options that change the price, like Brand: Odoo for ₹560 more. Leave empty if there are none.">
              {variants.fields.length > 0 && (
                <div className={classes.variantHead} aria-hidden>
                  <span>Attribute</span>
                  <span>Value</span>
                  <span>Extra price</span>
                  <span />
                </div>
              )}
              {variants.fields.map((field, i) => {
                const errors = formState.errors.variants?.[i]
                const extra = watchedVariants?.[i]?.extraPrice
                const final = salesPrice != null && extra != null ? salesPrice + extra : null
                return (
                  <div key={field.id}>
                    <div className={classes.variantRow}>
                      <TextInput
                        aria-label={`Variant ${i + 1} attribute`}
                        {...register(`variants.${i}.attribute`)}
                        error={errors?.attribute?.message}
                      />
                      <TextInput
                        aria-label={`Variant ${i + 1} value`}
                        {...register(`variants.${i}.value`)}
                        error={errors?.value?.message}
                      />
                      <Controller
                        control={control}
                        name={`variants.${i}.extraPrice`}
                        render={({ field: f, fieldState }) => (
                          <MoneyInput
                            aria-label={`Variant ${i + 1} extra price`}
                            value={f.value}
                            onChange={f.onChange}
                            onBlur={f.onBlur}
                            error={fieldState.error?.message}
                          />
                        )}
                      />
                      <ActionIcon variant="subtle" color="gray" size={36} aria-label={`Remove variant ${i + 1}`} onClick={() => variants.remove(i)}>
                        <IconX size={16} stroke={1.5} />
                      </ActionIcon>
                    </div>
                    <Text size="xs" c="dimmed" mt={4}>
                      {final != null ? (
                        <>
                          Final price <span className="num">{formatMoney(final)}</span> per unit outside a plan
                        </>
                      ) : (
                        'Enter the sales price and extra price to see the final price'
                      )}
                    </Text>
                  </div>
                )
              })}
              {typeof formState.errors.variants?.message === 'string' && (
                <Text size="xs" c="red">
                  {formState.errors.variants.message}
                </Text>
              )}
              <div>
                <Button
                  variant="default"
                  size="compact-sm"
                  leftSection={<IconPlus size={14} stroke={1.75} />}
                  onClick={() => variants.append({ attribute: '', value: '', extraPrice: 0 })}
                >
                  Add variant
                </Button>
              </div>
            </FormSection>
          </form>
        )}
      </FormDrawer>

      {product && (
        <ConfirmModal
          opened={confirmArchive}
          onClose={() => setConfirmArchive(false)}
          onConfirm={() => archive.mutate()}
          loading={archive.isPending}
          danger
          title={`Archive ${product.name}?`}
          confirmLabel="Archive product"
          error={archive.error && isApiError(archive.error) ? archive.error.message : null}
        >
          It disappears from the pickers for new plans and quotations.{' '}
          {product.usedInPlans
            ? `${pluralize(product.usedInPlans, 'active plan')} still sell it; existing subscriptions and invoices don't change.`
            : "Existing subscriptions and invoices don't change."}
        </ConfirmModal>
      )}
    </>
  )
}
