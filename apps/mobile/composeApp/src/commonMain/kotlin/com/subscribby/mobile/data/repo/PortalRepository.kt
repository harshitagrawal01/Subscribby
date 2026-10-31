package com.subscribby.mobile.data.repo

import com.subscribby.mobile.data.api.ApiClient
import com.subscribby.mobile.data.model.InvoiceDetail
import com.subscribby.mobile.data.model.InvoiceListItem
import com.subscribby.mobile.data.model.Page
import com.subscribby.mobile.data.model.PortalSummary
import com.subscribby.mobile.data.model.SubscriptionDetail
import com.subscribby.mobile.data.model.SubscriptionListItem

enum class InvoiceFilter(val label: String) { All("All"), Unpaid("Unpaid"), Paid("Paid") }

/**
 * Customer portal endpoints (spec §13). The server scopes everything to the logged-in customer,
 * prices everything and decides which actions are allowed; the app only displays.
 */
class PortalRepository(private val api: ApiClient) {

    suspend fun summary(): PortalSummary = api.get("portal/summary")

    /** A customer has a handful of subscriptions, so one page of 100 is plenty. */
    suspend fun subscriptions(status: String? = null): Page<SubscriptionListItem> =
        api.getList("portal/subscriptions", mapOf("status" to status, "limit" to PAGE_SIZE, "sort" to "-createdAt"))

    suspend fun subscription(id: String): SubscriptionDetail = api.get("portal/subscriptions/$id")

    /**
     * Runs one of the customer actions the server listed in `allowedActions`
     * (accept, reject, pause, resume, renew, close) and returns the updated subscription.
     */
    suspend fun runAction(id: String, action: String): SubscriptionDetail {
        require(action in CUSTOMER_ACTIONS) { "Unknown action $action" }
        return api.post("portal/subscriptions/$id/$action")
    }

    suspend fun invoices(filter: InvoiceFilter = InvoiceFilter.All): Page<InvoiceListItem> {
        val query = buildMap<String, Any?> {
            put("limit", PAGE_SIZE)
            put("sort", "-invoiceDate")
            when (filter) {
                InvoiceFilter.All -> Unit
                InvoiceFilter.Unpaid -> put("unpaid", true)
                InvoiceFilter.Paid -> put("status", "paid")
            }
        }
        return api.getList("portal/invoices", query)
    }

    suspend fun invoice(id: String): InvoiceDetail = api.get("portal/invoices/$id")

    companion object {
        const val PAGE_SIZE = 100
        val CUSTOMER_ACTIONS = setOf("accept", "reject", "pause", "resume", "renew", "close")
    }
}
