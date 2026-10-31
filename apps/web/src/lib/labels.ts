import { tokens } from '@/theme'
import type { InvoiceStatus, PaymentMethod, Role, SubscriptionStatus } from './api/types'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  staff: 'Internal staff',
  finance: 'Finance lead',
  customer: 'Customer',
}

const s = tokens.status

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: s.draft },
  quotation: { label: 'Quotation', color: s.warn },
  confirmed: { label: 'Confirmed', color: s.info },
  active: { label: 'Active', color: s.good },
  paused: { label: 'Paused', color: s.paused },
  closed: { label: 'Closed', color: s.closed },
}

export const INVOICE_STATUS: Record<InvoiceStatus | 'overdue', { label: string; color: string }> = {
  draft: { label: 'Draft', color: s.draft },
  confirmed: { label: 'Unpaid', color: s.info },
  paid: { label: 'Paid', color: s.good },
  cancelled: { label: 'Cancelled', color: s.closed },
  overdue: { label: 'Overdue', color: s.bad },
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  card: 'Card',
  cash: 'Cash',
  cheque: 'Cheque',
  upi: 'UPI',
  other: 'Other',
}
