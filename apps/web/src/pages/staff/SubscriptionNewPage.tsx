import { Alert, Button, Group, Select, SimpleGrid, Stack, Text, Textarea } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { getHotkeyHandler } from '@mantine/hooks'
import { IconAlertCircle } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { staffPath } from '@/features/auth/staff-base'
import { useAuth } from '@/features/auth/useAuth'
import { PAYMENT_TERM_OPTIONS } from '@/features/subscriptions/constants'
import { CustomerSelect } from '@/features/subscriptions/CustomerSelect'
import { mapSubscriptionError, noErrors, type MappedErrors } from '@/features/subscriptions/errors'
import classes from '@/features/subscriptions/Layout.module.css'
import { LinesEditor } from '@/features/subscriptions/LinesEditor'
import { blockImplicitSubmit, emptyLine, ensurePlanLine, linesFromTemplate, toLineInputs, type LineDraft } from '@/features/subscriptions/lines'
import { planOptionLabel, useActiveTemplates, useLivePreview, usePlans, useProducts, useSalespeople } from '@/features/subscriptions/queries'
import { QuoteSummary } from '@/features/subscriptions/QuoteSummary'
import { BackLink, Section } from '@/features/subscriptions/Section'
import { issuesToErrors, mergeErrors, quoteSchema } from '@/features/subscriptions/validate'
import { customersApi, subscriptionsApi } from '@/lib/api/endpoints'
import type { PricedLine, Ref, SubscriptionInput } from '@/lib/api/types'
import { formatDate, today } from '@/lib/format'
import { notifyDone } from '@/lib/notify'

interface Values {
  customer: Ref | null
  templateId: string | null
  planId: string | null
  startDate: string | null
  expiryDate: string | null
  /** Once someone sets the expiry by hand, changing the start date stops moving it. */
  expiryTouched: boolean
  paymentTermDays: string
  salespersonId: string | null
  notes: string
  lines: LineDraft[]
}

const defaultExpiry = (start: string) => dayjs(start).add(1, 'year').subtract(1, 'day').format('YYYY-MM-DD')
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

/** The API accepts salespersonId: null ("nobody"); types.ts only allows a string. */
type SubscriptionBody = Omit<SubscriptionInput, 'salespersonId'> & { salespersonId?: string | null }

