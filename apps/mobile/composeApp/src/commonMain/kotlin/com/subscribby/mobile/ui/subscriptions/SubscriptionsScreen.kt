package com.subscribby.mobile.ui.subscriptions

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
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
import com.subscribby.mobile.data.model.PendingQuotation
import com.subscribby.mobile.data.model.PortalSummary
import com.subscribby.mobile.data.model.SubscriptionListItem
import com.subscribby.mobile.ui.LocalAppContainer
import com.subscribby.mobile.ui.components.EmptyView
import com.subscribby.mobile.ui.components.ErrorView
import com.subscribby.mobile.ui.components.LoadState
import com.subscribby.mobile.ui.components.LoadingView
import com.subscribby.mobile.ui.components.SubscriptionStatusChip
import com.subscribby.mobile.util.Labels
import com.subscribby.mobile.util.formatDate
import com.subscribby.mobile.util.formatMoney

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubscriptionsScreen(onOpenSubscription: (String) -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel { SubscriptionsViewModel(container.portal) }
    // Re-runs every time the tab is shown again, so data is fresh after accepting a quotation.
    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("My subscriptions") },
                actions = { IconButton(onClick = vm::load) { Icon(Icons.Default.Refresh, contentDescription = "Refresh") } },
            )
        },
    ) { padding ->
        val state = vm.state
        PullToRefreshBox(
            isRefreshing = state is LoadState.Success && state.refreshing,
            onRefresh = vm::load,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            when (state) {
                LoadState.Loading -> LoadingView()
                is LoadState.Error -> ErrorView(state.message, onRetry = vm::load)
                is LoadState.Success -> HomeContent(state.data, onOpenSubscription)
            }
        }
    }
}

@Composable
private fun HomeContent(data: HomeData, onOpen: (String) -> Unit) {
    val periodsById = data.subscriptions.associate { it.id to it.plan.billingPeriod }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("subscriptions-list"),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { SummaryCard(data.summary) }
        items(data.summary.pendingQuotations, key = { "q-" + it.id }) { quotation ->
            PendingQuotationCard(quotation, periodsById[quotation.id], onClick = { onOpen(quotation.id) })
        }
        item {
            Text(
                "Subscriptions",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
        if (data.subscriptions.isEmpty()) {
            item {
                EmptyView(
                    title = "No subscriptions yet",
                    message = "When Brightloop sends you a quotation it will show up here.",
                    modifier = Modifier.padding(vertical = 24.dp),
                )
            }
        }
        items(data.subscriptions, key = { it.id }) { sub -> SubscriptionRow(sub, onClick = { onOpen(sub.id) }) }
    }
}

@Composable
private fun SummaryCard(summary: PortalSummary) {
    Card(
        modifier = Modifier.fillMaxWidth().testTag("summary-card"),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
        ),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Outstanding", style = MaterialTheme.typography.labelLarge)
            Text(formatMoney(summary.outstandingAmount), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                SummaryStat("Active", summary.activeSubscriptions.toString())
                SummaryStat("Overdue invoices", summary.overdueCount.toString())
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.3f))
            val next = summary.nextInvoice
            Text(
                if (next == null) "No upcoming invoice"
                else "Next invoice: ${formatMoney(next.amount)} on ${formatDate(next.date)} · ${next.subscriptionNumber}",
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun SummaryStat(label: String, value: String) {
    Column {
        Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        Text(label, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun PendingQuotationCard(quotation: PendingQuotation, billingPeriod: String?, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).testTag("pending-quotation"),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer,
            contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
        ),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Quotation waiting for you", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            Text("${quotation.plan.name} · ${quotation.number}", style = MaterialTheme.typography.titleMedium)
            Text(
                "${formatMoney(quotation.recurringTotal)} per ${Labels.billingPeriod(billingPeriod)}" +
                    (quotation.quotationValidUntil?.let { " · valid until ${formatDate(it)}" } ?: ""),
                style = MaterialTheme.typography.bodyMedium,
            )
            Button(onClick = onClick, modifier = Modifier.padding(top = 4.dp)) { Text("Review quotation") }
        }
    }
}

@Composable
private fun SubscriptionRow(sub: SubscriptionListItem, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(sub.plan.name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                SubscriptionStatusChip(sub.status)
            }
            Text(sub.number, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    subscriptionDateLine(sub),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    "${formatMoney(sub.recurringTotal)} / ${Labels.billingPeriod(sub.plan.billingPeriod)}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

private fun subscriptionDateLine(sub: SubscriptionListItem): String = when (sub.status) {
    "quotation" -> "Valid until ${formatDate(sub.quotationValidUntil)}"
    "confirmed" -> "Starts ${formatDate(sub.startDate)}"
    "closed" -> Labels.closeReason(sub.closeReason) ?: "Closed"
    "paused" -> "Paused"
    else -> sub.nextInvoiceDate?.let { "Next invoice ${formatDate(it)}" } ?: "Ends ${formatDate(sub.expiryDate)}"
}
