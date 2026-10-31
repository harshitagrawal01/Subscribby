import type { BillingPeriod, SubscriptionAction, SubscriptionStatus } from '@/lib/api/types'

/** Payment terms the API accepts (spec section 4). */
export const PAYMENT_TERM_DAYS = [0, 15, 30, 45] as const

export const paymentTermLabel = (days: number) => (days === 0 ? 'Due on receipt' : `${days} days`)

export const PAYMENT_TERM_OPTIONS = PAYMENT_TERM_DAYS.map((d) => ({ value: String(d), label: paymentTermLabel(d) }))

export const PERIOD_NOUN: Record<BillingPeriod, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
}

export const PERIOD_LABEL: Record<BillingPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

export const CLOSE_REASON_LABEL: Record<string, string> = {
  expired: 'Expired',
  closed_early: 'Closed early',
  cancelled: 'Cancelled',
  rejected: 'Rejected by the customer',
  quotation_expired: 'Quotation expired',
}

/** History entries read as a short past-tense sentence. */
export const HISTORY_LABEL: Record<string, string> = {
  create: 'Created as draft',
  send: 'Quotation sent',
  confirm: 'Confirmed',
  accept: 'Accepted by the customer',
  activate: 'Activated',
  pause: 'Paused',
  resume: 'Resumed',
  renew: 'Renewed',
  close: 'Closed',
  cancel: 'Cancelled',
  reject: 'Rejected by the customer',
  edit: 'Edited',
}

/** The happy path, left to right. Paused sits beside Active. */
export const TRACK: SubscriptionStatus[] = ['draft', 'quotation', 'confirmed', 'active', 'closed']

/** Which fields PATCH accepts in each status (spec "What can be edited"). */
export type EditableField = 'customerId' | 'planId' | 'startDate' | 'expiryDate' | 'paymentTermDays' | 'salespersonId' | 'notes' | 'lines' | 'unitPrice'

const ALL: EditableField[] = ['customerId', 'planId', 'startDate', 'expiryDate', 'paymentTermDays', 'salespersonId', 'notes', 'lines', 'unitPrice']

export const EDITABLE_FIELDS: Record<SubscriptionStatus, EditableField[]> = {
  draft: ALL,
  quotation: ALL,
  confirmed: ['startDate', 'expiryDate', 'salespersonId', 'notes', 'lines'],
  active: ['lines', 'salespersonId', 'notes'],
  paused: ['lines', 'salespersonId', 'notes'],
  closed: [],
}

/** Button order: the next step first, then the rest. */
export const PRIMARY_ACTIONS: SubscriptionAction[] = ['send', 'confirm', 'activate', 'createInvoice', 'resume']
