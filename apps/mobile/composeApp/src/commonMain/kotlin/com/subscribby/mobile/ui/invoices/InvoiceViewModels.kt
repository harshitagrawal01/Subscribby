package com.subscribby.mobile.ui.invoices

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.subscribby.mobile.data.api.userMessage
import com.subscribby.mobile.data.model.InvoiceDetail
import com.subscribby.mobile.data.model.InvoiceListItem
import com.subscribby.mobile.data.repo.InvoiceFilter
import com.subscribby.mobile.data.repo.PortalRepository
import com.subscribby.mobile.ui.components.LoadState
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class InvoicesViewModel(private val portal: PortalRepository) : ViewModel() {
    var filter by mutableStateOf(InvoiceFilter.All)
        private set

    var state by mutableStateOf<LoadState<List<InvoiceListItem>>>(LoadState.Loading)
        private set

    private var job: Job? = null

    fun selectFilter(value: InvoiceFilter) {
        if (value == filter) return
        filter = value
        state = LoadState.Loading
        load()
    }

    fun load() {
        val current = state
        state = if (current is LoadState.Success) current.copy(refreshing = true) else LoadState.Loading
        val requested = filter
        job?.cancel()
        job = viewModelScope.launch {
            state = try {
                LoadState.Success(portal.invoices(requested).items)
            } catch (e: Exception) {
                if (current is LoadState.Success) current.copy(refreshing = false) else LoadState.Error(e.userMessage())
            }
        }
    }
}

class InvoiceDetailViewModel(private val portal: PortalRepository, private val id: String) : ViewModel() {
    var state by mutableStateOf<LoadState<InvoiceDetail>>(LoadState.Loading)
        private set

    fun load() {
        val current = state
        state = if (current is LoadState.Success) current.copy(refreshing = true) else LoadState.Loading
        viewModelScope.launch {
            state = try {
                LoadState.Success(portal.invoice(id))
            } catch (e: Exception) {
                if (current is LoadState.Success) current.copy(refreshing = false) else LoadState.Error(e.userMessage())
            }
        }
    }
}
