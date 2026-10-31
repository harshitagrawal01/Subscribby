package com.subscribby.mobile.util

/** Human labels for API enum values. Colours live in ui/components/StatusChip.kt. */
object Labels {
    fun subscriptionStatus(status: String): String = when (status) {
        "draft" -> "Draft"
        "quotation" -> "Quotation"
        "confirmed" -> "Confirmed"
        "active" -> "Active"
        "paused" -> "Paused"
        "closed" -> "Closed"
        else -> status.replaceFirstChar { it.uppercase() }
    }

    fun invoiceStatus(status: String): String = when (status) {
        "draft" -> "Draft"
        "confirmed" -> "Unpaid"
        "paid" -> "Paid"
        "cancelled" -> "Cancelled"
        else -> status.replaceFirstChar { it.uppercase() }
    }

    fun billingPeriod(period: String?): String = when (period) {
        "daily" -> "day"
        "weekly" -> "week"
        "monthly" -> "month"
        "yearly" -> "year"
        null -> "period"
        else -> period
    }

    fun paymentMethod(method: String): String = when (method) {
        "bank_transfer" -> "Bank transfer"
        "card" -> "Card"
        "cash" -> "Cash"
        "cheque" -> "Cheque"
        "upi" -> "UPI"
        "other" -> "Other"
        else -> method
    }

    fun closeReason(reason: String?): String? = when (reason) {
        null -> null
        "rejected" -> "Quotation rejected"
        "cancelled" -> "Cancelled"
        "quotation_expired" -> "Quotation expired"
        "expired" -> "Expired"
        "closed_early" -> "Closed early"
        else -> reason.replace('_', ' ').replaceFirstChar { it.uppercase() }
    }

    /** Button text for a customer action from `allowedActions`. */
    fun action(action: String): String = when (action) {
        "accept" -> "Accept quotation"
        "reject" -> "Reject"
        "pause" -> "Pause"
        "resume" -> "Resume"
        "renew" -> "Renew"
        "close" -> "Close subscription"
        else -> action.replaceFirstChar { it.uppercase() }
    }

    /** Confirm-dialog copy for each action: title to body. */
    fun actionConfirm(action: String, number: String): Pair<String, String> = when (action) {
        "accept" -> "Accept quotation?" to "You're confirming $number. Billing starts on the start date at the amounts shown."
        "reject" -> "Reject quotation?" to "$number will be closed and can't be accepted later."
        "pause" -> "Pause subscription?" to "No invoices are created for $number while it's paused."
        "resume" -> "Resume subscription?" to "$number becomes active again and billing restarts."
        "renew" -> "Renew subscription?" to "$number will be extended by one more term."
        "close" -> "Close subscription?" to "$number will end and stop billing. This can't be undone."
        else -> "Continue?" to "Run \"$action\" on $number?"
    }

    fun actionDone(action: String): String = when (action) {
        "accept" -> "Quotation accepted"
        "reject" -> "Quotation rejected"
        "pause" -> "Subscription paused"
        "resume" -> "Subscription resumed"
        "renew" -> "Subscription renewed"
        "close" -> "Subscription closed"
        else -> "Done"
    }
}
