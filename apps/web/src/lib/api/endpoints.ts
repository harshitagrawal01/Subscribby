// One typed function per API endpoint.
// Single records are unwrapped (you get `data`); lists return `{ data, meta }`.
import { http, type QueryParams } from './client'
import type {
  AgingBucket,
  ApiResponse,
  AuthUser,
  BillingPeriod,
  BillingRunResult,
  BulkResult,
  Customer,
  Discount,
  DiscountState,
  Id,
  ImportResult,
  Invoice,
  InvoiceListItem,
  InvoiceStatus,
  ListQuery,
  ListResponse,
  Meta,
  Payment,
  PaymentInput,
  PaymentMethod,
  Plan,
  PlanBreakdown,
  Portal,
  PortalSummary,
  Product,
  ProductType,
  QuotationTemplate,
  ReportFilters,
  ReportSummary,
  RevenueMonth,
  Role,
  Session,
  StaffRole,
  StatusCounts,
  Subscription,
  SubscriptionInput,
  SubscriptionListItem,
  SubscriptionStatus,
  Tax,
  Totals,
  PricedLine,
  User,
  UserStatus,
} from './types'

const unwrap = <T>(promise: Promise<ApiResponse<T>>) => promise.then((r) => r.data)
const q = (params: object) => params as QueryParams

// ---------- Auth (section 5) ----------

export const authApi = {
  customerSignup: (body: { name: string; companyName?: string; email: string; password: string }) =>
    unwrap(http.post<ApiResponse<Session>>('/auth/customer/signup', body)),
  customerLogin: (body: { email: string; password: string }) =>
    unwrap(http.post<ApiResponse<Session>>('/auth/customer/login', body)),
  staffLogin: (body: { email: string; password: string }) =>
    unwrap(http.post<ApiResponse<Session>>('/auth/staff/login', body)),
  me: () => unwrap(http.get<ApiResponse<AuthUser>>('/auth/me')),
  updateMe: (body: Partial<{ name: string; phone: string }>) => unwrap(http.patch<ApiResponse<AuthUser>>('/auth/me', body)),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    unwrap(http.post<ApiResponse<Session>>('/auth/change-password', body)),
  forgotPassword: (body: { email: string; portal: Portal }) =>
    unwrap(http.post<ApiResponse<{ ok: true; devResetUrl?: string }>>('/auth/forgot-password', body)),
  resetPassword: (body: { token: string; newPassword: string }) =>
    unwrap(http.post<ApiResponse<Session>>('/auth/reset-password', body)),
}

export const metaApi = {
  get: () => unwrap(http.get<ApiResponse<Meta>>('/meta')),
}

// ---------- Catalog (section 6) ----------

export const productsApi = {
  list: (query: ListQuery & { type?: ProductType; isActive?: boolean } = {}) =>
    http.get<ListResponse<Product>>('/products', q(query)),
  get: (id: Id) => unwrap(http.get<ApiResponse<Product>>(`/products/${id}`)),
  create: (body: Omit<Product, 'id' | 'isActive' | 'variants'> & { variants: Omit<Product['variants'][number], 'id'>[] }) =>
    unwrap(http.post<ApiResponse<Product>>('/products', body)),
  update: (id: Id, body: Partial<Product>) => unwrap(http.patch<ApiResponse<Product>>(`/products/${id}`, body)),
  archive: (id: Id) => http.delete(`/products/${id}`),
}

export const plansApi = {
  list: (query: ListQuery & { billingPeriod?: BillingPeriod; isActive?: boolean; availableOn?: string } = {}) =>
    http.get<ListResponse<Plan>>('/plans', q(query)),
  get: (id: Id) => unwrap(http.get<ApiResponse<Plan>>(`/plans/${id}`)),
  create: (body: Omit<Plan, 'id' | 'isActive' | 'product' | 'activeSubscriptions'>) =>
    unwrap(http.post<ApiResponse<Plan>>('/plans', body)),
  update: (id: Id, body: Partial<Plan>) => unwrap(http.patch<ApiResponse<Plan>>(`/plans/${id}`, body)),
  archive: (id: Id) => http.delete(`/plans/${id}`),
}

export const templatesApi = {
  list: (query: ListQuery & { planId?: Id; isActive?: boolean } = {}) =>
    http.get<ListResponse<QuotationTemplate>>('/quotation-templates', q(query)),
  get: (id: Id) => unwrap(http.get<ApiResponse<QuotationTemplate>>(`/quotation-templates/${id}`)),
  create: (body: Omit<QuotationTemplate, 'id' | 'isActive' | 'plan' | 'usedCount'>) =>
    unwrap(http.post<ApiResponse<QuotationTemplate>>('/quotation-templates', body)),
  update: (id: Id, body: Partial<QuotationTemplate>) =>
    unwrap(http.patch<ApiResponse<QuotationTemplate>>(`/quotation-templates/${id}`, body)),
  archive: (id: Id) => http.delete(`/quotation-templates/${id}`),
}

