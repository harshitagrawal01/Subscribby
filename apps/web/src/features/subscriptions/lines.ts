import type { AppliedDiscount, PricedLine, SubscriptionLineInput, TemplateLine, Totals } from '@/lib/api/types'

/** One row in the lines editor. Quantity can be '' while someone is typing. */
export interface LineDraft {
  key: string
  /** Existing subscription line id (PATCH keeps it). */
  id?: string
  productId: string | null
  variantId: string | null
  quantity: number | ''
  /** Staff override in paise. null = default price (or the stored price for existing lines). */
  unitPrice: number | null
}

/** What POST /subscriptions/preview returns (the mock also sends orderDiscount, which types.ts leaves out). */
export interface PreviewResult {
  lines: PricedLine[]
  orderDiscount?: AppliedDiscount | null
  totals: Totals
}

let seq = 0
export const lineKey = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`

export const emptyLine = (): LineDraft => ({ key: lineKey(), productId: null, variantId: null, quantity: 1, unitPrice: null })

export const isCompleteLine = (l: LineDraft) => Boolean(l.productId) && typeof l.quantity === 'number' && l.quantity >= 1

export const linesFromTemplate = (lines: TemplateLine[]): LineDraft[] =>
  lines.map((l) => ({ key: lineKey(), productId: l.productId, variantId: l.variantId ?? null, quantity: l.quantity, unitPrice: null }))

export const linesFromSubscription = (lines: PricedLine[]): LineDraft[] =>
  lines.map((l) => ({ key: lineKey(), id: l.id, productId: l.productId, variantId: l.variantId ?? null, quantity: l.quantity, unitPrice: null }))

/** Make sure the plan's own product is on the quote, at the plan minimum. */
export function ensurePlanLine(lines: LineDraft[], productId: string | undefined, minQuantity: number): LineDraft[] {
  if (!productId) return lines
  if (lines.some((l) => l.productId === productId)) return lines
  const blankIndex = lines.findIndex((l) => !l.productId)
  const planLine: LineDraft = { key: lineKey(), productId, variantId: null, quantity: minQuantity, unitPrice: null }
  if (blankIndex >= 0) return lines.map((l, i) => (i === blankIndex ? { ...planLine, key: l.key } : l))
  return [planLine, ...lines]
}

/**
 * Lines ready to send, plus where each one came from in the editor
 * (so API errors like lines[1].quantity land on the right row).
 */
export function toLineInputs(
  lines: LineDraft[],
  opts: { withPrices: boolean } = { withPrices: true },
) {
  const inputs: SubscriptionLineInput[] = []
  const indexMap: number[] = []
  lines.forEach((l, i) => {
    if (!isCompleteLine(l)) return
    const input: SubscriptionLineInput = { productId: l.productId!, variantId: l.variantId, quantity: l.quantity as number }
    if (l.id) input.id = l.id
    if (opts.withPrices && l.unitPrice != null) input.unitPrice = l.unitPrice
    inputs.push(input)
    indexMap.push(i)
  })
  return { inputs, indexMap }
}

/**
 * Enter in a text field confirms that field (a date, a picked option); it shouldn't save the whole form.
 * Saving stays on the button and Ctrl/⌘ + Enter.
 */
export function blockImplicitSubmit(e: { key: string; metaKey: boolean; ctrlKey: boolean; target: EventTarget; preventDefault: () => void }) {
  if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && e.target instanceof HTMLInputElement) e.preventDefault()
}
