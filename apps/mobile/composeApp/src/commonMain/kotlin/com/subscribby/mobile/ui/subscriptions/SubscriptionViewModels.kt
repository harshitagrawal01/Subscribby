package com.subscribby.mobile.ui.subscriptions

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.subscribby.mobile.data.api.userMessage
import com.subscribby.mobile.data.model.InvoiceListItem
import com.subscribby.mobile.data.model.PortalSummary
import com.subscribby.mobile.data.model.SubscriptionDetail
import com.subscribby.mobile.data.model.SubscriptionListItem
import com.subscribby.mobile.data.repo.InvoiceFilter
import com.subscribby.mobile.data.repo.PortalRepository
import com.subscribby.mobile.ui.components.LoadState
import com.subscribby.mobile.util.Labels
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

/** [unpaid] gives the home screen a due date for the amount owed; it's optional. */
data class HomeData(
    val summary: PortalSummary,
    val subscriptions: List<SubscriptionListItem>,
    val unpaid: List<InvoiceListItem> = emptyList(),
)

class SubscriptionsViewModel(private val portal: PortalRepository) : ViewModel() {
    var state by mutableStateOf<LoadState<HomeData>>(LoadState.Loading)
        private set

    /** First call shows a spinner; later calls refresh behind the current data. */
    fun load() {
        val current = state
        state = if (current is LoadState.Success) current.copy(refreshing = true) else LoadState.Loading
        viewModelScope.launch {
            state = try {
                val data = coroutineScope {
                    val summary = async { portal.summary() }
                    val subs = async { portal.subscriptions().items }
                    val unpaid = async {
                        try {
                            portal.invoices(InvoiceFilter.Unpaid).items
                        } catch (e: CancellationException) {
                            throw e
                        } catch (_: Exception) {
                            emptyList()
                        }
                    }
                    HomeData(summary.await(), subs.await(), unpaid.await())
                }
                LoadState.Success(data)
            } catch (e: Exception) {
                if (current is LoadState.Success) current.copy(refreshing = false) else LoadState.Error(e.userMessage())
            }
        }
    }
}

class SubscriptionDetailViewModel(
    private val portal: PortalRepository,
    private val id: String,
) : ViewModel() {
    var state by mutableStateOf<LoadState<SubscriptionDetail>>(LoadState.Loading)
        private set

    /** Action waiting for the user to confirm in a dialog. */
    var pendingAction by mutableStateOf<String?>(null)
        private set

    /** Action currently running (buttons disabled). */
    var runningAction by mutableStateOf<String?>(null)
        private set

    /** One-off message for the snackbar. */
    var message by mutableStateOf<String?>(null)
        private set

    fun load() {
        val current = state
        state = if (current is LoadState.Success) current.copy(refreshing = true) else LoadState.Loading
        viewModelScope.launch {
            state = try {
                LoadState.Success(portal.subscription(id))
            } catch (e: Exception) {
                if (current is LoadState.Success) {
                    message = e.userMessage()
                    current.copy(refreshing = false)
                } else {
                    LoadState.Error(e.userMessage())
                }
            }
        }
    }

    fun askToRun(action: String) { pendingAction = action }
    fun dismissDialog() { pendingAction = null }
    fun messageShown() { message = null }

    fun confirmPendingAction() {
        val action = pendingAction ?: return
        pendingAction = null
        runningAction = action
        viewModelScope.launch {
            try {
                state = LoadState.Success(portal.runAction(id, action))
                message = Labels.actionDone(action)
            } catch (e: Exception) {
                message = e.userMessage()
            } finally {
                runningAction = null
            }
            load() // always show the server's latest state and allowedActions
        }
    }
}