// ---------- Admin config (section 7) ----------

export const taxesApi = {
  list: (query: ListQuery & { isActive?: boolean } = {}) => http.get<ListResponse<Tax>>('/taxes', q(query)),
  create: (body: Omit<Tax, 'id'>) => unwrap(http.post<ApiResponse<Tax>>('/taxes', body)),
  update: (id: Id, body: Partial<Tax>) => unwrap(http.patch<ApiResponse<Tax>>(`/taxes/${id}`, body)),
  archive: (id: Id) => http.delete(`/taxes/${id}`),
}

export const discountsApi = {
  list: (query: ListQuery & { state?: DiscountState } = {}) => http.get<ListResponse<Discount>>('/discounts', q(query)),
  get: (id: Id) => unwrap(http.get<ApiResponse<Discount>>(`/discounts/${id}`)),
  create: (body: Omit<Discount, 'id' | 'usedCount' | 'remainingUses' | 'state' | 'isActive'>) =>
    unwrap(http.post<ApiResponse<Discount>>('/discounts', body)),
  update: (id: Id, body: Partial<Discount>) => unwrap(http.patch<ApiResponse<Discount>>(`/discounts/${id}`, body)),
  stop: (id: Id) => unwrap(http.post<ApiResponse<Discount>>(`/discounts/${id}/stop`)),
}

export const usersApi = {
  list: (query: ListQuery & { role?: Role; status?: UserStatus } = {}) => http.get<ListResponse<User>>('/users', q(query)),
  create: (body: { name: string; email: string; role: StaffRole; temporaryPassword: string }) =>
    unwrap(http.post<ApiResponse<User>>('/users', body)),
  update: (id: Id, body: Partial<{ name: string; role: StaffRole; status: UserStatus }>) =>
    unwrap(http.patch<ApiResponse<User>>(`/users/${id}`, body)),
  resetPassword: (id: Id, temporaryPassword: string) =>
    unwrap(http.post<ApiResponse<User>>(`/users/${id}/reset-password`, { temporaryPassword })),
  /** Upload the CSV. Call with dryRun=true first to preview, then false to create. */
  importCsv: (file: File, dryRun: boolean) => {
    const form = new FormData()
    form.append('file', file)
    return unwrap(http.post<ApiResponse<ImportResult>>('/users/import', form, { dryRun }))
  },
  importTemplate: () => http.text('/users/import/template'),
}

// ---------- Customers (section 8) ----------

export const customersApi = {
  list: (query: ListQuery & { hasOverdue?: boolean; hasActiveSubscription?: boolean; isActive?: boolean } = {}) =>
    http.get<ListResponse<Customer>>('/customers', q(query)),
  get: (id: Id) => unwrap(http.get<ApiResponse<Customer>>(`/customers/${id}`)),
  create: (body: Omit<Customer, 'id' | 'portalStatus' | 'stats' | 'isActive'>) =>
    unwrap(http.post<ApiResponse<Customer>>('/customers', body)),
  update: (id: Id, body: Partial<Customer>) => unwrap(http.patch<ApiResponse<Customer>>(`/customers/${id}`, body)),
  archive: (id: Id) => http.delete(`/customers/${id}`),
}

// ---------- Subscriptions (section 9) ----------

export type SubscriptionListQuery = ListQuery & {
  status?: SubscriptionStatus
  customerId?: Id
  planId?: Id
  startFrom?: string
  startTo?: string
  expiringBefore?: string
}

type SubscriptionActionName = 'send' | 'confirm' | 'activate' | 'pause' | 'resume' | 'renew' | 'close' | 'cancel'

export const subscriptionsApi = {
  list: (query: SubscriptionListQuery = {}) =>
    http.get<ListResponse<SubscriptionListItem, { statusCounts: StatusCounts<SubscriptionStatus> }>>('/subscriptions', q(query)),
  get: (id: Id) => unwrap(http.get<ApiResponse<Subscription>>(`/subscriptions/${id}`)),
  create: (body: SubscriptionInput) => unwrap(http.post<ApiResponse<Subscription>>('/subscriptions', body)),
  preview: (body: SubscriptionInput) =>
    unwrap(http.post<ApiResponse<{ lines: PricedLine[]; totals: Totals }>>('/subscriptions/preview', body)),
  update: (id: Id, body: Partial<SubscriptionInput>) => unwrap(http.patch<ApiResponse<Subscription>>(`/subscriptions/${id}`, body)),
  remove: (id: Id) => http.delete(`/subscriptions/${id}`),
  /** send, confirm, activate, pause, resume, renew ({ newExpiryDate }), close ({ note }), cancel */
  action: (id: Id, action: SubscriptionActionName, body?: { note?: string; newExpiryDate?: string }) =>
    unwrap(http.post<ApiResponse<Subscription>>(`/subscriptions/${id}/${action}`, body)),
  createInvoice: (id: Id) => unwrap(http.post<ApiResponse<Invoice>>(`/subscriptions/${id}/invoices`)),
}

