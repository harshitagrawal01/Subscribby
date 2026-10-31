import type { InvoiceStatus, PaymentMethod, Role, SubscriptionStatus } from './api/types'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  staff: 'Internal Staff',
  finance: 'Finance Lead',
  customer: 'Customer',
}

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'gray' },
  quotation: { label: 'Quotation', color: 'blue' },
  confirmed: { label: 'Confirmed', color: 'cyan' },
  active: { label: 'Active', color: 'green' },
  paused: { label: 'Paused', color: 'yellow' },
  closed: { label: 'Closed', color: 'dark' },
}

export const INVOICE_STATUS: Record<InvoiceStatus | 'overdue', { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'gray' },
  confirmed: { label: 'Confirmed', color: 'blue' },
  paid: { label: 'Paid', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'dark' },
  overdue: { label: 'Overdue', color: 'red' },
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  card: 'Card',
  cash: 'Cash',
  cheque: 'Cheque',
  upi: 'UPI',
  other: 'Other',
}
