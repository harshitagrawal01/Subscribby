import { ActionIcon, Button, Group, NumberInput, Select, Text, Tooltip } from '@mantine/core'
import { IconPlus, IconX } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { MoneyInput } from '@/components/MoneyInput'
import type { PricedLine, Product } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'
import { tokens } from '@/theme'
import type { LineFieldErrors } from './errors'
import { emptyLine, type LineDraft } from './lines'
import classes from './LinesEditor.module.css'

interface Props {
  lines: LineDraft[]
  onChange: (lines: LineDraft[]) => void
  products: Product[]
  /** Priced line from the API for each editor row (by row index). */
  priced?: Record<number, PricedLine>
  errors?: Record<number, LineFieldErrors>
  linesError?: string | null
  /** Show the unit price column. */
  showPrice?: boolean
  /** Staff may override the price (Draft and Quotation only). */
  priceEditable?: boolean
  /** Show the amount column (needs `priced`). */
  showAmount?: boolean
  planProductId?: string
  minQuantity?: number
  disabled?: boolean
  /** Dim amounts while a fresh price is on its way. */
  updating?: boolean
}

const variantLabel = (v: { attribute: string; value: string }) => `${v.attribute}: ${v.value}`

/**
 * Product, variant, quantity and (optionally) a price override per line.
 * Shared by the quote builder, the subscription edit form and quotation templates.
 * Amounts come from the API's priced lines; nothing is priced here.
 */
