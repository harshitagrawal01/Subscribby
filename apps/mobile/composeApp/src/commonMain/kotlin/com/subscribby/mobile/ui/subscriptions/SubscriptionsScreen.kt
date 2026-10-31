package com.subscribby.mobile.ui.subscriptions

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.subscribby.mobile.data.model.InvoiceListItem
import com.subscribby.mobile.data.model.PendingQuotation
import com.subscribby.mobile.data.model.PortalSummary
import com.subscribby.mobile.data.model.SubscriptionListItem
import com.subscribby.mobile.data.repo.SessionState
import com.subscribby.mobile.ui.LocalAppContainer
import com.subscribby.mobile.ui.components.AppIcons
import com.subscribby.mobile.ui.components.BrandMark
import com.subscribby.mobile.ui.components.DocNumber
import com.subscribby.mobile.ui.components.Dot
import com.subscribby.mobile.ui.components.EmptyState
import com.subscribby.mobile.ui.components.ErrorState
import com.subscribby.mobile.ui.components.GroupGap
import com.subscribby.mobile.ui.components.HeaderIconButton
import com.subscribby.mobile.ui.components.KeyValueRow
import com.subscribby.mobile.ui.components.LoadState
import com.subscribby.mobile.ui.components.Money
import com.subscribby.mobile.ui.components.Panel
import com.subscribby.mobile.ui.components.PanelDivider
import com.subscribby.mobile.ui.components.PrimaryButton
import com.subscribby.mobile.ui.components.ScreenHeader
import com.subscribby.mobile.ui.components.ScreenPadding
import com.subscribby.mobile.ui.components.ScreenSkeleton
import com.subscribby.mobile.ui.components.SecondaryButton
import com.subscribby.mobile.ui.components.SectionTitle
import com.subscribby.mobile.ui.components.SubscriptionStatus
import com.subscribby.mobile.ui.components.TertiaryButton
import com.subscribby.mobile.ui.components.rowClickable
import com.subscribby.mobile.ui.components.withDocNumbers
import com.subscribby.mobile.ui.theme.LocalHeroStyle
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.ui.theme.StatusColors
import com.subscribby.mobile.util.Labels
import com.subscribby.mobile.util.formatDate
import com.subscribby.mobile.util.formatMoney

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubscriptionsScreen(onOpenSubscription: (String) -> Unit, onOpenInvoices: () -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel { SubscriptionsViewModel(container.portal) }
    val session by container.session.state.collectAsStateWithLifecycle()
    val company = (session as? SessionState.LoggedIn)?.user?.customer?.name
    // Re-runs every time the tab is shown again, so data is fresh after accepting a quotation.
    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = Palette.Paper,
        topBar = {
            ScreenHeader(title = null) {
                Row(Modifier.weight(1f).padding(start = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    BrandMark()
                    if (company != null) {
                        Text(
                            company,
                            style = MaterialTheme.typography.bodySmall,
                            color = Palette.TextMuted,
                            textAlign = TextAlign.End,
                            maxLines = 1,
                            modifier = Modifier.weight(1f).padding(start = 12.dp),
                        )
                    }
                }
                HeaderIconButton(AppIcons.Refresh, "Refresh", vm::load)
            }
        },
    ) { padding ->
        val state = vm.state
        PullToRefreshBox(
            isRefreshing = state is LoadState.Success && state.refreshing,
            onRefresh = vm::load,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            when (state) {
                LoadState.Loading -> ScreenSkeleton()
                is LoadState.Error -> ErrorState("Couldn't load your account. ${state.message}", onRetry = vm::load)
                is LoadState.Success -> HomeContent(state.data, onOpenSubscription, onOpenInvoices, onReload = vm::load)
            }
        }
    }
}

@Composable
private fun HomeContent(data: HomeData, onOpen: (String) -> Unit, onOpenInvoices: () -> Unit, onReload: () -> Unit) {
    val periodsById = data.subscriptions.associate { it.id to it.plan.billingPeriod }
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .testTag("subscriptions-list")
            .padding(horizontal = ScreenPadding)
            .padding(top = 8.dp, bottom = 32.dp),
    ) {
        AmountDue(data, onOpenInvoices)

        if (data.summary.pendingQuotations.isNotEmpty()) {
            Spacer(Modifier.height(GroupGap))
            SectionTitle("Waiting for your approval")
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                data.summary.pendingQuotations.forEachIndexed { index, quotation ->
                    // Only the first quotation gets the filled button: one primary action per screen.
                    PendingQuotationPanel(quotation, periodsById[quotation.id], primary = index == 0, onClick = { onOpen(quotation.id) })
                }
            }
        }

        Spacer(Modifier.height(GroupGap))
        SectionTitle("Subscriptions", trailing = data.subscriptions.size.takeIf { it > 0 }?.toString())
        if (data.subscriptions.isEmpty()) {
            EmptyState(
                "You have no subscriptions yet. Quotations sent to you will appear here.",
                actionLabel = "Check again",
                onAction = onReload,
            )
        } else {
            Panel {
                data.subscriptions.forEachIndexed { index, sub ->
                    if (index > 0) PanelDivider()
                    SubscriptionRow(sub, onClick = { onOpen(sub.id) })
                }
            }
        }
    }
}

