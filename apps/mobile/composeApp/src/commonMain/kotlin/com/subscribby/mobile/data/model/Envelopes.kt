package com.subscribby.mobile.data.model

import kotlinx.serialization.Serializable

/** Money is always whole paise (spec §2). */
typealias Paise = Long

/** Calendar date "YYYY-MM-DD". */
typealias DateString = String

/** ISO-8601 UTC timestamp. */
typealias Timestamp = String

/** `{ "data": ... }` */
@Serializable
data class Envelope<T>(val data: T)

/** `{ "data": [...], "meta": {...} }` */
@Serializable
data class ListEnvelope<T>(val data: List<T>, val meta: ListMeta)

@Serializable
data class ListMeta(
    val page: Int,
    val limit: Int,
    val total: Int,
    val totalPages: Int,
    val statusCounts: Map<String, Int>? = null,
)

/** A page of results plus its meta. */
data class Page<T>(val items: List<T>, val meta: ListMeta)

/** `{ "error": { code, message, details? } }` */
@Serializable
data class ErrorEnvelope(val error: ErrorBody)

@Serializable
data class ErrorBody(
    val code: String,
    val message: String,
    val details: List<ErrorDetail>? = null,
)

@Serializable
data class ErrorDetail(val field: String, val message: String)

@Serializable
data class Ref(val id: String, val name: String)

@Serializable
data class Ok(val ok: Boolean = true)
