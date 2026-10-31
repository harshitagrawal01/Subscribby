import { Alert, Box, Button, Group, Select, SimpleGrid, Stack, Text, Textarea } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { getHotkeyHandler } from '@mantine/hooks'
import { IconAlertCircle } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { z } from 'zod'
import { isApiError } from '@/lib/api/client'
import { subscriptionsApi } from '@/lib/api/endpoints'
import type { PricedLine, Ref, Subscription, SubscriptionInput } from '@/lib/api/types'
import { notifyDone } from '@/lib/notify'
import { trimmed } from '@/lib/validation'
import { EDITABLE_FIELDS, PAYMENT_TERM_OPTIONS, PERIOD_NOUN, type EditableField } from './constants'
import { CustomerSelect } from './CustomerSelect'
import { mapSubscriptionError, noErrors, type MappedErrors } from './errors'
import { LinesEditor } from './LinesEditor'
import { blockImplicitSubmit, ensurePlanLine, linesFromSubscription, toLineInputs, type LineDraft } from './lines'
import { TotalsBlock } from './PricedLines'
import { planOptionLabel, useLivePreview, usePlans, useProducts, useSalespeople } from './queries'
import { Section } from './Section'
import { issuesToErrors, linesSchema, mergeErrors } from './validate'

type Body = Omit<Partial<SubscriptionInput>, 'salespersonId'> & { salespersonId?: string | null }

const editSchema = z
  .object({
    startDate: z.string().min(1, 'Pick a start date'),
    expiryDate: z.string().min(1, 'Pick an expiry date'),
    notes: trimmed().max(4000, 'Keep notes under 4,000 characters'),
    lines: linesSchema,
  })
  .refine((v) => v.expiryDate >= v.startDate, { path: ['expiryDate'], message: 'Must be on or after the start date' })

const LOCK_NOTE: Record<string, string> = {
  confirmed: 'Locked once confirmed',
  active: 'Locked while active',
  paused: 'Locked while paused',
}

/**
 * Edit what the current status allows (spec "What can be edited"), with the same live pricing
 * as the quote builder. Locked fields stay visible but disabled, with the reason.
 */
