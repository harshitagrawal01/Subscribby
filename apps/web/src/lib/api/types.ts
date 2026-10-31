// Types for the API responses. If the API changes, change these first.
// Money is always integer paise. Calendar dates are "YYYY-MM-DD" strings. Timestamps are ISO strings.

export type Id = string
export type Paise = number
export type DateString = string // "YYYY-MM-DD"
export type Timestamp = string // ISO 8601 UTC

// ---------- Envelopes ----------

export interface ApiResponse<T> {
  data: T
}

export interface ListMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ListResponse<T, M extends object = object> {
  data: T[]
  meta: ListMeta & M
}

export interface ApiErrorDetail {
  field: string
  message: string
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: ApiErrorDetail[] }
}

export interface ListQuery {
  page?: number
  limit?: number
  sort?: string
  search?: string
}

export interface Ref {
  id: Id
  name: string
}

// ---------- Auth & users ----------

export type Role = 'admin' | 'staff' | 'finance' | 'customer'
export type StaffRole = Exclude<Role, 'customer'>
export type Portal = 'customer' | 'staff'
export type UserStatus = 'active' | 'disabled'

export interface Address {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export interface AuthUser {
  id: Id
  name: string
  email: string
  role: Role
  status: UserStatus
  mustChangePassword: boolean
  customerId?: Id | null
  lastLoginAt?: Timestamp | null
  customer?: { id: Id; name: string; phone?: string; billingAddress?: Address }
}

export interface Session {
  token: string
  user: AuthUser
}

export interface User {
  id: Id
  name: string
  email: string
  role: Role
  status: UserStatus
  mustChangePassword: boolean
  createdVia: 'signup' | 'admin' | 'import' | 'seed'
  lastLoginAt: Timestamp | null
  createdAt?: Timestamp
}

export interface ImportRow {
  row: number
  name: string
  email: string
  role: StaffRole | null
  status: 'valid' | 'invalid' | 'created'
  errors: ApiErrorDetail[]
}

export interface ImportResult {
  dryRun: boolean
  total: number
  valid: number
  invalid: number
  created: number
  rows: ImportRow[]
}

// ---------- Meta ----------

export interface Meta {
  accessLevels: { value: StaffRole; label: string }[]
  billingPeriods: BillingPeriod[]
  productTypes: ProductType[]
  paymentMethods: PaymentMethod[]
  paymentTermDays: number[]
  subscriptionStatuses: SubscriptionStatus[]
  invoiceStatuses: InvoiceStatus[]
  currency: 'INR'
  company: { name: string; address: string; taxId: string; email: string }
}

// ---------- Catalog ----------

export type ProductType = 'service' | 'addon' | 'physical'
export type BillingPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Variant {
  id: Id
  attribute: string
  value: string
  extraPrice: Paise
}

export interface Product {
  id: Id
  name: string
  type: ProductType
  salesPrice: Paise
  costPrice: Paise
  notes: string
  variants: Variant[]
  usedInPlans?: number
  isActive: boolean
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface PlanRules {
  autoClose: boolean
  closable: boolean
  pausable: boolean
  renewable: boolean
}

export interface Plan {
  id: Id
  name: string
  productId?: Id
  product?: { id: Id; name: string; variants?: Variant[] }
  price: Paise
  billingPeriod: BillingPeriod
  minQuantity: number
  availableFrom: DateString
  availableUntil: DateString | null
  rules: PlanRules
  description?: string
  activeSubscriptions?: number
  isActive: boolean
}

export interface TemplateLine {
  productId: Id
  variantId: Id | null
  quantity: number
  productName?: string
  variantLabel?: string | null
  unitPrice?: Paise
}

export interface QuotationTemplate {
  id: Id
  name: string
  planId: Id
  plan?: { id: Id; name: string; billingPeriod: BillingPeriod }
  validityDays: number
  paymentTermDays: number
  lines: TemplateLine[]
  notes: string
  usedCount?: number
  isActive: boolean
}

// ---------- Taxes & discounts ----------

export interface Tax {
  id: Id
  name: string
  type: 'percentage' | 'fixed'
  rate: number
  appliesTo: { kind: 'all' | 'productTypes' | 'products'; productTypes: ProductType[]; productIds: Id[] }
  isActive: boolean
}

export type DiscountState = 'inactive' | 'scheduled' | 'running' | 'expired' | 'exhausted'

export interface Discount {
  id: Id
  name: string
  type: 'percentage' | 'fixed'
  value: number
  minPurchaseAmount: Paise | null
  minQuantity: number | null
  startDate: DateString
  endDate: DateString
  usageLimit: number | null
  usedCount: number
  remainingUses: number | null
  state: DiscountState
  appliesTo: { kind: 'products' | 'subscription'; productIds: Id[] }
  isActive: boolean
}

// ---------- Customers ----------

export interface Customer {
  id: Id
  name: string
  contactName?: string
  email: string
  phone?: string
  billingAddress?: Address
  taxId?: string
  notes?: string
  portalStatus: 'none' | 'active' | 'disabled'
  stats?: { activeSubscriptions: number; outstandingAmount: Paise; overdueAmount: Paise; paidToDate: Paise }
  isActive: boolean
}

// ---------- Pricing (shared by subscriptions and invoices) ----------

export interface AppliedDiscount {
  discountId: Id
  name: string
  amount: Paise
}

export interface AppliedTax {
  taxId: Id
  name: string
  type: 'percentage' | 'fixed'
  rate: number
  amount: Paise
}

export interface PricedLine {
  id?: Id
  productId: Id
  productName?: string
  description?: string
  variantId?: Id | null
  variantLabel?: string | null
  quantity: number
  unitPrice: Paise
  subtotal: Paise
  discount: AppliedDiscount | null
  orderDiscountShare: Paise
  taxes: AppliedTax[]
  taxAmount: Paise
  total: Paise
}

export interface Totals {
  untaxedAmount: Paise
  discountTotal: Paise
  taxTotal: Paise
  total: Paise
}

// ---------- Subscriptions ----------

export type SubscriptionStatus = 'draft' | 'quotation' | 'confirmed' | 'active' | 'paused' | 'closed'

export type SubscriptionAction =
  | 'edit'
  | 'delete'
  | 'send'
  | 'confirm'
  | 'activate'
  | 'pause'
  | 'resume'
  | 'renew'
  | 'close'
  | 'cancel'
  | 'createInvoice'
  // customer portal
  | 'accept'
  | 'reject'

export interface HistoryEntry {
  at: Timestamp
  by: { id: string; name: string }
  action: string
  from: string | null
  to: string | null
  note: string | null
}

export interface SubscriptionListItem {
  id: Id
  number: string
  customer: Ref
  plan: { id: Id; name: string; billingPeriod: BillingPeriod }
  status: SubscriptionStatus
  startDate: DateString
  expiryDate: DateString
  nextInvoiceDate: DateString | null
  recurringTotal: Paise
  quotationValidUntil?: DateString | null
}

export interface Subscription extends SubscriptionListItem {
  customer: Ref & { email?: string }
  plan: { id: Id; name: string; billingPeriod: BillingPeriod; minQuantity: number; rules: PlanRules }
  template: Ref | null
  salesperson?: Ref | null
  isExpired: boolean
  paymentTermDays: number
  lines: PricedLine[]
  orderDiscount: AppliedDiscount | null
  totals: Totals
  allowedActions: SubscriptionAction[]
  invoiceSummary?: { count: number; outstandingAmount: Paise; lastInvoice: { id: Id; number: string; status: InvoiceStatus } | null }
  history?: HistoryEntry[]
  notes?: string
  closeReason?: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface SubscriptionLineInput {
  id?: Id
  productId: Id
  variantId: Id | null
  quantity: number
  unitPrice?: Paise
}

export interface SubscriptionInput {
  customerId: Id
  templateId?: Id
  planId?: Id
  startDate: DateString
  expiryDate?: DateString
  paymentTermDays?: number
  salespersonId?: Id
  notes?: string
  lines?: SubscriptionLineInput[]
}

export type StatusCounts<S extends string> = Partial<Record<S, number>>

// ---------- Invoices & billing ----------

export type InvoiceStatus = 'draft' | 'confirmed' | 'paid' | 'cancelled'
export type InvoiceAction = 'edit' | 'confirm' | 'cancel' | 'send' | 'recordPayment'

export interface InvoiceListItem {
  id: Id
  number: string
  customer: Ref
  subscription: { id: Id; number: string }
  invoiceDate: DateString
  dueDate: DateString
  total: Paise
  amountPaid: Paise
  balance: Paise
  status: InvoiceStatus
  isOverdue: boolean
  daysOverdue: number
}

export interface Invoice extends InvoiceListItem, Totals {
  customerSnapshot: { name: string; email: string; billingAddress?: Address; taxId?: string }
  company: { name: string; address: string; taxId: string }
  periodStart: DateString
  periodEnd: DateString
  lines: PricedLine[]
  orderDiscount: AppliedDiscount | null
  payments: Payment[]
  allowedActions: InvoiceAction[]
  sentAt: Timestamp | null
  sentCount: number
  createdBy: string
  notes?: string
}

export interface BulkResult {
  succeeded: Id[]
  failed: { id: Id; code: string; message: string }[]
}

export interface BillingRunResult {
  asOfDate: DateString
  dryRun: boolean
  lifecycle: { quotationsExpired: number; activated: number; autoClosed: number }
  dueSubscriptions: number
  created: number
  skippedAlreadyInvoiced: number
  failed: { subscriptionId: Id; number: string; code: string; message: string }[]
  invoiceIds: Id[]
  startedAt: Timestamp
  finishedAt: Timestamp
}

// ---------- Payments ----------

export type PaymentMethod = 'bank_transfer' | 'card' | 'cash' | 'cheque' | 'upi' | 'other'

export interface Payment {
  id: Id
  invoice?: { id: Id; number: string }
  customer?: Ref
  method: PaymentMethod
  amount: Paise
  paymentDate: DateString
  note: string
  recordedBy?: Ref
  createdAt?: Timestamp
}

export interface PaymentInput {
  invoiceId: Id
  method: PaymentMethod
  amount: Paise
  paymentDate: DateString
  note?: string
}

// ---------- Reports ----------

export interface ReportFilters {
  from?: DateString
  to?: DateString
  planId?: Id
  customerId?: Id
}

export interface ReportSummary {
  range: { from: DateString; to: DateString }
  activeSubscriptions: number
  newSubscriptions: number
  closedSubscriptions: number
  mrr: Paise
  revenueCollected: Paise
  invoicedAmount: Paise
  outstandingAmount: Paise
  overdueAmount: Paise
  overdueCount: number
}

export interface RevenueMonth {
  month: string // "YYYY-MM"
  invoiced: Paise
  collected: Paise
}

export interface PlanBreakdown {
  plan: Ref
  count: number
  mrr: Paise
}

export interface AgingBucket {
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+'
  count: number
  amount: Paise
}

// ---------- Portal ----------

export interface PortalSummary {
  activeSubscriptions: number
  pendingQuotations: { id: Id; number: string; plan: { name: string }; quotationValidUntil: DateString; recurringTotal: Paise }[]
  outstandingAmount: Paise
  overdueCount: number
  nextInvoice: { subscriptionNumber: string; date: DateString; amount: Paise } | null
}
