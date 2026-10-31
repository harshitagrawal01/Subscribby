package com.subscribby.mobile

import com.subscribby.mobile.data.AppContainer
import com.subscribby.mobile.data.api.ApiException
import com.subscribby.mobile.data.repo.InvoiceFilter
import com.subscribby.mobile.data.repo.SessionState
import com.subscribby.mobile.platform.InMemoryKeyValueStore
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlinx.coroutines.runBlocking

/**
 * Proves the DTOs match the real API shapes by decoding live responses from the mock API.
 * Skipped automatically when the mock isn't running. Uses runBlocking (not runTest): real network I/O
 * must not run on virtual time, or the HTTP timeouts fire instantly.
 */
class ApiIntegrationTest {
    private lateinit var container: AppContainer

    @BeforeTest
    fun setUp() {
        MockApi.requireRunning()
        MockApi.reset()
        container = AppContainer(store = InMemoryKeyValueStore(), baseUrl = MockApi.baseUrl, logging = false)
    }

    @AfterTest
    fun tearDown() {
        if (::container.isInitialized) container.api.close()
        runCatching { MockApi.reset() }
    }

    @Test
    fun customerFlowDecodesIntoModels() = runBlocking<Unit> {
        val user = container.auth.login(MockApi.CUSTOMER_EMAIL, MockApi.CUSTOMER_PASSWORD)
        assertEquals("customer", user.role)
        assertNotNull(container.session.token)
        assertIs<SessionState.LoggedIn>(container.session.state.value)

        val me = container.auth.me()
        assertEquals("Kite Stores", me.customer?.name)

        val summary = container.portal.summary()
        println("summary: $summary")
        assertTrue(summary.pendingQuotations.isNotEmpty(), "Kite Stores should have a pending quotation")

        val subs = container.portal.subscriptions()
        println("subscriptions: ${subs.items.map { "${it.number} ${it.status} ${it.recurringTotal}" }} meta=${subs.meta}")
        assertTrue(subs.items.isNotEmpty())
        assertEquals(subs.items.size, subs.meta.total)

        // Every subscription detail must decode, not just the first.
        for (item in subs.items) {
            val detail = container.portal.subscription(item.id)
            assertEquals(item.number, detail.number)
            assertTrue(detail.lines.isNotEmpty())
            assertEquals(detail.totals.total, detail.lines.sumOf { it.total }, "line totals add up to the API total")
        }

        val quotationId = summary.pendingQuotations.first().id
        val quotation = container.portal.subscription(quotationId)
        assertEquals("quotation", quotation.status)
        assertEquals(listOf("accept", "reject"), quotation.allowedActions)

        val invoices = container.portal.invoices()
        assertTrue(invoices.items.isNotEmpty())
        val unpaid = container.portal.invoices(InvoiceFilter.Unpaid).items
        val paid = container.portal.invoices(InvoiceFilter.Paid).items
        assertTrue(unpaid.all { it.balance > 0 })
        assertTrue(paid.all { it.status == "paid" })
        for (inv in invoices.items) {
            val detail = container.portal.invoice(inv.id)
            assertEquals(inv.total, detail.total)
            assertEquals(detail.total - detail.amountPaid, detail.balance)
        }
    }

    @Test
    fun acceptQuotationUsesServerActions() = runBlocking<Unit> {
        container.auth.login(MockApi.CUSTOMER_EMAIL, MockApi.CUSTOMER_PASSWORD)
        val id = container.portal.summary().pendingQuotations.first().id
        val updated = container.portal.runAction(id, "accept")
        assertTrue(updated.status == "confirmed" || updated.status == "active", "was ${updated.status}")
        assertTrue("accept" !in updated.allowedActions)
        assertTrue(container.portal.summary().pendingQuotations.none { it.id == id })
    }

    @Test
    fun wrongPasswordAndStaffAccountGetInvalidCredentials() = runBlocking<Unit> {
        val wrong = assertFailsWith<ApiException> { container.auth.login(MockApi.CUSTOMER_EMAIL, "Nope@12345") }
        assertEquals("INVALID_CREDENTIALS", wrong.code)
        val staff = assertFailsWith<ApiException> { container.auth.login(MockApi.STAFF_EMAIL, "Welcome@2026!") }
        assertEquals("INVALID_CREDENTIALS", staff.code)
        assertIs<SessionState.LoggedOut>(container.session.state.value)
    }

    @Test
    fun signupReportsEmailTakenAndFieldDetails() = runBlocking<Unit> {
        val taken = assertFailsWith<ApiException> {
            container.auth.signup("Asha Again", null, MockApi.CUSTOMER_EMAIL, "Another@2026!")
        }
        assertEquals("EMAIL_TAKEN", taken.code)

        val invalid = assertFailsWith<ApiException> { container.auth.signup("X", null, "new@kite.test", "short") }
        assertEquals("VALIDATION_ERROR", invalid.code)
        assertTrue("password" in invalid.fieldErrors)

        val user = container.auth.signup("Ravi Kumar", "Ravi Traders", "ravi@traders.test", "Ravi@2026!x")
        assertEquals("customer", user.role)
        assertEquals("Ravi Traders", container.auth.me().customer?.name)
    }

    @Test
    fun forgotPasswordAlwaysSucceeds() = runBlocking<Unit> {
        assertTrue(container.auth.forgotPassword(MockApi.CUSTOMER_EMAIL).ok)
        assertTrue(container.auth.forgotPassword("nobody@nowhere.test").ok)
    }

    @Test
    fun staleTokenLogsOut() = runBlocking<Unit> {
        container.auth.login(MockApi.CUSTOMER_EMAIL, MockApi.CUSTOMER_PASSWORD)
        // Changing the password invalidates every older token; simulate a stale one.
        val oldToken = container.session.token!!
        container.auth.changePassword(MockApi.CUSTOMER_PASSWORD, "Changed@2026!")
        val fresh = container.session.token!!
        assertTrue(oldToken != fresh)
        container.session.save(
            com.subscribby.mobile.data.model.Session(oldToken, container.session.currentUser!!),
        )
        val e = assertFailsWith<ApiException> { container.portal.summary() }
        assertEquals("UNAUTHENTICATED", e.code)
        assertIs<SessionState.LoggedOut>(container.session.state.value)
        assertNotNull(container.session.notice.value)
    }
}
