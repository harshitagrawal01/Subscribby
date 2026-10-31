package com.subscribby.mobile.ui.invoices

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.subscribby.mobile.data.model.InvoiceDetail
import com.subscribby.mobile.data.model.InvoiceListItem
import com.subscribby.mobile.data.repo.InvoiceFilter
import com.subscribby.mobile.ui.LocalAppContainer
import com.subscribby.mobile.ui.components.BackButton
import com.subscribby.mobile.ui.components.EmptyView
import com.subscribby.mobile.ui.components.ErrorView
import com.subscribby.mobile.ui.components.InvoiceStatusChip
import com.subscribby.mobile.ui.components.LabelValueRow
import com.subscribby.mobile.ui.components.LinesCard
import com.subscribby.mobile.ui.components.LoadState
import com.subscribby.mobile.ui.components.LoadingView
import com.subscribby.mobile.ui.components.SectionCard
import com.subscribby.mobile.ui.components.TotalsCard
import com.subscribby.mobile.ui.components.dataOrNull
import com.subscribby.mobile.util.Labels
import com.subscribby.mobile.util.formatDate
import com.subscribby.mobile.util.formatMoney

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoicesScreen(onOpenInvoice: (String) -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel { InvoicesViewModel(container.portal) }
    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Invoices") },
                actions = { IconButton(onClick = vm::load) { Icon(Icons.Default.Refresh, contentDescription = "Refresh") } },
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
                val filters = InvoiceFilter.entries
                filters.forEachIndexed { index, filter ->
                    SegmentedButton(
                        selected = vm.filter == filter,
                        onClick = { vm.selectFilter(filter) },
                        shape = SegmentedButtonDefaults.itemShape(index, filters.size),
                        modifier = Modifier.testTag("filter-${filter.name}"),
                    ) { Text(filter.label) }
                }
            }
            val state = vm.state
            PullToRefreshBox(
                isRefreshing = state is LoadState.Success && state.refreshing,
                onRefresh = vm::load,
                modifier = Modifier.fillMaxSize(),
            ) {
                when (state) {
                    LoadState.Loading -> LoadingView()
                    is LoadState.Error -> ErrorView(state.message, onRetry = vm::load)
                    is LoadState.Success ->
                        if (state.data.isEmpty()) {
                            EmptyView(
                                title = when (vm.filter) {
                                    InvoiceFilter.Unpaid -> "Nothing to pay"
                                    InvoiceFilter.Paid -> "No paid invoices yet"
                                    InvoiceFilter.All -> "No invoices yet"
                                },
                                message = "Invoices appear here once Brightloop bills your subscriptions.",
                                // Keeps pull-to-refresh working on an empty list.
                                modifier = Modifier.verticalScroll(rememberScrollState()),
                            )
                        } else {
                            LazyColumn(
                                Modifier.fillMaxSize().testTag("invoices-list"),
                                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 16.dp, top = 4.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                items(state.data, key = { it.id }) { invoice -> InvoiceRow(invoice) { onOpenInvoice(invoice.id) } }
                            }
                        }
                }
            }
        }
    }
}

@Composable
private fun InvoiceRow(invoice: InvoiceListItem, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(invoice.number, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                InvoiceStatusChip(invoice.status, invoice.isOverdue)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        if (invoice.isOverdue) "Overdue by ${invoice.daysOverdue} day${if (invoice.daysOverdue == 1) "" else "s"}"
                        else "Due ${formatDate(invoice.dueDate)}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (invoice.isOverdue) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    invoice.subscription?.let {
                        Text(it.number, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(formatMoney(invoice.total), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    if (invoice.balance > 0 && invoice.status == "confirmed" && invoice.balance != invoice.total) {
                        Text("Balance ${formatMoney(invoice.balance)}", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoiceDetailScreen(id: String, onBack: () -> Unit, onOpenSubscription: (String) -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel(key = "invoice-$id") { InvoiceDetailViewModel(container.portal, id) }
    LaunchedEffect(Unit) { vm.load() }
    val state = vm.state

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.dataOrNull?.number ?: "Invoice") },
                navigationIcon = { BackButton(onBack) },
            )
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state is LoadState.Success && state.refreshing,
            onRefresh = vm::load,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            when (state) {
                LoadState.Loading -> LoadingView()
                is LoadState.Error -> ErrorView(state.message, onRetry = vm::load)
                is LoadState.Success -> InvoiceContent(state.data, onOpenSubscription)
            }
        }
    }
}

@Composable
private fun InvoiceContent(invoice: InvoiceDetail, onOpenSubscription: (String) -> Unit) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SectionCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(invoice.number, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                InvoiceStatusChip(invoice.status, invoice.isOverdue)
            }
            LabelValueRow("Balance due", formatMoney(invoice.balance), emphasized = true)
            if (invoice.isOverdue) {
                Text(
                    "Overdue by ${invoice.daysOverdue} day${if (invoice.daysOverdue == 1) "" else "s"}",
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }

        SectionCard(title = "Details") {
            LabelValueRow("Invoice date", formatDate(invoice.invoiceDate))
            LabelValueRow("Due date", formatDate(invoice.dueDate))
            if (invoice.periodStart != null || invoice.periodEnd != null) {
                LabelValueRow("Period", "${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}")
            }
            invoice.subscription?.let { sub ->
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Subscription",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = { onOpenSubscription(sub.id) }) { Text(sub.number) }
                }
            }
        }

        val billedTo = invoice.customerSnapshot
        val from = invoice.company
        if (billedTo != null || from != null) {
            SectionCard(title = "Parties") {
                billedTo?.let {
                    PartyBlock("Billed to", it.name, it.billingAddress?.singleLine(), it.taxId)
                }
                if (billedTo != null && from != null) HorizontalDivider()
                from?.let { PartyBlock("From", it.name, it.address, it.taxId) }
            }
        }

        LinesCard(invoice.lines)

        TotalsCard(
            untaxedAmount = invoice.untaxedAmount,
            discountTotal = invoice.discountTotal,
            taxTotal = invoice.taxTotal,
            total = invoice.total,
            orderDiscount = invoice.orderDiscount,
        ) {
            LabelValueRow("Paid", formatMoney(invoice.amountPaid))
            LabelValueRow("Balance", formatMoney(invoice.balance), emphasized = true)
        }

        SectionCard(title = "Payments") {
            if (invoice.payments.isEmpty()) {
                Text("No payments yet", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            invoice.payments.forEachIndexed { index, payment ->
                if (index > 0) HorizontalDivider()
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("${formatDate(payment.paymentDate)} · ${Labels.paymentMethod(payment.method)}", style = MaterialTheme.typography.bodyMedium)
                        payment.note?.takeIf { it.isNotBlank() }?.let {
                            Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    Text(formatMoney(payment.amount), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun PartyBlock(label: String, name: String, address: String?, taxId: String?) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
        address?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        taxId?.takeIf { it.isNotBlank() }?.let { Text("GSTIN $it", style = MaterialTheme.typography.bodySmall) }
    }
}
