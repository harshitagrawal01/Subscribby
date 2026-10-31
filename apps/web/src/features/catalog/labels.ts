import type { BillingPeriod, Customer, Discount, DiscountState, PlanRules, Product, ProductType, Tax } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'
import { tokens } from '@/theme'

const s = tokens.status

export const PRODUCT_TYPES: ProductType[] = ['service', 'addon', 'physical']

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  service: 'Service',
  addon: 'Add-on',
  physical: 'Physical good',
}

/** Plural, lowercase, for sentences: "Services and add-ons". */
const PRODUCT_TYPE_PLURAL: Record<ProductType, string> = {
  service: 'services',
  addon: 'add-ons',
  physical: 'physical goods',
}

export const BILLING_PERIODS: BillingPeriod[] = ['daily', 'weekly', 'monthly', 'yearly']

export const BILLING_PERIOD_LABELS: Record<BillingPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

export const PERIOD_UNIT: Record<BillingPeriod, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
}

export const PLAN_RULES: { key: keyof PlanRules; label: string; hint: string; short: string }[] = [
  {
    key: 'autoClose',
    label: 'Close automatically on expiry',
    hint: 'The nightly job closes the subscription on its expiry date instead of leaving it open.',
    short: 'Auto-close',
  },
  {
    key: 'closable',
    label: 'Can be closed early',
    hint: 'Staff and the customer can close it before the expiry date.',
    short: 'Closable',
  },
  {
    key: 'pausable',
    label: 'Can be paused',
    hint: 'Billing stops while paused and starts again on resume.',
    short: 'Pausable',
  },
  {
    key: 'renewable',
    label: 'Can be renewed',
    hint: 'The term can be extended with a new expiry date.',
    short: 'Renewable',
  },
]

export const rulesInWords = (rules: PlanRules) => {
  const on = PLAN_RULES.filter((r) => rules[r.key]).map((r) => r.short)
  return on.length ? on.join(' · ') : 'Fixed term'
}

export const DISCOUNT_STATES: DiscountState[] = ['running', 'scheduled', 'expired', 'exhausted', 'inactive']

export const DISCOUNT_STATE: Record<DiscountState, { label: string; color: string }> = {
  running: { label: 'Running', color: s.good },
  scheduled: { label: 'Scheduled', color: s.info },
  expired: { label: 'Expired', color: s.closed },
  exhausted: { label: 'Used up', color: s.warn },
  inactive: { label: 'Stopped', color: s.draft },
}

export const PORTAL_STATUS: Record<Customer['portalStatus'], { label: string; color: string }> = {
  active: { label: 'Portal active', color: s.good },
  none: { label: 'No login yet', color: s.draft },
  disabled: { label: 'Login disabled', color: s.bad },
}

export const ACTIVE_STATUS = {
  active: { label: 'Active', color: s.good },
  archived: { label: 'Archived', color: s.closed },
  inactive: { label: 'Inactive', color: s.draft },
}

/** 18 → "18%", 12.5 → "12.5%". */
export const formatPercent = (value: number) => `${Number(value.toFixed(2))}%`

export const taxRateText = (tax: Pick<Tax, 'type' | 'rate'>) =>
  tax.type === 'percentage' ? formatPercent(tax.rate) : `${formatMoney(tax.rate)} per unit`

export const discountValueText = (d: Pick<Discount, 'type' | 'value'>) =>
  d.type === 'percentage' ? `${formatPercent(d.value)} off` : `${formatMoney(d.value)} off`

/** "Analytics add-on" · "CRM Suite and Analytics add-on" · "CRM Suite, Kit and 2 more". */
export function namesInWords(ids: string[], productsById: Map<string, Pick<Product, 'name'>>) {
  const names = ids.map((id) => productsById.get(id)?.name ?? 'Unknown product')
  if (names.length <= 2) return names.join(' and ')
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
}

export function typesInWords(types: ProductType[]) {
  const words = PRODUCT_TYPES.filter((t) => types.includes(t)).map((t) => PRODUCT_TYPE_PLURAL[t])
  if (!words.length) return 'No product types'
  const text = words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
  return `All ${text}`
}

export function taxAppliesText(tax: Tax, productsById: Map<string, Pick<Product, 'name'>>) {
  if (tax.appliesTo.kind === 'all') return 'Every product'
  if (tax.appliesTo.kind === 'productTypes') return typesInWords(tax.appliesTo.productTypes)
  return tax.appliesTo.productIds.length ? namesInWords(tax.appliesTo.productIds, productsById) : 'No products picked'
}

export function discountAppliesText(d: Discount, productsById: Map<string, Pick<Product, 'name'>>) {
  if (d.appliesTo.kind === 'subscription') return 'Whole subscription'
  return d.appliesTo.productIds.length ? namesInWords(d.appliesTo.productIds, productsById) : 'No products picked'
}
