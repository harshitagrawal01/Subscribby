import { Alert, Button, Drawer, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Text, Textarea, TextInput, Title } from '@mantine/core'
import { getHotkeyHandler } from '@mantine/hooks'
import { IconAlertCircle } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { z } from 'zod'
import { StatusText } from '@/components/StatusBadge'
import { templatesApi } from '@/lib/api/endpoints'
import type { QuotationTemplate } from '@/lib/api/types'
import { formatMoney, pluralize } from '@/lib/format'
import { notifyDone, notifyError } from '@/lib/notify'
import { requiredText, trimmed } from '@/lib/validation'
import { tokens } from '@/theme'
import { PAYMENT_TERM_OPTIONS, paymentTermLabel } from './constants'
import { mapSubscriptionError, noErrors, type MappedErrors } from './errors'
import { LinesEditor } from './LinesEditor'
import { blockImplicitSubmit, emptyLine, ensurePlanLine, linesFromTemplate, toLineInputs, type LineDraft } from './lines'
import { planOptionLabel, usePlans, useProducts } from './queries'
import { issuesToErrors, linesSchema, mergeErrors } from './validate'

const schema = z.object({
  name: requiredText('Give the template a name').pipe(z.string().max(120, 'Keep it under 120 characters')),
  planId: z.string().min(1, 'Choose a plan'),
  validityDays: z.number({ error: 'Enter how many days' }).int('Whole days only').min(1, 'At least 1 day').max(365, 'At most 365 days'),
  paymentTermDays: z.string().min(1, 'Choose payment terms'),
  notes: trimmed().max(4000, 'Keep terms under 4,000 characters'),
  lines: linesSchema,
})

interface Props {
  /** null = closed, 'new' = create, otherwise the template to edit or view. */
  target: QuotationTemplate | 'new' | null
  canEdit: boolean
  onClose: () => void
}

/** Create, edit or (for finance and archived templates) read a quotation template. */
export function TemplateDrawer({ target, canEdit, onClose }: Props) {
  const tpl = target && target !== 'new' ? target : null
  const readOnly = !canEdit || (tpl ? !tpl.isActive : false)
  return (
    <Drawer
      opened={target !== null}
      onClose={onClose}
      position="right"
      size={680}
      title={
        <Title order={2} fz={18}>
          {target === 'new' ? 'New quotation template' : (tpl?.name ?? '')}
        </Title>
      }
      padding="lg"
    >
      {target !== null &&
        (readOnly && tpl ? (
          <TemplateView tpl={tpl} />
        ) : (
          <TemplateForm key={tpl?.id ?? 'new'} tpl={tpl} onClose={onClose} />
        ))}
    </Drawer>
  )
}

function TemplateView({ tpl }: { tpl: QuotationTemplate }) {
  const row = (label: string, value: string) => (
    <Group justify="space-between" py={9} style={{ borderBottom: `1px solid ${tokens.line}` }}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </Group>
  )
  return (
    <Stack gap="lg">
      <div>
        {row('Plan', tpl.plan?.name ?? '—')}
        {row('Quotation valid for', pluralize(tpl.validityDays, 'day'))}
        {row('Payment terms', paymentTermLabel(tpl.paymentTermDays))}
        {row('Used for', pluralize(tpl.usedCount ?? 0, 'subscription'))}
        <Group justify="space-between" py={9}>
          <Text size="sm" c="dimmed">
            Status
          </Text>
          <StatusText {...(tpl.isActive ? { label: 'Active', color: tokens.status.good } : { label: 'Archived', color: tokens.status.closed })} />
        </Group>
      </div>
      <div>
        <Text size="sm" fw={500} mb={6}>
          Lines
        </Text>
        {tpl.lines.map((l, i) => (
          <Group key={i} justify="space-between" py={8} style={{ borderTop: i ? `1px solid ${tokens.line}` : undefined }} wrap="nowrap">
            <div>
              <Text size="sm">{l.productName}</Text>
              {l.variantLabel && (
                <Text size="xs" c="dimmed">
                  {l.variantLabel}
                </Text>
              )}
            </div>
            <Text size="sm" className="num">
              {l.quantity} × {formatMoney(l.unitPrice)}
            </Text>
          </Group>
        ))}
      </div>
      {tpl.notes && (
        <div>
          <Text size="sm" fw={500} mb={4}>
            Terms
          </Text>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {tpl.notes}
          </Text>
        </div>
      )}
      {!tpl.isActive && (
        <Text size="xs" c="dimmed">
          Archived templates can't be edited or used for new quotations.
        </Text>
      )}
    </Stack>
  )
}