/** "Turning a quote into a subscription": the quote builder, priced live by the API. */
export function SubscriptionNewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const presetCustomerId = params.get('customerId')

  const products = useProducts()
  const plans = usePlans()
  const templates = useActiveTemplates()
  const salespeople = useSalespeople()

  const [values, setValues] = useState<Values>(() => {
    const start = today()
    return {
      customer: null,
      templateId: null,
      planId: null,
      startDate: start,
      expiryDate: defaultExpiry(start),
      expiryTouched: false,
      paymentTermDays: '30',
      salespersonId: user?.id ?? null,
      notes: '',
      lines: [emptyLine()],
    }
  })
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState<MappedErrors>(noErrors)

  // Coming from a customer page (?customerId=…): start with that customer chosen.
  const preset = useQuery({
    queryKey: ['customers', presetCustomerId],
    queryFn: () => customersApi.get(presetCustomerId!),
    enabled: Boolean(presetCustomerId),
  })
  const [presetApplied, setPresetApplied] = useState(false)
  if (preset.data && !presetApplied) {
    setPresetApplied(true)
    setValues((v) => ({ ...v, customer: { id: preset.data.id, name: preset.data.name } }))
  }

  const set = (patch: Partial<Values>) => {
    setServerErrors(noErrors)
    setValues((v) => ({ ...v, ...patch }))
  }

  const plan = plans.data?.find((p) => p.id === values.planId)
  const template = templates.data?.find((t) => t.id === values.templateId)
  const planProductId = plan?.product?.id

  // ----- live pricing -----
  const { inputs, indexMap } = useMemo(() => toLineInputs(values.lines, { withPrices: true }), [values.lines])
  const body = useMemo((): SubscriptionBody | null => {
    if (!values.planId || !inputs.length) return null
    return {
      customerId: values.customer?.id as string,
      templateId: values.templateId ?? undefined,
      planId: values.planId,
      startDate: values.startDate ?? today(),
      expiryDate: values.expiryDate ?? undefined,
      paymentTermDays: Number(values.paymentTermDays),
      salespersonId: values.salespersonId,
      lines: inputs,
    }
  }, [values.customer, values.templateId, values.planId, values.startDate, values.expiryDate, values.paymentTermDays, values.salespersonId, inputs])
  const preview = useLivePreview(body as SubscriptionInput | null, indexMap)

  const pricedByRow = useMemo(() => {
    const out: Record<number, PricedLine> = {}
    const data = preview.data
    data?.lines.forEach((l, k) => {
      const row = data.indexMap[k]
      if (row !== undefined) out[row] = l
    })
    return out
  }, [preview.data])

  // ----- errors: live from the preview, client checks after the first save attempt, then the save itself -----
  const previewErrors = (() => {
    if (!preview.error) return noErrors
    const mapped = mapSubscriptionError(preview.error, { indexMap: preview.errorIndexMap, lines: values.lines, planProductId })
    const { customerId: _pricingNeedsNoCustomer, ...fields } = mapped.fields
    return { ...mapped, fields }
  })()

  const formValues = {
    customerId: values.customer?.id ?? '',
    planId: values.planId ?? '',
    startDate: values.startDate ?? '',
    expiryDate: values.expiryDate ?? '',
    paymentTermDays: values.paymentTermDays,
    salespersonId: values.salespersonId,
    notes: values.notes,
    lines: values.lines.map((l) => ({
      productId: l.productId ?? '',
      variantId: l.variantId,
      quantity: l.quantity === '' ? undefined : l.quantity,
      unitPrice: l.unitPrice,
    })),
  }
  const clientErrors = submitted ? issuesToErrors(quoteSchema.safeParse(formValues).error) : noErrors
  const errors = mergeErrors(previewErrors, serverErrors, clientErrors)

  const create = useMutation({
    mutationFn: (input: SubscriptionBody) => subscriptionsApi.create(input as SubscriptionInput),
    onSuccess: (sub) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['quotation-templates'] })
      queryClient.setQueryData(['subscription', sub.id], sub)
      notifyDone(`Draft ${sub.number} saved for ${sub.customer.name}`)
      navigate(staffPath(`/subscriptions/${sub.id}`))
    },
    onError: (error) => setServerErrors(mapSubscriptionError(error, { indexMap, lines: values.lines, planProductId })),
  })

  const save = () => {
    if (create.isPending) return
    setSubmitted(true)
    const parsed = quoteSchema.safeParse(formValues)
    if (!parsed.success) return
    const v = parsed.data
    create.mutate({
      customerId: v.customerId,
      templateId: values.templateId ?? undefined,
      planId: v.planId,
      startDate: v.startDate,
      expiryDate: v.expiryDate,
      paymentTermDays: Number(v.paymentTermDays),
      salespersonId: v.salespersonId,
      notes: v.notes,
      lines: inputs,
    })
  }

  // ----- choosing a template or a plan -----
  const chooseTemplate = (id: string | null) => {
    const tpl = templates.data?.find((t) => t.id === id)
    if (!tpl) return set({ templateId: null })
    set({
      templateId: tpl.id,
      planId: tpl.plan?.id ?? tpl.planId,
      lines: linesFromTemplate(tpl.lines),
      paymentTermDays: String(tpl.paymentTermDays),
    })
  }
  const choosePlan = (id: string | null) => {
    const next = plans.data?.find((p) => p.id === id)
    const keepTemplate = template && (template.plan?.id ?? template.planId) === id
    set({
      planId: id,
      templateId: keepTemplate ? values.templateId : null,
      lines: next ? ensurePlanLine(values.lines, next.product?.id, next.minQuantity) : values.lines,
    })
  }
  const changeStart = (date: string | null) =>
    set({ startDate: date, expiryDate: !values.expiryTouched && date ? defaultExpiry(date) : values.expiryDate })

  const loadingCatalog = products.isLoading || plans.isLoading || templates.isLoading
  const catalogError = products.error || plans.error || templates.error
  const planOptions = (plans.data ?? []).filter((p) => p.isActive).map((p) => ({ value: p.id, label: planOptionLabel(p) }))
  const templateOptions = (templates.data ?? []).map((t) => ({ value: t.id, label: t.name }))
  const previewPlaced =
    Object.keys(previewErrors.fields).length > 0 || Object.keys(previewErrors.lines).length > 0 || Boolean(previewErrors.linesError)
  const summaryProblem =
    previewErrors.formError ??
    (preview.error ? (previewPlaced ? 'Prices update again once the highlighted fields are fixed.' : 'Prices could not be updated. Check the lines.') : null)

  return (
    <>
      <BackLink to={staffPath('/subscriptions')}>Subscriptions</BackLink>
      <PageHeader title="New quotation" description="Prices update as you build. Nothing reaches the customer until you send it." />

      {loadingCatalog || catalogError ? (
        <div className="panel">
          <QueryState
            isLoading={loadingCatalog}
            error={catalogError}
            onRetry={() => {
              products.refetch()
              plans.refetch()
              templates.refetch()
            }}
            what="the catalog"
          />
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
          onKeyDown={(e) => {
            blockImplicitSubmit(e)
            getHotkeyHandler([['mod+Enter', save]])(e)
          }}
        >
          <div className={classes.layout}>
            <div className={classes.main}>
              <Section title="Customer and plan" id="sec-customer">
                <Stack gap="md">
                  <CustomerSelect
                    label="Customer"
                    withAsterisk
                    value={values.customer}
                    onChange={(customer) => set({ customer })}
                    error={errors.fields.customerId}
                  />
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Select
                      label="Quotation template"
                      placeholder={templateOptions.length ? 'Start from a template' : 'No templates yet'}
                      description="Fills the plan, lines and payment terms"
                      data={templateOptions}
                      value={values.templateId}
                      onChange={chooseTemplate}
                      clearable
                      searchable
          selectFirstOptionOnChange
                    />
                    <Select
                      label="Plan"
                      withAsterisk
                      placeholder="Choose a plan"
                      description={
                        plan
                          ? `${plan.minQuantity > 1 ? `At least ${plan.minQuantity} seats · ` : ''}Sold ${
                              plan.availableUntil
                                ? `${formatDate(plan.availableFrom)} to ${formatDate(plan.availableUntil)}`
                                : `from ${formatDate(plan.availableFrom)}`
                            }`
                          : 'Or build the quote from a plan'
                      }
                      data={planOptions}
                      value={values.planId}
                      onChange={choosePlan}
                      error={errors.fields.planId}
                      searchable
          selectFirstOptionOnChange
                      allowDeselect={false}
                    />
                  </SimpleGrid>
                </Stack>
              </Section>

              <Section
                title="Lines"
                id="sec-lines"
                aside={
                  <Text size="xs" c="dimmed">
                    Leave unit price empty for the catalog price
                  </Text>
                }
              >
                <LinesEditor
                  lines={values.lines}
                  onChange={(lines) => set({ lines })}
                  products={products.data ?? []}
                  priced={pricedByRow}
                  errors={errors.lines}
                  linesError={errors.linesError}
                  showPrice
                  showAmount
                  planProductId={planProductId}
                  minQuantity={plan?.minQuantity}
                  updating={preview.updating || preview.stale}
                />
              </Section>

              <Section title="Terms" id="sec-terms">
                <Stack gap="md">
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <DateInput
                      label="Start date"
                      withAsterisk
                      valueFormat="DD MMM YYYY"
                      value={values.startDate}
                      onChange={changeStart}
                      error={errors.fields.startDate}
                      description="The first billing period starts here"
                    />
                    <DateInput
                      label="Expiry date"
                      withAsterisk
                      valueFormat="DD MMM YYYY"
                      value={values.expiryDate}
                      minDate={values.startDate ?? undefined}
                      onChange={(d) => set({ expiryDate: d, expiryTouched: true })}
                      error={errors.fields.expiryDate}
                      description={values.expiryTouched ? 'Set by hand' : 'One year from the start date'}
                    />
                    <Select
                      label="Payment terms"
                      data={PAYMENT_TERM_OPTIONS}
                      value={values.paymentTermDays}
                      onChange={(v) => v && set({ paymentTermDays: v })}
                      allowDeselect={false}
                      error={errors.fields.paymentTermDays}
                      description="Time the customer has to pay each invoice"
                    />
                    <Select
                      label="Salesperson"
                      placeholder="Nobody"
                      data={salespeople}
                      value={values.salespersonId}
                      onChange={(v) => set({ salespersonId: v })}
                      clearable
                      error={errors.fields.salespersonId}
                      description={user?.role === 'admin' ? 'Who owns this deal' : 'You, unless you clear it'}
                    />
                  </SimpleGrid>
                  <Textarea
                    label="Notes"
                    placeholder="Anything the team should know about this deal"
                    autosize
                    minRows={2}
                    maxRows={8}
                    value={values.notes}
                    onChange={(e) => set({ notes: e.currentTarget.value })}
                    onBlur={() => values.notes !== values.notes.trim() && set({ notes: values.notes.trim() })}
                    error={errors.fields.notes}
                    description={template?.notes ? `Template terms: ${template.notes}` : undefined}
                  />
                </Stack>
              </Section>
            </div>

            <aside className={classes.aside}>
              <QuoteSummary
                customerName={values.customer?.name}
                plan={plan ?? null}
                templateName={template?.name}
                startDate={values.startDate}
                expiryDate={values.expiryDate}
                preview={preview.data}
                updating={preview.updating}
                stale={preview.stale}
                problem={summaryProblem}
              >
                {serverErrors.formError && (
                  <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} mb="sm">
                    {serverErrors.formError}
                  </Alert>
                )}
                <Stack gap={8}>
                  <Button type="submit" fullWidth loading={create.isPending}>
                    Save as draft
                  </Button>
                  <Button variant="subtle" color="gray" fullWidth onClick={() => navigate(staffPath('/subscriptions'))}>
                    Discard
                  </Button>
                </Stack>
                <Group justify="center" mt={10} gap={4}>
                  <Text size="xs" c="dimmed">
                    Save with
                  </Text>
                  <span className={classes.kbd}>{isMac ? '⌘' : 'Ctrl'}</span>
                  <span className={classes.kbd}>Enter</span>
                </Group>
              </QuoteSummary>
            </aside>
          </div>
        </form>
      )}
    </>
  )
}
