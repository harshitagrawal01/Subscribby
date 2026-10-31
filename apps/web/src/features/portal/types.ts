import type { Address, AuthUser, Id } from '@/lib/api/types'

/**
 * GET /auth/me for a customer embeds the full customer record (spec section 5; mock: serializeCustomer).
 * The shared AuthUser type only lists a few of its fields, so the portal profile uses this wider one.
 */
export interface CustomerRecord {
  id: Id
  name: string
  contactName?: string
  email?: string
  phone?: string
  billingAddress?: Address
  taxId?: string
}

export type CustomerMe = Omit<AuthUser, 'customer'> & { customer?: CustomerRecord | null }

/** The invoice's company block also carries a billing email (GET /portal/invoices/:id). */
export interface CompanyDetails {
  name: string
  address: string
  taxId: string
  email?: string
}
