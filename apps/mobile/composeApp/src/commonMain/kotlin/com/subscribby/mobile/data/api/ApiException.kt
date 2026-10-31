package com.subscribby.mobile.data.api

import com.subscribby.mobile.data.model.ErrorDetail

/**
 * Every failure the API layer can produce.
 *
 * [code] is the API's error code (`INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `VALIDATION_ERROR`, ...) or one of
 * the client-side codes below. [details] carries per-field problems for forms.
 */
class ApiException(
    val status: Int,
    val code: String,
    override val message: String,
    val details: List<ErrorDetail> = emptyList(),
    cause: Throwable? = null,
) : Exception(message, cause) {

    /** One message per field (several rule messages for the same field are joined). */
    val fieldErrors: Map<String, String>
        get() = details.groupBy { it.field }.mapValues { (_, list) -> list.joinToString("\n") { it.message } }

    override fun toString(): String = "ApiException($status $code: $message${if (details.isEmpty()) "" else " $details"})"

    companion object {
        /** No response at all: offline, wrong base URL, server down, timeout. */
        const val NETWORK = "NETWORK"

        /** A response we could not decode. Means the client models and the API disagree. */
        const val BAD_RESPONSE = "BAD_RESPONSE"
    }
}

/** A message that is safe to show the user for any throwable. */
fun Throwable.userMessage(): String = when (this) {
    is ApiException -> when (code) {
        ApiException.NETWORK -> "Can't reach the server. Check your connection and try again."
        ApiException.BAD_RESPONSE -> "The server sent something unexpected. Try again later."
        "UNAUTHENTICATED" -> "Your session has ended. Please log in again."
        "RATE_LIMITED" -> "Too many attempts. Wait a minute and try again."
        else -> message
    }
    else -> "Something went wrong. Try again."
}