function TemplateForm({ tpl, onClose }: { tpl: QuotationTemplate | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const products = useProducts()
  const plans = usePlans()
  const [name, setName] = useState(tpl?.name ?? '')
  const [planId, setPlanId] = useState<string | null>(tpl?.plan?.id ?? tpl?.planId ?? null)
  const [validityDays, setValidityDays] = useState<number | ''>(tpl?.validityDays ?? 14)
  const [paymentTermDays, setPaymentTermDays] = useState(String(tpl?.paymentTermDays ?? 30))
  const [notes, setNotes] = useState(tpl?.notes ?? '')
  const [lines, setLines] = useState<LineDraft[]>(() => (tpl ? linesFromTemplate(tpl.lines) : [emptyLine()]))
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState<MappedErrors>(noErrors)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const touch = () => setServerErrors(noErrors)

  const plan = plans.data?.find((p) => p.id === planId)
  const values = {
    name,
    planId: planId ?? '',
    validityDays: validityDays === '' ? undefined : validityDays,
    paymentTermDays,
    notes,
    lines: lines.map((l) => ({ productId: l.productId ?? '', variantId: l.variantId, quantity: l.quantity === '' ? undefined : l.quantity, unitPrice: null })),
  }
  const errors = mergeErrors(serverErrors, submitted ? issuesToErrors(schema.safeParse(values).error) : noErrors)

  const done = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ['quotation-templates'] })
    notifyDone(message)
    onClose()
  }

  const save = useMutation({
    mutationFn: (body: Parameters<typeof templatesApi.create>[0]) => (tpl ? templatesApi.update(tpl.id, body) : templatesApi.create(body)),
    onSuccess: (saved) => done(tpl ? `${saved.name} saved` : `Template ${saved.name} created`),
    onError: (error) => {
      const { indexMap } = toLineInputs(lines, { withPrices: false })
      setServerErrors(mapSubscriptionError(error, { indexMap, lines, planProductId: plan?.product?.id }))
    },
  })

  const archive = useMutation({
    mutationFn: () => templatesApi.archive(tpl!.id),
    onSuccess: () => {
      setArchiveOpen(false)
      done(`${tpl!.name} archived. It no longer shows in the quote builder.`)
    },
    onError: (error) => {
      setArchiveOpen(false)
      notifyError(error, 'Template not archived. Try again.')
    },
  })

  const submit = () => {
    if (save.isPending) return
    setSubmitted(true)
    const parsed = schema.safeParse(values)
    if (!parsed.success) return
    const v = parsed.data
    save.mutate({
      name: v.name,
      planId: v.planId,
      validityDays: v.validityDays,
      paymentTermDays: Number(v.paymentTermDays),
      notes: v.notes,
      lines: toLineInputs(lines, { withPrices: false }).inputs.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
    })
  }

  const choosePlan = (id: string | null) => {
    touch()
    setPlanId(id)
    const next = plans.data?.find((p) => p.id === id)
    if (next) setLines((ls) => ensurePlanLine(ls, next.product?.id, next.minQuantity))
  }

  const planOptions = (plans.data ?? []).filter((p) => p.isActive || p.id === planId).map((p) => ({ value: p.id, label: planOptionLabel(p) }))

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
      <Stack gap="md">
        <TextInput
          label="Name"
          withAsterisk
          placeholder="Pro Yearly – Standard"
          value={name}
          onChange={(e) => {
            touch()
            setName(e.currentTarget.value)
          }}
          onBlur={() => setName((n) => n.trim())}
          error={errors.fields.name}
          data-autofocus
        />
        <Select
          label="Plan"
          withAsterisk
          placeholder="Choose a plan"
          data={planOptions}
          value={planId}
          onChange={choosePlan}
          error={errors.fields.planId}
          searchable
          selectFirstOptionOnChange
          allowDeselect={false}
          description={plan && plan.minQuantity > 1 ? `Needs at least ${plan.minQuantity} × ${plan.product?.name}` : undefined}
        />
        <SimpleGrid cols={2} spacing="md">
          <NumberInput
            label="Quotation valid for"
            description="Days after it is sent"
            suffix=" days"
            min={1}
            max={365}
            allowDecimal={false}
            allowNegative={false}
            value={validityDays}
            onChange={(v) => {
              touch()
              setValidityDays(v === '' ? '' : Number(v))
            }}
            error={errors.fields.validityDays}
          />
          <Select
            label="Payment terms"
            description="For invoices from these quotes"
            data={PAYMENT_TERM_OPTIONS}
            value={paymentTermDays}
            onChange={(v) => {
              if (!v) return
              touch()
              setPaymentTermDays(v)
            }}
            allowDeselect={false}
            error={errors.fields.paymentTermDays}
          />
        </SimpleGrid>

        <div>
          <Text size="sm" fw={500} mb={6}>
            Lines
          </Text>
          <LinesEditor
            lines={lines}
            onChange={(ls) => {
              touch()
              setLines(ls)
            }}
            products={products.data ?? []}
            errors={errors.lines}
            linesError={errors.linesError}
            planProductId={plan?.product?.id}
            minQuantity={plan?.minQuantity}
          />
        </div>

        <Textarea
          label="Terms"
          description="Printed on quotations made from this template"
          placeholder="Prices exclude GST. Billed yearly in advance."
          autosize
          minRows={3}
          maxRows={10}
          value={notes}
          onChange={(e) => {
            touch()
            setNotes(e.currentTarget.value)
          }}
          onBlur={() => setNotes((n) => n.trim())}
          error={errors.fields.notes}
        />

        {serverErrors.formError && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            {serverErrors.formError}
          </Alert>
        )}

        <Group justify="space-between" mt="sm">
          {tpl ? (
            <Button variant="subtle" color="red" onClick={() => setArchiveOpen(true)}>
              Archive template
            </Button>
          ) : (
            <span />
          )}
          <Group gap={8}>
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {tpl ? 'Save template' : 'Create template'}
            </Button>
          </Group>
        </Group>
      </Stack>

      {tpl && (
        <Modal opened={archiveOpen} onClose={() => setArchiveOpen(false)} title={`Archive ${tpl.name}?`}>
          <Text size="sm">
            It disappears from the quote builder.{' '}
            {tpl.usedCount
              ? `The ${pluralize(tpl.usedCount, 'subscription')} already made from it stay exactly as they are.`
              : 'No subscriptions use it yet.'}{' '}
            Archived templates can't be restored.
          </Text>
          <Group justify="flex-end" gap={8} mt="lg">
            <Button variant="default" onClick={() => setArchiveOpen(false)}>
              Keep it
            </Button>
            <Button color="red" loading={archive.isPending} onClick={() => archive.mutate()} data-autofocus>
              Archive template
            </Button>
          </Group>
        </Modal>
      )}
    </form>
  )
}
