package com.subscribby.mobile.data.model

import kotlinx.serialization.Serializable

// Shapes from spec §9 (subscriptions), §10 (invoices) and §13 (portal), minus staff-only fields.
// Only fields the app shows are required; everything else is optional so harmless API additions
// don't break decoding.

// ---------- Pricing (shared by subscriptions and invoices) ----------

@Serializable
data class AppliedDiscount(val discountId: String? = null, val name: String, val amount: Paise)

@Serializable
data class AppliedTax(
    val taxId: String? = null,
    val name: String,
    val type: String,
    val rate: Double,
    val amount: Paise,
)

@Serializable
data class PricedLine(
    val id: String? = null,
    val productId: String,
    val productName: String? = null,
    val description: String? = null,
    val variantId: String? = null,
    val variantLabel: String? = null,
    val quantity: Int,
    val unitPrice: Paise,
    val subtotal: Paise,
    val discount: AppliedDiscount? = null,
    val orderDiscountShare: Paise = 0,
    val taxes: List<AppliedTax> = emptyList(),
    val taxAmount: Paise,
    val total: Paise,
) {
    val title: String get() = productName ?: description ?: "Item"
}

@Serializable
data class Totals(
    val untaxedAmount: Paise,
    val discountTotal: Paise,
    val taxTotal: Paise,
    val total: Paise,
)

// ---------- Subscriptions ----------

@Serializable
data class PlanRules(
    val autoClose: Boolean = false,
    val closable: Boolean = false,
    val pausable: Boolean = false,
    val renewable: Boolean = false,
)

@Serializable
data class PlanSummary(
    val id: String? = null,
    val name: String,
    val billingPeriod: String? = null,
    val minQuantity: Int? = null,
    val rules: PlanRules? = null,
)

@Serializable
data class SubscriptionListItem(
    val id: String,
    val number: String,
    val customer: Ref,
    val plan: PlanSummary,
    /** draft | quotation | confirmed | active | paused | closed */
    val status: String,
    val startDate: DateString,
    val expiryDate: DateString,
    val nextInvoiceDate: DateString? = null,
    val quotationValidUntil: DateString? = null,
    val isExpired: Boolean = false,
    val recurringTotal: Paise,
    val closeReason: String? = null,
)

@Serializable
data class InvoiceRef(val id: String, val number: String, val status: String? = null)

@Serializable
data class InvoiceSummary(
    val count: Int,
    val outstandingAmount: Paise,
    val lastInvoice: InvoiceRef? = null,
)

@Serializable
data class SubscriptionDetail(
    val id: String,
    val number: String,
    val status: String,
    val customer: Ref,
    val plan: PlanSummary,
    val template: Ref? = null,
    val startDate: DateString,
    val expiryDate: DateString,
    val isExpired: Boolean = false,
    val quotationValidUntil: DateString? = null,
    val paymentTermDays: Int? = null,
    val nextInvoiceDate: DateString? = null,
    val lines: List<PricedLine>,
    val orderDiscount: AppliedDiscount? = null,
    val totals: Totals,
    val recurringTotal: Paise? = null,
    /** Customer actions: accept, reject, pause, resume, renew, close. Buttons come only from here. */
    val allowedActions: List<String> = emptyList(),
    val invoiceSummary: InvoiceSummary? = null,
    val closeReason: String? = null,
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null,
)

// ---------- Invoices ----------

@Serializable
data class SubscriptionRef(val id: String, val number: String)

@Serializable
data class InvoiceListItem(
    val id: String,
    val number: String,
    val customer: Ref,
    val subscription: SubscriptionRef? = null,
    val periodStart: DateString? = null,
    val periodEnd: DateString? = null,
    val invoiceDate: DateString,
    val dueDate: DateString,
    val total: Paise,
    val amountPaid: Paise,
    val balance: Paise,
    /** draft | confirmed | paid | cancelled (drafts never reach the portal) */
    val status: String,
    val isOverdue: Boolean = false,
    val daysOverdue: Int = 0,
)

@Serializable
data class CustomerSnapshot(
    val name: String,
    val email: String? = null,
    val billingAddress: Address? = null,
    val taxId: String? = null,
)

@Serializable
data class CompanyInfo(
    val name: String,
    val address: String? = null,
    val taxId: String? = null,
    val email: String? = null,
)

@Serializable
data class Payment(
    val id: String,
    val method: String,
    val amount: Paise,
    val paymentDate: DateString,
    val note: String? = null,
)

@Serializable
data class InvoiceDetail(
    val id: String,
    val number: String,
    val status: String,
    val subscription: SubscriptionRef? = null,
    val customer: Ref,
    val customerSnapshot: CustomerSnapshot? = null,
    val company: CompanyInfo? = null,
    val periodStart: DateString? = null,
    val periodEnd: DateString? = null,
    val invoiceDate: DateString,
    val dueDate: DateString,
    val lines: List<PricedLine>,
    val orderDiscount: AppliedDiscount? = null,
    val untaxedAmount: Paise,
    val discountTotal: Paise,
    val taxTotal: Paise,
    val total: Paise,
    val amountPaid: Paise,
    val balance: Paise,
    val isOverdue: Boolean = false,
    val daysOverdue: Int = 0,
    val payments: List<Payment> = emptyList(),
    val allowedActions: List<String> = emptyList(),
)

// ---------- Portal home ----------

@Serializable
data class PendingQuotation(
    val id: String,
    val number: String,
    val plan: PlanSummary,
    val quotationValidUntil: DateString? = null,
    val recurringTotal: Paise,
)

@Serializable
data class NextInvoice(val subscriptionNumber: String, val date: DateString, val amount: Paise)

@Serializable
data class PortalSummary(
    val activeSubscriptions: Int,
    val pendingQuotations: List<PendingQuotation> = emptyList(),
    val outstandingAmount: Paise,
    val overdueCount: Int,
    val nextInvoice: NextInvoice? = null,
)