export function EditSubscription({ sub, onDone }: { sub: Subscription; onDone: () => void }) {
  const queryClient = useQueryClient()
  const products = useProducts()
  const plans = usePlans()
  const salespeople = useSalespeople(sub.salesperson ?? null)
  const can = (f: EditableField) => EDITABLE_FIELDS[sub.status].includes(f)
  const lock = (f: EditableField) => (can(f) ? undefined : LOCK_NOTE[sub.status])

  const [customer, setCustomer] = useState<Ref | null>({ id: sub.customer.id, name: sub.customer.name })
  const [planId, setPlanId] = useState<string>(sub.plan.id)
  const [startDate, setStartDate] = useState<string | null>(sub.startDate)
  const [expiryDate, setExpiryDate] = useState<string | null>(sub.expiryDate)
  const [paymentTermDays, setPaymentTermDays] = useState(String(sub.paymentTermDays))
  const [salespersonId, setSalespersonId] = useState<string | null>(sub.salesperson?.id ?? null)
  const [notes, setNotes] = useState(sub.notes ?? '')
  const [lines, setLines] = useState<LineDraft[]>(() => linesFromSubscription(sub.lines))
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState<MappedErrors>(noErrors)
  const touch = () => setServerErrors(noErrors)

  const plan = plans.data?.find((p) => p.id === planId)
  const planProductId = plan?.product?.id
  const minQuantity = plan?.minQuantity ?? sub.plan.minQuantity

  // Existing lines keep their stored price unless someone overrides it, so preview with that price.
  const stored = useMemo(() => new Map(sub.lines.map((l) => [l.id, l])), [sub.lines])
  const { inputs, indexMap } = useMemo(() => toLineInputs(lines, { withPrices: true }), [lines])
  const previewInputs = useMemo(
    () =>
      inputs.map((l) => {
        const prev = l.id ? stored.get(l.id) : undefined
        const same = prev && prev.productId === l.productId && (prev.variantId ?? null) === l.variantId
        const price = l.unitPrice ?? (same ? prev.unitPrice : undefined)
        const { id: _id, ...rest } = l
        return price === undefined ? rest : { ...rest, unitPrice: price }
      }),
    [inputs, stored],
  )
  const previewBody = useMemo(
    (): Body | null =>
      inputs.length
        ? {
            customerId: customer?.id ?? sub.customer.id,
            planId,
            startDate: startDate ?? sub.startDate,
            expiryDate: expiryDate ?? undefined,
            paymentTermDays: Number(paymentTermDays),
            lines: previewInputs,
          }
        : null,
    [inputs.length, customer, planId, startDate, expiryDate, paymentTermDays, previewInputs, sub.customer.id, sub.startDate],
  )
  const preview = useLivePreview(previewBody as SubscriptionInput | null, indexMap)
  // A running subscription on a plan no longer sold can't be previewed; the save still works.
  const previewUnavailable = isApiError(preview.error) && preview.error.code === 'PLAN_NOT_AVAILABLE' && !can('planId') && !can('startDate')

  const pricedByRow = useMemo(() => {
    const out: Record<number, PricedLine> = {}
    const data = preview.data
    data?.lines.forEach((l, k) => {
      const row = data.indexMap[k]
      if (row !== undefined) out[row] = l
    })
    return out
  }, [preview.data])

  const previewErrors = useMemo(
    () =>
      preview.error && !previewUnavailable
        ? mapSubscriptionError(preview.error, { indexMap: preview.errorIndexMap, lines, planProductId })
        : noErrors,
    [preview.error, preview.errorIndexMap, previewUnavailable, lines, planProductId],
  )

  const formValues = {
    startDate: startDate ?? '',
    expiryDate: expiryDate ?? '',
    notes,
    lines: lines.map((l) => ({ productId: l.productId ?? '', variantId: l.variantId, quantity: l.quantity === '' ? undefined : l.quantity, unitPrice: l.unitPrice })),
  }
  const clientErrors = submitted ? issuesToErrors(editSchema.safeParse(formValues).error) : noErrors
  if (submitted && !customer && can('customerId')) clientErrors.fields.customerId = 'Choose a customer'
  const errors = mergeErrors(previewErrors, serverErrors, clientErrors)

  const save = useMutation({
    mutationFn: (body: Body) => subscriptionsApi.update(sub.id, body as Partial<SubscriptionInput>),
    onSuccess: (updated) => {
      queryClient.setQueryData(['subscription', sub.id], updated)
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      const applies = ['active', 'paused'].includes(sub.status) ? ' Line changes apply from the next invoice.' : ''
      notifyDone(`${sub.number} saved.${applies}`)
      onDone()
    },
    onError: (error) => setServerErrors(mapSubscriptionError(error, { indexMap, lines, planProductId })),
  })

  const submit = () => {
    if (save.isPending) return
    setSubmitted(true)
    const parsed = editSchema.safeParse(formValues)
    if (!parsed.success || (can('customerId') && !customer)) return
    const body: Body = {}
    if (can('customerId') && customer) body.customerId = customer.id
    if (can('planId')) body.planId = planId
    if (can('startDate')) body.startDate = parsed.data.startDate
    if (can('expiryDate')) body.expiryDate = parsed.data.expiryDate
    if (can('paymentTermDays')) body.paymentTermDays = Number(paymentTermDays)
    if (can('salespersonId')) body.salespersonId = salespersonId
    if (can('notes')) body.notes = parsed.data.notes
    if (can('lines')) body.lines = toLineInputs(lines, { withPrices: can('unitPrice') }).inputs
    save.mutate(body)
  }

  const choosePlan = (id: string | null) => {
    if (!id) return
    touch()
    setPlanId(id)
    const next = plans.data?.find((p) => p.id === id)
    if (next) setLines((ls) => ensurePlanLine(ls, next.product?.id, next.minQuantity))
  }

  const planOptions = (plans.data ?? [])
    .filter((p) => p.isActive || p.id === sub.plan.id)
    .map((p) => ({ value: p.id, label: planOptionLabel(p) }))
  if (!planOptions.some((o) => o.value === sub.plan.id)) planOptions.unshift({ value: sub.plan.id, label: sub.plan.name })

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      onKeyDown={(e) => {
        blockImplicitSubmit(e)
        getHotkeyHandler([['mod+Enter', submit]])(e)
      }}
    >
      <Stack gap={16}>
        <Section title="Details" id="edit-details">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <CustomerSelect
              label="Customer"
              value={customer}
              onChange={(c) => {
                touch()
                setCustomer(c)
              }}
              disabled={!can('customerId')}
              description={lock('customerId')}
              error={errors.fields.customerId}
            />
            <Select
              label="Plan"
              data={planOptions}
              value={planId}
              onChange={choosePlan}
              disabled={!can('planId')}
              description={lock('planId')}
              error={errors.fields.planId}
              searchable
          selectFirstOptionOnChange
              allowDeselect={false}
            />
            <DateInput
              label="Start date"
              valueFormat="DD MMM YYYY"
              value={startDate}
              onChange={(d) => {
                touch()
                setStartDate(d)
              }}
              disabled={!can('startDate')}
              description={lock('startDate')}
              error={errors.fields.startDate}
            />
            <DateInput
              label="Expiry date"
              valueFormat="DD MMM YYYY"
              value={expiryDate}
              minDate={startDate ?? undefined}
              onChange={(d) => {
                touch()
                setExpiryDate(d)
              }}
              disabled={!can('expiryDate')}
              description={lock('expiryDate')}
              error={errors.fields.expiryDate}
            />
            <Select
              label="Payment terms"
              data={PAYMENT_TERM_OPTIONS}
              value={paymentTermDays}
              onChange={(v) => {
                if (!v) return
                touch()
                setPaymentTermDays(v)
              }}
              disabled={!can('paymentTermDays')}
              description={lock('paymentTermDays')}
              error={errors.fields.paymentTermDays}
              allowDeselect={false}
            />
            <Select
              label="Salesperson"
              placeholder="Nobody"
              data={salespeople}
              value={salespersonId}
              onChange={(v) => {
                touch()
                setSalespersonId(v)
              }}
              clearable
              error={errors.fields.salespersonId}
            />
          </SimpleGrid>
          <Textarea
            mt="md"
            label="Notes"
            autosize
            minRows={2}
            maxRows={8}
            value={notes}
            onChange={(e) => {
              touch()
              setNotes(e.currentTarget.value)
            }}
            onBlur={() => setNotes((n) => n.trim())}
            error={errors.fields.notes}
          />
        </Section>

        <Section
          title="Lines"
          id="edit-lines"
          aside={
            <Text size="xs" c="dimmed">
              {can('unitPrice')
                ? 'Leave unit price empty to keep the current price'
                : ['active', 'paused'].includes(sub.status)
                  ? 'Changes apply from the next invoice. Prices are locked.'
                  : 'Prices are locked once confirmed'}
            </Text>
          }
        >
          <LinesEditor
            lines={lines}
            onChange={(ls) => {
              touch()
              setLines(ls)
            }}
            products={products.data ?? []}
            priced={pricedByRow}
            errors={errors.lines}
            linesError={errors.linesError}
            showPrice
            priceEditable={can('unitPrice')}
            showAmount
            planProductId={planProductId}
            minQuantity={minQuantity}
            updating={preview.updating || preview.stale}
            disabled={!can('lines')}
          />

          <Box mt={20} ml="auto" maw={360}>
            {preview.data && !previewUnavailable ? (
              <TotalsBlock totals={preview.data.totals} lines={preview.data.lines} orderDiscount={preview.data.orderDiscount} dimmed={preview.updating || preview.stale} totalLabel={`Total per ${PERIOD_NOUN[sub.plan.billingPeriod]}`} />
            ) : (
              <Text size="sm" c="dimmed" ta="right">
                {previewUnavailable ? 'Totals update after you save.' : 'Add a line to see totals.'}
              </Text>
            )}
          </Box>
        </Section>

        {(errors.formError || previewErrors.formError) && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            {errors.formError ?? previewErrors.formError}
          </Alert>
        )}

        <Group justify="flex-end" gap={8}>
          <Button variant="default" onClick={onDone}>
            Discard changes
          </Button>
          <Button type="submit" loading={save.isPending}>
            Save changes
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
