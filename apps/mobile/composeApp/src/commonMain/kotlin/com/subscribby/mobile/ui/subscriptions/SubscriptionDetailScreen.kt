package com.subscribby.mobile.ui.subscriptions

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.subscribby.mobile.data.model.SubscriptionDetail
import com.subscribby.mobile.ui.LocalAppContainer
import com.subscribby.mobile.ui.components.ConfirmDialog
import com.subscribby.mobile.ui.components.DocNumber
import com.subscribby.mobile.ui.components.ErrorState
import com.subscribby.mobile.ui.components.FormBanner
import com.subscribby.mobile.ui.components.GroupGap
import com.subscribby.mobile.ui.components.KeyValueRow
import com.subscribby.mobile.ui.components.LinesLedger
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
import com.subscribby.mobile.ui.components.TotalsBlock
import com.subscribby.mobile.ui.components.dataOrNull
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.ui.theme.StatusColors
import com.subscribby.mobile.util.Labels
import com.subscribby.mobile.util.formatDate
import com.subscribby.mobile.util.formatMoney

/** Destructive customer actions get a red confirm button. */
private val DESTRUCTIVE = setOf("reject", "close")

/** Actions that move a subscription forward get the filled button. */
private val PRIMARY = setOf("accept", "resume", "renew")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubscriptionDetailScreen(id: String, onBack: () -> Unit, backLabel: String = "Home") {
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
        containerColor = Palette.Paper,
        topBar = { ScreenHeader(title = null, backLabel = backLabel, onBack = onBack) },
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
                LoadState.Loading -> ScreenSkeleton(rows = 2)
                is LoadState.Error -> ErrorState("Couldn't load this subscription. ${state.message}", onRetry = vm::load)
                is LoadState.Success -> SubscriptionContent(state.data)
            }
        }
    }

    val pending = vm.pendingAction
    if (pending != null && detail != null) {
        val (title, message) = Labels.actionConfirm(
            pending,
            detail.number,
            startDate = formatDate(detail.startDate),
            price = "${formatMoney(detail.recurringTotal ?: detail.totals.total)} per ${Labels.billingPeriod(detail.plan.billingPeriod)}",
        )
        ConfirmDialog(
            title = title,
            message = message,
            confirmLabel = Labels.action(pending),
            destructive = pending in DESTRUCTIVE,
            dismissLabel = "Not now",
            onConfirm = vm::confirmPendingAction,
            onDismiss = vm::dismissDialog,
        )
    }
}

/** White bar with a hairline on top. Secondary actions on the left, the primary one on the right. */
@Composable
private fun ActionBar(actions: List<String>, running: String?, onAction: (String) -> Unit) {
    Column(Modifier.fillMaxWidth().background(Palette.Surface)) {
        PanelDivider()
        Row(
            Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = ScreenPadding, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            actions.sortedBy { it in PRIMARY }.forEach { action ->
                val modifier = Modifier.weight(1f).testTag("action-$action")
                val busy = running == action
                if (action in PRIMARY) {
                    PrimaryButton(Labels.action(action), onClick = { onAction(action) }, enabled = running == null, loading = busy, modifier = modifier)
                } else {
                    SecondaryButton(
                        Labels.action(action),
                        onClick = { onAction(action) },
                        enabled = running == null,
                        loading = busy,
                        destructive = action in DESTRUCTIVE,
                        modifier = modifier,
                    )
                }
            }
        }
    }
}

@Composable
private fun SubscriptionContent(sub: SubscriptionDetail) {
    val period = Labels.billingPeriod(sub.plan.billingPeriod)
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = ScreenPadding).padding(top = 4.dp, bottom = 32.dp),
    ) {
        // Header: number, plan, status, then the price as the focal figure.
        DocNumber(sub.number, size = 13.sp)
        Spacer(Modifier.height(2.dp))
        Text(sub.plan.name, style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(6.dp))
        SubscriptionStatus(sub.status, Modifier.testTag("subscription-status"))
        Spacer(Modifier.height(16.dp))
        Row(verticalAlignment = Alignment.Bottom) {
            Money(sub.recurringTotal ?: sub.totals.total, style = MaterialTheme.typography.titleMedium.copy(fontSize = 22.sp, lineHeight = 28.sp))
            Text(" per $period, tax included", style = MaterialTheme.typography.bodyMedium, color = Palette.TextMuted)
        }
        Labels.closeReason(sub.closeReason)?.let {
            Text(it, style = MaterialTheme.typography.bodyMedium, color = Palette.TextMuted)
        }
        if ("accept" in sub.allowedActions) {
            Spacer(Modifier.height(4.dp))
            Text(
                "Check the lines below, then accept" + (sub.quotationValidUntil?.let { " by ${formatDate(it)}" } ?: "") + ".",
                style = MaterialTheme.typography.bodyMedium,
                color = StatusColors.quotation,
            )
        }
        if (sub.isExpired) {
            Spacer(Modifier.height(12.dp))
            FormBanner("This subscription is past its expiry date, so billing has stopped.")
        }

        Spacer(Modifier.height(GroupGap))
        SectionTitle("Details")
        Panel {
            val rows = buildList {
                add("Start date" to formatDate(sub.startDate))
                add("Expiry date" to formatDate(sub.expiryDate))
                if (sub.status == "quotation") add("Quotation valid until" to formatDate(sub.quotationValidUntil))
                if (sub.nextInvoiceDate != null) add("Next invoice" to formatDate(sub.nextInvoiceDate))
                sub.paymentTermDays?.let { add("Payment terms" to if (it == 0) "Due on receipt" else "$it days") }
                add("Billed" to "Every $period")
            }
            rows.forEachIndexed { index, (label, value) ->
                if (index > 0) PanelDivider()
                KeyValueRow(label, value)
            }
        }

        Spacer(Modifier.height(GroupGap))
        SectionTitle("Lines", trailing = "${sub.lines.size} ${if (sub.lines.size == 1) "line" else "lines"}")
        Panel {
            LinesLedger(sub.lines)
            PanelDivider()
            TotalsBlock(
                untaxedAmount = sub.totals.untaxedAmount,
                discountTotal = sub.totals.discountTotal,
                taxTotal = sub.totals.taxTotal,
                total = sub.totals.total,
                orderDiscount = sub.orderDiscount,
            )
        }

        sub.invoiceSummary?.takeIf { it.count > 0 }?.let { summary ->
            Spacer(Modifier.height(GroupGap))
            SectionTitle("Invoices")
            Panel {
                KeyValueRow("Invoices so far", summary.count.toString())
                PanelDivider()
                KeyValueRow("Outstanding", formatMoney(summary.outstandingAmount))
                summary.lastInvoice?.let {
                    PanelDivider()
                    KeyValueRow("Latest") { DocNumber(it.number, size = 13.sp, color = Palette.Text) }
                }
            }
        }
    }
}
