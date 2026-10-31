package com.subscribby.mobile

import java.net.HttpURLConnection
import java.net.URI
import org.junit.Assume.assumeTrue

/** Helpers for tests that run against the mock API (`cd apps/web && npm run mock`). */
object MockApi {
    val baseUrl: String = (System.getProperty("subscribby.apiUrl") ?: "http://localhost:4000/api/v1").trimEnd('/')

    const val CUSTOMER_EMAIL = "asha@kite.test"
    const val CUSTOMER_PASSWORD = "Customer@2026!"
    const val STAFF_EMAIL = "meera@brightloop.test"

    /** Skips the test (instead of failing) when the mock API isn't running. */
    fun requireRunning() {
        val up = runCatching {
            val c = URI("$baseUrl/health").toURL().openConnection() as HttpURLConnection
            c.connectTimeout = 2000
            c.readTimeout = 2000
            c.responseCode in 200..299
        }.getOrDefault(false)
        assumeTrue("Mock API not reachable at $baseUrl — start it with `cd apps/web && npm run mock`", up)
    }

    /** Re-seeds the mock so tests are repeatable. */
    fun reset() {
        val c = URI("$baseUrl/__mock/reset").toURL().openConnection() as HttpURLConnection
        c.requestMethod = "POST"
        check(c.responseCode in 200..299) { "Mock reset failed: ${c.responseCode}" }
    }
}
