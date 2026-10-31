package com.subscribby.mobile

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.v2.runComposeUiTest
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import com.subscribby.mobile.data.AppContainer
import com.subscribby.mobile.platform.InMemoryKeyValueStore
import com.subscribby.mobile.ui.App
import kotlin.test.AfterTest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import kotlin.test.BeforeTest
import kotlin.test.Test

/**
 * Headless end-to-end check of the shared Compose UI on the desktop target against the mock API:
 * log in → home (summary + pending quotation) → open quotation → Accept → confirm → status updates
 * → invoices tab → profile → log out. Also checks a staff account is refused.
 */
@OptIn(ExperimentalTestApi::class, ExperimentalCoroutinesApi::class)
class UiFlowTest {
    private lateinit var container: AppContainer

    @BeforeTest
    fun setUp() {
        // The UI test drives composition from the test thread, but Lifecycle/Navigation insist that
        // state changes happen on the "main" thread (= wherever Dispatchers.Main runs). An unconfined
        // Main makes the test thread count as main and lets ViewModel coroutines resume anywhere.
        Dispatchers.setMain(Dispatchers.Unconfined)
        MockApi.requireRunning()
        MockApi.reset()
        container = AppContainer(store = InMemoryKeyValueStore(), baseUrl = MockApi.baseUrl, logging = false)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
        if (::container.isInitialized) container.api.close()
        runCatching { MockApi.reset() }
    }

    private val owners = object : ViewModelStoreOwner, LifecycleOwner {
        override val viewModelStore = ViewModelStore()
        private val registry = LifecycleRegistry.createUnsafe(this).apply { currentState = Lifecycle.State.RESUMED }
        override val lifecycle: Lifecycle get() = registry
    }

    private fun ComposeUiTest.waitForText(text: String, substring: Boolean = false) {
        waitUntil(timeoutMillis = 15_000) {
            onAllNodes(hasText(text, substring = substring)).fetchSemanticsNodes().isNotEmpty()
        }
    }

    @Test
    fun loginAcceptQuotationAndLogOut() = runComposeUiTest {
        setContent {
            CompositionLocalProvider(LocalViewModelStoreOwner provides owners, LocalLifecycleOwner provides owners) {
                App(container)
            }
        }

        // Login
        onNodeWithTag("login-email").performTextInput(MockApi.CUSTOMER_EMAIL)
        onNodeWithTag("login-password").performTextInput(MockApi.CUSTOMER_PASSWORD)
        onNodeWithTag("login-submit").performClick()

        // Home: summary card + pending quotation from /portal/summary
        waitForText("My subscriptions")
        waitForText("Quotation waiting for you")
        onNodeWithText("₹2,950.00").assertExists() // outstanding for Kite Stores
        onNodeWithTag("subscriptions-list").performScrollToNode(hasText("Basic Monthly"))

        // Open the quotation and accept it (buttons come from allowedActions)
        onNodeWithText("Review quotation").performClick()
        waitForText("SUB/2026/0049")
        waitUntil(timeoutMillis = 15_000) { onAllNodes(hasTestTag("action-accept")).fetchSemanticsNodes().isNotEmpty() }
        onNodeWithTag("action-reject").assertExists()
        onNodeWithTag("action-accept").performClick()
        waitForText("Accept quotation?")
        // The dialog's confirm button shares the label; it is the last "Accept quotation" node.
        onAllNodes(hasText("Accept quotation")).let { nodes ->
            val count = nodes.fetchSemanticsNodes().size
            nodes[count - 1].performClick()
        }
        waitUntil(timeoutMillis = 15_000) { onAllNodes(hasTestTag("action-accept")).fetchSemanticsNodes().isEmpty() }
        waitForText("Confirmed")

        // Back to home: the pending quotation is gone
        onNode(hasContentDescription("Back")).performClick()
        waitForText("My subscriptions")
        waitUntil(timeoutMillis = 15_000) { onAllNodes(hasText("Quotation waiting for you")).fetchSemanticsNodes().isEmpty() }

        // Invoices tab with filter
        onNodeWithTag("tab-Invoices").performClick()
        waitForText("INV/2026/0152")
        onNodeWithTag("filter-Paid").performClick()
        waitForText("INV/2026/0106")
        waitUntil(timeoutMillis = 15_000) { onAllNodes(hasText("INV/2026/0152")).fetchSemanticsNodes().isEmpty() }
        onNodeWithText("INV/2026/0106").performClick()
        waitForText("Payments")
        waitForText("UPI", substring = true)
        onNode(hasContentDescription("Back")).performClick()

        // Profile → log out
        onNodeWithTag("tab-Profile").performClick()
        waitForText("Kite Stores")
        onNodeWithText("Log out").performClick()
        waitForText("Log out?")
        onAllNodes(hasText("Log out")).let { nodes -> nodes[nodes.fetchSemanticsNodes().size - 1].performClick() }
        waitForText("Manage your subscriptions and invoices.")
    }

    @Test
    fun staffAccountIsRefused() = runComposeUiTest {
        setContent {
            CompositionLocalProvider(LocalViewModelStoreOwner provides owners, LocalLifecycleOwner provides owners) {
                App(container)
            }
        }
        onNodeWithTag("login-email").performTextInput(MockApi.STAFF_EMAIL)
        onNodeWithTag("login-password").performTextInput("Welcome@2026!")
        onNodeWithTag("login-submit").performClick()
        waitForText("Wrong email or password.")
    }
}

