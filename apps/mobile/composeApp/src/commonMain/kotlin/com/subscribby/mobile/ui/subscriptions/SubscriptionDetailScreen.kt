package com.subscribby.mobile.ui.subscriptions

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.subscribby.mobile.data.model.SubscriptionDetail
import com.subscribby.mobile.ui.LocalAppContainer
import com.subscribby.mobile.ui.components.BackButton
import com.subscribby.mobile.ui.components.ConfirmDialog
import com.subscribby.mobile.ui.components.ErrorView
import com.subscribby.mobile.ui.components.FormBanner
import com.subscribby.mobile.ui.components.LabelValueRow
import com.subscribby.mobile.ui.components.LinesCard
import com.subscribby.mobile.ui.components.LoadState
import com.subscribby.mobile.ui.components.LoadingView
import com.subscribby.mobile.ui.components.SectionCard
import com.subscribby.mobile.ui.components.SubscriptionStatusChip
import com.subscribby.mobile.ui.components.TotalsCard
import com.subscribby.mobile.ui.components.dataOrNull
import com.subscribby.mobile.util.Labels
import com.subscribby.mobile.util.formatDate
import com.subscribby.mobile.util.formatMoney

/** Destructive customer actions get a red confirm button. */
private val DESTRUCTIVE = setOf("reject", "close")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubscriptionDetailScreen(id: String, onBack: () -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel(key = "subscription-$id") { SubscriptionDetailViewModel(container.portal, id) }
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(Unit) { vm.load() }
    LaunchedEffect(vm.message) {
        vm.message?.let {
            snackbar.showSnackbar(it)
            vm.messageShown()
        }
    }

    val state = vm.state
    val detail = state.dataOrNull

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(detail?.number ?: "Subscription") },
                navigationIcon = { BackButton(onBack) },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            // Buttons come only from the server's allowedActions, never from local status logic.
            if (detail != null && detail.allowedActions.isNotEmpty()) {
                ActionBar(detail.allowedActions, vm.runningAction, onAction = vm::askToRun)
            }
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
                is LoadState.Success -> SubscriptionContent(state.data)
            }
        }
    }

    val pending = vm.pendingAction
    if (pending != null && detail != null) {
        val (title, message) = Labels.actionConfirm(pending, detail.number)
        ConfirmDialog(
            title = title,
            message = message,
            confirmLabel = Labels.action(pending),
            destructive = pending in DESTRUCTIVE,
            onConfirm = vm::confirmPendingAction,
            onDismiss = vm::dismissDialog,
        )
    }
}

@Composable
private fun ActionBar(actions: List<String>, running: String?, onAction: (String) -> Unit) {
    Surface(tonalElevation = 3.dp, shadowElevation = 6.dp) {
        Row(
            Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            actions.forEach { action ->
                val busy = running == action
                val modifier = Modifier.weight(1f).height(48.dp).testTag("action-$action")
                val content: @Composable () -> Unit = {
                    if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text(Labels.action(action))
                }
                when (action) {
                    "accept", "resume", "renew" ->
                        Button(onClick = { onAction(action) }, enabled = running == null, modifier = modifier) { content() }
                    else -> OutlinedButton(
                        onClick = { onAction(action) },
                        enabled = running == null,
                        modifier = modifier,
                        colors = if (action in DESTRUCTIVE) {
                            ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
                        } else {
                            ButtonDefaults.outlinedButtonColors()
                        },
                    ) { content() }
                }
            }
        }
    }
}

@Composable
private fun SubscriptionContent(sub: SubscriptionDetail) {
    val period = Labels.billingPeriod(sub.plan.billingPeriod)
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SectionCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(sub.plan.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    Text(sub.number, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                SubscriptionStatusChip(sub.status, Modifier.testTag("subscription-status"))
            }
            Text(
                "${formatMoney(sub.recurringTotal ?: sub.totals.total)} per $period, tax included",
                style = MaterialTheme.typography.bodyLarge,
            )
            Labels.closeReason(sub.closeReason)?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        if ("accept" in sub.allowedActions) {
            FormBanner(
                "Review the items below and accept this quotation" +
                    (sub.quotationValidUntil?.let { " before ${formatDate(it)}" } ?: "") + ".",
                success = true,
            )
        }
        if (sub.isExpired) FormBanner("This subscription is past its expiry date. Billing has stopped.")

        SectionCard(title = "Dates") {
            LabelValueRow("Start date", formatDate(sub.startDate))
            LabelValueRow("Expiry date", formatDate(sub.expiryDate))
            if (sub.status == "quotation") LabelValueRow("Quotation valid until", formatDate(sub.quotationValidUntil))
            if (sub.nextInvoiceDate != null) LabelValueRow("Next invoice", formatDate(sub.nextInvoiceDate))
            sub.paymentTermDays?.let { LabelValueRow("Payment terms", if (it == 0) "Due immediately" else "$it days") }
            LabelValueRow("Billing", "Every $period")
        }

        LinesCard(sub.lines)

        TotalsCard(
            untaxedAmount = sub.totals.untaxedAmount,
            discountTotal = sub.totals.discountTotal,
            taxTotal = sub.totals.taxTotal,
            total = sub.totals.total,
            orderDiscount = sub.orderDiscount,
        )

        sub.invoiceSummary?.takeIf { it.count > 0 }?.let { summary ->
            SectionCard(title = "Invoices") {
                LabelValueRow("Invoices so far", summary.count.toString())
                LabelValueRow("Outstanding", formatMoney(summary.outstandingAmount))
                summary.lastInvoice?.let { LabelValueRow("Latest", it.number) }
            }
        }
    }
}