export function LinesEditor({
  lines,
  onChange,
  products,
  priced,
  errors = {},
  linesError,
  showPrice = false,
  priceEditable = true,
  showAmount = false,
  planProductId,
  minQuantity,
  disabled,
  updating,
}: Props) {
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  // Active products, plus any archived one that is already on a line (so it still shows its name).
  const productOptions = useMemo(() => {
    const used = new Set(lines.map((l) => l.productId).filter(Boolean))
    return products
      .filter((p) => p.isActive || used.has(p.id))
      .map((p) => ({ value: p.id, label: p.isActive ? p.name : `${p.name} (archived)`, disabled: !p.isActive }))
  }, [products, lines])

  const planLineCount = lines.filter((l) => l.productId && l.productId === planProductId).length
  const columns = [
    'minmax(0, 1.5fr)',
    'minmax(0, 1.4fr)',
    '88px',
    ...(showPrice ? ['132px'] : []),
    ...(showAmount ? ['minmax(110px, 0.9fr)'] : []),
    '28px',
  ].join(' ')

  const update = (index: number, patch: Partial<LineDraft>) => onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  const remove = (index: number) => onChange(lines.filter((_, i) => i !== index))
  const add = () => {
    const line = emptyLine()
    setFocusKey(line.key)
    onChange([...lines, line])
  }

  return (
    <div className={classes.root}>
      <div className={classes.head} style={{ gridTemplateColumns: columns }} aria-hidden>
        <span>Product</span>
        <span>Variant</span>
        <span>Quantity</span>
        {showPrice && <span className={classes.right}>Unit price</span>}
        {showAmount && <span className={classes.right}>Amount</span>}
        <span />
      </div>

      {lines.map((line, index) => {
        const product = line.productId ? byId.get(line.productId) : undefined
        const variants = product?.variants ?? []
        const err = errors[index] ?? {}
        const p = priced?.[index]
        const isPlanLine = Boolean(planProductId) && line.productId === planProductId
        const n = index + 1
        const messages = [err.productId, err.variantId, err.quantity, err.unitPrice].filter(Boolean)
        return (
          <div key={line.key} className={classes.row} style={{ gridTemplateColumns: columns }}>
            <Select
              aria-label={`Line ${n} product`}
              placeholder="Choose a product"
              searchable
              data={productOptions}
              value={line.productId}
              onChange={(v) => update(index, { productId: v, variantId: null, unitPrice: null })}
              error={Boolean(err.productId)}
              disabled={disabled}
              autoFocus={focusKey === line.key}
              nothingFoundMessage="No product with that name"
      selectFirstOptionOnChange
              allowDeselect={false}
            />
            <Select
              aria-label={`Line ${n} variant`}
              placeholder={!product ? '—' : variants.length ? 'No variant' : 'No variants'}
              data={variants.map((v) => ({ value: v.id, label: variantLabel(v) }))}
              renderOption={({ option }) => {
                const extra = variants.find((v) => v.id === option.value)?.extraPrice ?? 0
                return (
                  <Group justify="space-between" wrap="nowrap" gap="md" w="100%">
                    <span>{option.label}</span>
                    {extra > 0 && (
                      <Text span size="xs" c="dimmed" className="num">
                        +{formatMoney(extra)}
                      </Text>
                    )}
                  </Group>
                )
              }}
              value={line.variantId}
              onChange={(v) => update(index, { variantId: v, unitPrice: null })}
              clearable
              disabled={disabled || !variants.length}
              error={Boolean(err.variantId)}
            />
            <NumberInput
              aria-label={`Line ${n} quantity`}
              min={1}
              max={100000}
              allowDecimal={false}
              allowNegative={false}
              clampBehavior="strict"
              value={line.quantity}
              onChange={(v) => update(index, { quantity: v === '' ? '' : Number(v) })}
              error={Boolean(err.quantity)}
              description={isPlanLine && minQuantity && minQuantity > 1 ? `Min ${minQuantity}` : undefined}
              inputWrapperOrder={['label', 'input', 'description', 'error']}
              disabled={disabled}
              styles={{ input: { fontVariantNumeric: 'tabular-nums' } }}
            />
            {showPrice &&
              (priceEditable ? (
                <MoneyInput
                  aria-label={`Line ${n} unit price`}
                  placeholder={p && line.unitPrice == null ? formatMoney(p.unitPrice) : 'Catalog price'}
                  value={line.unitPrice}
                  onChange={(v) => update(index, { unitPrice: v })}
                  error={Boolean(err.unitPrice)}
                  disabled={disabled || !line.productId}
                  styles={{ input: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }}
                />
              ) : (
                <Text size="sm" className={`num ${classes.amount}`}>
                  {p ? formatMoney(p.unitPrice) : '—'}
                </Text>
              ))}
            {showAmount && (
              <div className={`${classes.amount} ${updating ? classes.updating : ''}`}>
                <Text size="sm" className="num">
                  {p ? formatMoney(p.subtotal) : '—'}
                </Text>
                {p?.discount && (
                  <Tooltip label={p.discount.name} withArrow>
                    <Text size="xs" className="num" c="dimmed">
                      −{formatMoney(p.discount.amount)} off
                    </Text>
                  </Tooltip>
                )}
              </div>
            )}
            <div className={classes.remove}>
              {!(isPlanLine && planLineCount <= 1) && (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={`Remove line ${n}${product ? ` (${product.name})` : ''}`}
                  onClick={() => remove(index)}
                  disabled={disabled}
                >
                  <IconX size={15} stroke={1.5} />
                </ActionIcon>
              )}
            </div>
            {messages.length > 0 && (
              <Text size="xs" c={tokens.status.bad} role="alert" style={{ gridColumn: '1 / -1', marginTop: -2 }}>
                {messages.join(' ')}
              </Text>
            )}
          </div>
        )
      })}

      {!lines.length && (
        <Text size="sm" c="dimmed" py={10}>
          No lines yet. Add the product this quote is for.
        </Text>
      )}
      {linesError && (
        <Text size="xs" c={tokens.status.bad} mt={4} role="alert">
          {linesError}
        </Text>
      )}
      {!disabled && (
        <Button variant="subtle" size="compact-sm" leftSection={<IconPlus size={14} stroke={1.75} />} onClick={add} mt={8}>
          Add line
        </Button>
      )}
    </div>
  )
}
