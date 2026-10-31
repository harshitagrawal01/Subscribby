import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Input, Modal, MultiSelect, NumberInput, Radio, SegmentedControl, Stack, Switch, Table, Text, TextInput } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { MoneyInput } from '@/components/MoneyInput'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { StatusText } from '@/components/StatusBadge'
import classes from '@/features/catalog/catalog.module.css'
import { ConfirmModal, EmptyLine, FormAlert } from '@/features/catalog/components'
import { ALWAYS_CHECK, useEditParam, useProductOptions, useRole } from '@/features/catalog/hooks'
import { ACTIVE_STATUS, PRODUCT_TYPE_LABELS, PRODUCT_TYPES, taxAppliesText, taxRateText } from '@/features/catalog/labels'
import { placeServerErrors } from '@/features/catalog/server-errors'
import { isApiError } from '@/lib/api/client'
import { taxesApi } from '@/lib/api/endpoints'
import type { Tax } from '@/lib/api/types'
import { notifyDone, notifyError } from '@/lib/notify'
import { requiredText } from '@/lib/validation'

export function TaxesPage() {
  const { can } = useRole()
  const canEdit = can('admin')
  const modal = useEditParam()
  const products = useProductOptions()
  const list = useQuery({ queryKey: ['taxes', 'all'], queryFn: () => taxesApi.list({ limit: 100, sort: 'name' }) })
  const taxes = list.data?.data ?? []
  const editingTax = modal.editing && !modal.isNew ? taxes.find((t) => t.id === modal.editing) : undefined
  const activeCount = taxes.filter((t) => t.isActive).length

  return (
    <>
      <PageHeader
        title="Taxes"
        description="Added to every invoice line they match. Several matching taxes each apply to the same amount, never tax on tax."
        actions={
          canEdit && (
            <Button leftSection={<IconPlus size={16} stroke={1.75} />} onClick={modal.openNew}>
              New tax
            </Button>
          )
        }
      />

      <div className="panel">
        <QueryState isLoading={list.isLoading} error={list.error} onRetry={() => list.refetch()} rows={4} what="taxes" />
        {list.data &&
          (taxes.length ? (
            <>
              <Table.ScrollContainer minWidth={760}>
                <Table className="data-table">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th ta="right">Rate</Table.Th>
                      <Table.Th>Applies to</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {taxes.map((tax) => (
                      <Table.Tr
                        key={tax.id}
                        className={`${canEdit ? 'row-link' : ''} ${tax.isActive ? '' : classes.archivedRow}`}
                        onClick={canEdit ? () => modal.openEdit(tax.id) : undefined}
                      >
                        <Table.Td fw={500}>{tax.name}</Table.Td>
                        <Table.Td>{tax.type === 'percentage' ? 'Percentage' : 'Fixed amount'}</Table.Td>
                        <Table.Td ta="right" className="num">
                          {taxRateText(tax)}
                        </Table.Td>
                        <Table.Td>{taxAppliesText(tax, products.byId)}</Table.Td>
                        <Table.Td>
                          <StatusText {...(tax.isActive ? ACTIVE_STATUS.active : ACTIVE_STATUS.inactive)} />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
              <Text size="sm" c="dimmed" px={20} py={12} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
                {activeCount} of {taxes.length} active. Changes apply to invoices created from now on; existing invoices keep the rate they were made with.
              </Text>
            </>
          ) : (
            <EmptyLine
              action={
                canEdit && (
                  <Button size="compact-sm" variant="default" onClick={modal.openNew}>
                    Add a tax
                  </Button>
                )
              }
            >
              No taxes yet, so invoices are issued without tax.
            </EmptyLine>
          ))}
      </div>

      <Modal
        opened={canEdit && (modal.isNew || Boolean(editingTax))}
        onClose={modal.close}
        title={<span className={classes.sheetTitle}>{editingTax ? `Edit ${editingTax.name}` : 'New tax'}</span>}
        size={540}
        classNames={{ content: classes.whiteSurface, header: classes.whiteSurface }}
      >
        {(modal.isNew || editingTax) && <TaxForm key={editingTax?.id ?? 'new'} tax={editingTax} onDone={modal.close} />}
      </Modal>
    </>
  )
}

const schema = z
  .object({
    name: requiredText('Enter a name, like GST 18%').max(80, 'Keep it under 80 characters'),
    type: z.enum(['percentage', 'fixed']),
    rate: z.number({ error: 'Enter the rate' }).nullable(),
    kind: z.enum(['all', 'productTypes', 'products']),
    productTypes: z.array(z.enum(PRODUCT_TYPES)),
    productIds: z.array(z.string()),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.rate == null) ctx.addIssue({ code: 'custom', path: ['rate'], message: 'Enter the rate' })
    else if (v.type === 'percentage' && (v.rate < 0 || v.rate > 100))
      ctx.addIssue({ code: 'custom', path: ['rate'], message: 'Use a percentage from 0 to 100' })
    else if (v.type === 'fixed' && (!Number.isInteger(v.rate) || v.rate < 0))
      ctx.addIssue({ code: 'custom', path: ['rate'], message: 'Enter an amount of ₹0 or more' })
    if (v.kind === 'productTypes' && !(v.productTypes ?? []).length)
      ctx.addIssue({ code: 'custom', path: ['productTypes'], message: 'Pick at least one product type' })
    if (v.kind === 'products' && !(v.productIds ?? []).length)
      ctx.addIssue({ code: 'custom', path: ['productIds'], message: 'Pick at least one product' })
  }, ALWAYS_CHECK)
type Values = z.input<typeof schema>
type Output = z.output<typeof schema>

function TaxForm({ tax, onDone }: { tax: Tax | undefined; onDone: () => void }) {
  const queryClient = useQueryClient()
  const products = useProductOptions()
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const { register, control, handleSubmit, setError, setValue, formState } = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: tax?.name ?? '',
      type: tax?.type ?? 'percentage',
      rate: tax?.rate ?? null,
      kind: tax?.appliesTo.kind ?? 'all',
      productTypes: tax?.appliesTo.productTypes ?? [],
      productIds: tax?.appliesTo.productIds ?? [],
      isActive: tax?.isActive ?? true,
    },
  })
  const type = useWatch({ control, name: 'type' })
  const kind = useWatch({ control, name: 'kind' })

  const save = useMutation({
    mutationFn: (v: Output) => {
      const body = {
        name: v.name,
        type: v.type,
        rate: v.rate ?? 0,
        appliesTo: {
          kind: v.kind,
          productTypes: v.kind === 'productTypes' ? v.productTypes : [],
          productIds: v.kind === 'products' ? v.productIds : [],
        },
        isActive: v.isActive,
      }
      return tax ? taxesApi.update(tax.id, body) : taxesApi.create(body)
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] })
      notifyDone(tax ? `Saved ${saved.name}` : `Added ${saved.name}`)
      onDone()
    },
    onError: (error) =>
      setFormError(
        placeServerErrors(error, setError, ['name', 'type', 'rate', 'kind', 'productTypes', 'productIds', 'isActive'], {
          'appliesTo.kind': 'kind',
          'appliesTo.productTypes': 'productTypes',
          'appliesTo.productIds': 'productIds',
          appliesTo: 'kind',
        }),
      ),
  })

  const archive = useMutation({
    mutationFn: () => taxesApi.archive(tax!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] })
      notifyDone(`Archived ${tax!.name}. New invoices won't include it.`)
      setConfirmArchive(false)
      onDone()
    },
    onError: (error) => notifyError(error, "Couldn't archive the tax. Try again."),
  })

  return (
    <>
      <form
        noValidate
        onSubmit={handleSubmit((v) => {
          setFormError(null)
          save.mutate(v)
        })}
      >
        <Stack gap="md">
          <FormAlert message={formError} mb={0} />
          <TextInput label="Name" description="Shown on invoice lines" {...register('name')} error={formState.errors.name?.message} data-autofocus />

          <Group align="flex-start" gap="md" grow>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Input.Wrapper label="Type" id="tax-type-label">
                  <SegmentedControl
                    aria-labelledby="tax-type-label-label"
                    fullWidth
                    data={[
                      { value: 'percentage', label: 'Percentage' },
                      { value: 'fixed', label: 'Fixed per unit' },
                    ]}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v)
                      setValue('rate', null)
                    }}
                  />
                </Input.Wrapper>
              )}
            />
            <Controller
              control={control}
              name="rate"
              render={({ field, fieldState }) =>
                type === 'percentage' ? (
                  <NumberInput
                    label="Rate"
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
                    label="Amount per unit"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )
              }
            />
          </Group>
          <Text size="xs" c="dimmed" mt={-8}>
            {type === 'percentage'
              ? 'Charged on each line after discounts.'
              : 'Charged once per unit on each matching line, whatever the price.'}
          </Text>

          <Controller
            control={control}
            name="kind"
            render={({ field, fieldState }) => (
              <Radio.Group label="Applies to" value={field.value} onChange={field.onChange} error={fieldState.error?.message}>
                <Stack gap={10} mt={8}>
                  <Radio value="all" label="All products" />
                  <Radio value="productTypes" label="Product types" />
                  {kind === 'productTypes' && (
                    <Controller
                      control={control}
                      name="productTypes"
                      render={({ field: f, fieldState: fs }) => (
                        <MultiSelect
                          aria-label="Product types"
                          ml={30}
                          placeholder={f.value.length ? undefined : 'Pick types'}
                          data={PRODUCT_TYPES.map((t) => ({ value: t, label: PRODUCT_TYPE_LABELS[t] }))}
                          value={f.value}
                          onChange={f.onChange}
                          error={fs.error?.message}
                        />
                      )}
                    />
                  )}
                  <Radio value="products" label="Specific products" />
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
                </Stack>
              </Radio.Group>
            )}
          />

          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <Switch
                label="Active"
                description="Inactive taxes are skipped on new invoices."
                checked={field.value}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
              />
            )}
          />

          <Group gap={8} mt="xs">
            <Button type="submit" loading={save.isPending}>
              {tax ? 'Save tax' : 'Add tax'}
            </Button>
            <Button variant="default" onClick={onDone}>
              Cancel
            </Button>
            {tax?.isActive && (
              <Button variant="subtle" color="red" ml="auto" onClick={() => setConfirmArchive(true)}>
                Archive
              </Button>
            )}
          </Group>
        </Stack>
      </form>

      {tax && (
        <ConfirmModal
          opened={confirmArchive}
          onClose={() => setConfirmArchive(false)}
          onConfirm={() => archive.mutate()}
          loading={archive.isPending}
          danger
          title={`Archive ${tax.name}?`}
          confirmLabel="Archive tax"
          error={archive.error && isApiError(archive.error) ? archive.error.message : null}
        >
          New invoices stop including it. Invoices already created keep the tax they were issued with.
        </ConfirmModal>
      )}
    </>
  )
}
