package com.subscribby.mobile.data.api

import com.subscribby.mobile.data.model.Envelope
import com.subscribby.mobile.data.model.ErrorEnvelope
import com.subscribby.mobile.data.model.ListEnvelope
import com.subscribby.mobile.data.model.Page
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logger
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.plugins.logging.SIMPLE
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.accept
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.parameter
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.ContentConvertException
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

val ApiJson: Json = Json {
    ignoreUnknownKeys = true // portal responses may carry fields the app doesn't use
    explicitNulls = false // don't send `"companyName": null`
    encodeDefaults = true // do send defaults such as `portal: "customer"`
}

/**
 * Thin Ktor wrapper that knows the API conventions (spec §2):
 * base path, `Authorization: Bearer <token>`, `{ data }` / `{ data, meta }` envelopes and the
 * `{ error: { code, message, details } }` error shape, which becomes an [ApiException].
 *
 * A 401 `UNAUTHENTICATED` on an authenticated call means the token is gone or stale:
 * [onUnauthenticated] is called (the app logs out) and the exception is still thrown.
 */
class ApiClient(
    val baseUrl: String,
    private val tokenProvider: () -> String?,
    private val onUnauthenticated: () -> Unit,
    httpClient: HttpClient? = null,
    logging: Boolean = false,
) {
    @PublishedApi
    internal val http: HttpClient = httpClient ?: HttpClient {
        expectSuccess = false
        install(ContentNegotiation) { json(ApiJson) }
        install(HttpTimeout) {
            connectTimeoutMillis = 10_000
            requestTimeoutMillis = 30_000
        }
        if (logging) {
            install(Logging) {
                logger = Logger.SIMPLE
                level = LogLevel.INFO // method, URL, status. Never bodies (they hold passwords).
                sanitizeHeader { it == HttpHeaders.Authorization }
            }
        }
    }

    suspend inline fun <reified T> get(path: String, query: Map<String, Any?> = emptyMap()): T =
        wrap { execute(HttpMethod.Get, path, query, auth = true) {}.body<Envelope<T>>().data }

    suspend inline fun <reified T> getList(path: String, query: Map<String, Any?> = emptyMap()): Page<T> =
        wrap {
            val envelope = execute(HttpMethod.Get, path, query, auth = true) {}.body<ListEnvelope<T>>()
            Page(envelope.data, envelope.meta)
        }

    suspend inline fun <reified B, reified T> post(path: String, body: B, auth: Boolean = true): T =
        wrap { execute(HttpMethod.Post, path, emptyMap(), auth) { setBody(body) }.body<Envelope<T>>().data }

    /** POST with an empty JSON object body (used by the subscription actions). */
    suspend inline fun <reified T> post(path: String): T = post<JsonObject, T>(path, JsonObject(emptyMap()))

    suspend inline fun <reified B, reified T> patch(path: String, body: B): T =
        wrap { execute(HttpMethod.Patch, path, emptyMap(), auth = true) { setBody(body) }.body<Envelope<T>>().data }

    /** Sends the request and turns any non-2xx response into an [ApiException]. */
    @PublishedApi
    internal suspend fun execute(
        method: HttpMethod,
        path: String,
        query: Map<String, Any?>,
        auth: Boolean,
        block: HttpRequestBuilder.() -> Unit,
    ): HttpResponse {
        val token = if (auth) tokenProvider() else null
        val response = http.request("$baseUrl/${path.trimStart('/')}") {
            this.method = method
            accept(ContentType.Application.Json)
            contentType(ContentType.Application.Json)
            if (token != null) bearerAuth(token)
            query.forEach { (key, value) -> if (value != null) parameter(key, value) }
            block()
        }
        if (response.status.isSuccess()) return response

        val error = runCatching { ApiJson.decodeFromString<ErrorEnvelope>(response.bodyAsText()).error }.getOrNull()
        val exception = ApiException(
            status = response.status.value,
            code = error?.code ?: "HTTP_${response.status.value}",
            message = error?.message ?: "Request failed (${response.status.value})",
            details = error?.details.orEmpty(),
        )
        if (exception.status == 401 && exception.code == "UNAUTHENTICATED" && token != null) onUnauthenticated()
        throw exception
    }

    /** Maps transport and decoding failures to [ApiException] so callers handle one type. */
    @PublishedApi
    internal suspend inline fun <T> wrap(block: () -> T): T = try {
        block()
    } catch (e: CancellationException) {
        throw e
    } catch (e: ApiException) {
        throw e
    } catch (e: ContentConvertException) {
        throw ApiException(0, ApiException.BAD_RESPONSE, e.message ?: "Could not read the response", cause = e)
    } catch (e: SerializationException) {
        throw ApiException(0, ApiException.BAD_RESPONSE, e.message ?: "Could not read the response", cause = e)
    } catch (e: Exception) {
        throw ApiException(0, ApiException.NETWORK, e.message ?: "Network error", cause = e)
    }

    fun close() = http.close()
}