// ---------- Invoices & billing (section 10) ----------

export type InvoiceListQuery = ListQuery & {
  status?: InvoiceStatus
  overdue?: boolean
  customerId?: Id
  subscriptionId?: Id
  invoiceFrom?: string
  invoiceTo?: string
  dueFrom?: string
  dueTo?: string
}

export const invoicesApi = {
  list: (query: InvoiceListQuery = {}) =>
    http.get<ListResponse<InvoiceListItem, { statusCounts: StatusCounts<InvoiceStatus | 'overdue'> }>>('/invoices', q(query)),
  get: (id: Id) => unwrap(http.get<ApiResponse<Invoice>>(`/invoices/${id}`)),
  update: (id: Id, body: Partial<{ invoiceDate: string; dueDate: string; notes: string }>) =>
    unwrap(http.patch<ApiResponse<Invoice>>(`/invoices/${id}`, body)),
  confirm: (id: Id) => unwrap(http.post<ApiResponse<Invoice>>(`/invoices/${id}/confirm`)),
  cancel: (id: Id, rebill = true) => unwrap(http.post<ApiResponse<Invoice>>(`/invoices/${id}/cancel`, { rebill })),
  send: (id: Id) => unwrap(http.post<ApiResponse<Invoice>>(`/invoices/${id}/send`)),
  bulkConfirm: (ids: Id[]) => unwrap(http.post<ApiResponse<BulkResult>>('/invoices/bulk/confirm', { ids })),
  bulkSend: (ids: Id[]) => unwrap(http.post<ApiResponse<BulkResult>>('/invoices/bulk/send', { ids })),
}

export const billingApi = {
  run: (body: { asOfDate?: string; dryRun?: boolean } = {}) =>
    unwrap(http.post<ApiResponse<BillingRunResult>>('/billing/run', body)),
  lastRun: () => unwrap(http.get<ApiResponse<BillingRunResult | null>>('/billing/last-run')),
}

// ---------- Payments (section 11) ----------

export const paymentsApi = {
  list: (
    query: ListQuery & { invoiceId?: Id; customerId?: Id; method?: PaymentMethod; dateFrom?: string; dateTo?: string } = {},
  ) => http.get<ListResponse<Payment, { totalAmount: number }>>('/payments', q(query)),
  get: (id: Id) => unwrap(http.get<ApiResponse<Payment>>(`/payments/${id}`)),
  create: (body: PaymentInput) =>
    unwrap(
      http.post<ApiResponse<{ payment: Payment; invoice: Pick<Invoice, 'id' | 'number' | 'status' | 'amountPaid' | 'balance'> }>>(
        '/payments',
        body,
      ),
    ),
  remove: (id: Id, reason: string) => http.delete(`/payments/${id}`, { reason }),
}

// ---------- Reports (section 12) ----------

export const reportsApi = {
  summary: (filters: ReportFilters = {}) => unwrap(http.get<ApiResponse<ReportSummary>>('/reports/summary', q(filters))),
  revenueByMonth: (filters: { from?: string; to?: string; planId?: Id; customerId?: Id } = {}) =>
    unwrap(http.get<ApiResponse<RevenueMonth[]>>('/reports/revenue-by-month', q(filters))),
  subscriptionsByPlan: (filters: { status?: SubscriptionStatus } = {}) =>
    unwrap(http.get<ApiResponse<PlanBreakdown[]>>('/reports/subscriptions-by-plan', q(filters))),
  aging: (filters: ReportFilters = {}) => unwrap(http.get<ApiResponse<AgingBucket[]>>('/reports/aging', q(filters))),
  exportCsv: (type: 'invoices' | 'payments' | 'subscriptions', filters: QueryParams = {}) =>
    http.text('/reports/export', { type, ...filters }),
}

// ---------- Customer portal (section 13) ----------

export const portalApi = {
  summary: () => unwrap(http.get<ApiResponse<PortalSummary>>('/portal/summary')),
  subscriptions: (query: ListQuery & { status?: SubscriptionStatus } = {}) =>
    http.get<ListResponse<SubscriptionListItem>>('/portal/subscriptions', q(query)),
  subscription: (id: Id) => unwrap(http.get<ApiResponse<Subscription>>(`/portal/subscriptions/${id}`)),
  action: (id: Id, action: 'accept' | 'reject' | 'pause' | 'resume' | 'renew' | 'close') =>
    unwrap(http.post<ApiResponse<Subscription>>(`/portal/subscriptions/${id}/${action}`)),
  invoices: (query: ListQuery & { status?: InvoiceStatus; unpaid?: boolean } = {}) =>
    http.get<ListResponse<InvoiceListItem>>('/portal/invoices', q(query)),
  invoice: (id: Id) => unwrap(http.get<ApiResponse<Invoice>>(`/portal/invoices/${id}`)),
}