/** The focal point: what the customer owes and when, or else their next payment. */
@Composable
private fun AmountDue(data: HomeData, onOpenInvoices: () -> Unit) {
    val summary = data.summary
    val next = summary.nextInvoice
    val owes = summary.outstandingAmount > 0
    Column(Modifier.fillMaxWidth().testTag("summary-card")) {
        Text(
            if (owes || next == null) "Amount due" else "Next payment",
            style = MaterialTheme.typography.labelMedium,
            color = Palette.TextMuted,
        )
        Spacer(Modifier.height(4.dp))
        Money(if (owes || next == null) summary.outstandingAmount else next.amount, style = LocalHeroStyle.current)
        Spacer(Modifier.height(6.dp))
        DueNote(summary, data.unpaid, owes)
        if (owes) {
            TertiaryButton(
                onClick = onOpenInvoices,
                contentPadding = PaddingValues(0.dp),
            ) { Text("See unpaid invoices", style = MaterialTheme.typography.labelLarge) }
        }

        Spacer(Modifier.height(if (owes) 12.dp else 20.dp))
        Panel {
            if (owes && next != null) {
                KeyValueRow("Next invoice") {
                    Text("${formatMoney(next.amount)} on ${formatDate(next.date)}", style = MaterialTheme.typography.bodyMedium)
                }
                PanelDivider()
            }
            KeyValueRow("Active subscriptions", summary.activeSubscriptions.toString())
            if (summary.overdueCount > 0) {
                PanelDivider()
                KeyValueRow("Overdue invoices") {
                    Text(summary.overdueCount.toString(), style = MaterialTheme.typography.bodyMedium, color = StatusColors.overdue)
                }
            }
        }
    }
}

@Composable
private fun DueNote(summary: PortalSummary, unpaid: List<InvoiceListItem>, owes: Boolean) {
    val next = summary.nextInvoice
    val overdue = unpaid.filter { it.isOverdue }.sortedByDescending { it.daysOverdue }
    val (text, color) = when {
        overdue.size == 1 -> "${overdue[0].number} is ${days(overdue[0].daysOverdue)} overdue" to StatusColors.overdue
        overdue.size > 1 -> "${overdue.size} invoices overdue, the oldest by ${days(overdue[0].daysOverdue)}" to StatusColors.overdue
        summary.overdueCount > 0 -> "${summary.overdueCount} overdue ${if (summary.overdueCount == 1) "invoice" else "invoices"}" to StatusColors.overdue
        owes && unpaid.isNotEmpty() -> {
            val first = unpaid.minBy { it.dueDate }
            "Due ${formatDate(first.dueDate)} for ${first.number}" to Palette.TextMuted
        }
        owes -> "Across your unpaid invoices" to Palette.TextMuted
        next != null -> "Billed on ${formatDate(next.date)} for ${next.subscriptionNumber}" to Palette.TextMuted
        else -> "Nothing is due. You're paid up." to Palette.TextMuted
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (color == StatusColors.overdue) Dot(color)
        Text(withDocNumbers(text), style = MaterialTheme.typography.bodyMedium, color = color)
    }
}

private fun days(n: Int) = if (n == 1) "1 day" else "$n days"

@Composable
private fun PendingQuotationPanel(quotation: PendingQuotation, billingPeriod: String?, primary: Boolean, onClick: () -> Unit) {
    Panel(Modifier.testTag("pending-quotation")) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(quotation.plan.name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                SubscriptionStatus("quotation")
            }
            DocNumber(quotation.number)
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Money(quotation.recurringTotal, style = MaterialTheme.typography.titleMedium)
                Text(
                    " per ${Labels.billingPeriod(billingPeriod ?: quotation.plan.billingPeriod)}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Palette.TextMuted,
                )
            }
            quotation.quotationValidUntil?.let {
                Text("Accept by ${formatDate(it)} to start this subscription.", style = MaterialTheme.typography.bodySmall, color = Palette.TextMuted)
            }
            Spacer(Modifier.height(16.dp))
            if (primary) PrimaryButton("Review quotation", onClick = onClick)
            else SecondaryButton("Review quotation", onClick = onClick)
        }
    }
}

@Composable
private fun SubscriptionRow(sub: SubscriptionListItem, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().rowClickable(onClick).padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Column(Modifier.weight(1f).padding(end = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(sub.plan.name, style = MaterialTheme.typography.titleSmall)
            DocNumber(sub.number)
            Text(subscriptionDateLine(sub), style = MaterialTheme.typography.bodySmall, color = Palette.TextMuted)
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.Bottom) {
                Money(sub.recurringTotal, style = MaterialTheme.typography.titleSmall)
                Text(
                    " / ${Labels.billingPeriod(sub.plan.billingPeriod)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = Palette.TextMuted,
                )
            }
            SubscriptionStatus(sub.status)
        }
    }
}

private fun subscriptionDateLine(sub: SubscriptionListItem): String = when (sub.status) {
    "quotation" -> "Valid until ${formatDate(sub.quotationValidUntil)}"
    "confirmed" -> "Starts ${formatDate(sub.startDate)}"
    "closed" -> Labels.closeReason(sub.closeReason) ?: "Closed"
    "paused" -> "No invoices while paused"
    else -> sub.nextInvoiceDate?.let { "Next invoice ${formatDate(it)}" } ?: "Ends ${formatDate(sub.expiryDate)}"
}
