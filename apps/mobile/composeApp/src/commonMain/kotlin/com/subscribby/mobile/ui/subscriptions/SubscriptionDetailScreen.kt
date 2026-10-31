package com.subscribby.mobile.ui.subscriptions

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.subscribby.mobile.data.model.SubscriptionDetail
import com.subscribby.mobile.ui.LocalAppContainer
import com.subscribby.mobile.ui.components.ActionDock
import com.subscribby.mobile.ui.components.AppIcons
import com.subscribby.mobile.ui.components.AppSnack
import com.subscribby.mobile.ui.components.BackButton
import com.subscribby.mobile.ui.components.CardShape
import com.subscribby.mobile.ui.components.ConfirmSheet
import com.subscribby.mobile.ui.components.ControlShape
import com.subscribby.mobile.ui.components.DashedDivider
import com.subscribby.mobile.ui.components.DetailSkeleton
import com.subscribby.mobile.ui.components.DocNumber
import com.subscribby.mobile.ui.components.ErrorState
import com.subscribby.mobile.ui.components.FormBanner
import com.subscribby.mobile.ui.components.GroupDivider
import com.subscribby.mobile.ui.components.GroupGap
import com.subscribby.mobile.ui.components.InsetGroup
import com.subscribby.mobile.ui.components.LargeTitleScreen
import com.subscribby.mobile.ui.components.LargeTitleText
import com.subscribby.mobile.ui.components.LinesLedger
import com.subscribby.mobile.ui.components.LoadState
import com.subscribby.mobile.ui.components.PrimaryButton
import com.subscribby.mobile.ui.components.ScreenPadding
import com.subscribby.mobile.ui.components.SecondaryButton
import com.subscribby.mobile.ui.components.SectionHeader
import com.subscribby.mobile.ui.components.SheetDetailRow
import com.subscribby.mobile.ui.components.SubscriptionStatus
import com.subscribby.mobile.ui.components.TitleInset
import com.subscribby.mobile.ui.components.TotalsBlock
import com.subscribby.mobile.ui.components.ValueRow
import com.subscribby.mobile.ui.components.dataOrNull
import com.subscribby.mobile.ui.components.entrance
import com.subscribby.mobile.ui.components.moneyFigure
import com.subscribby.mobile.ui.components.paperCard
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.ui.theme.StatusColors
import com.subscribby.mobile.util.Labels
import com.subscribby.mobile.util.formatDate
import com.subscribby.mobile.util.formatMoney

/** Destructive customer actions get a red confirm button. */
private val DESTRUCTIVE = setOf("reject", "close")

/** Actions that move a subscription forward get the filled button. */
private val PRIMARY = setOf("accept", "resume", "renew")

@Composable
fun SubscriptionDetailScreen(id: String, onBack: () -> Unit, backLabel: String = "Home") {
    val container = LocalAppContainer.current
    val vm = viewModel(key = "subscription-$id") { SubscriptionDetailViewModel(container.portal, id) }
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(Unit) { vm.load() }
    LaunchedEffect(vm.message) {
        vm.message?.let {
            snackbar.showSnackbar(AppSnack(it, success = vm.messageSuccess))
            vm.messageShown()
        }
    }

    val state = vm.state
    val detail = state.dataOrNull

    LargeTitleScreen(
        title = detail?.plan?.name ?: "Subscription",
        compactTitle = detail?.plan?.name?.let { AnnotatedString(it) },
        navigation = { BackButton(onBack, backLabel) },
        header = detail?.let { sub -> { DetailHeader(sub) } } ?: { Spacer(Modifier.height(8.dp)) },
        refreshing = state is LoadState.Success && state.refreshing,
        onRefresh = vm::load,
        snackbar = snackbar,
        bottomBar = if (detail != null && detail.allowedActions.isNotEmpty()) {
            // Buttons come only from the server's allowedActions, never from local status logic.
            { ActionBar(detail.allowedActions, vm.runningAction, onAction = vm::askToRun) }
        } else {
            null
        },
    ) {
        when (state) {
            LoadState.Loading -> item(key = "skeleton") { DetailSkeleton(rows = 3) }
            is LoadState.Error -> item(key = "error") { ErrorState("Couldn't load this subscription. ${state.message}", onRetry = vm::load) }
            is LoadState.Success -> subscriptionContent(state.data)
        }
    }

    val pending = vm.pendingAction
    if (pending != null && detail != null) {
        val price = "${formatMoney(detail.recurringTotal ?: detail.totals.total)} per ${Labels.billingPeriod(detail.plan.billingPeriod)}"
        val (title, message) = Labels.actionConfirm(pending, detail.number, startDate = formatDate(detail.startDate), price = price)
        ConfirmSheet(
            title = title,
            message = message,
            confirmLabel = Labels.action(pending),
            destructive = pending in DESTRUCTIVE,
            dismissLabel = "Not now",
            onConfirm = vm::confirmPendingAction,
            onDismiss = vm::dismissDialog,
            details = if (pending == "accept") {
                {
                    SheetDetailRow("Plan", detail.plan.name)
                    GroupDivider()
                    SheetDetailRow("Price", price)
                    GroupDivider()
                    SheetDetailRow("Billing starts", formatDate(detail.startDate))
                }
            } else {
                null
            },
        )
    }
}

@Composable
private fun DetailHeader(sub: SubscriptionDetail) {
    Column(Modifier.fillMaxWidth().padding(start = TitleInset, end = TitleInset, top = 4.dp, bottom = 18.dp)) {
        DocNumber(sub.number)
        Spacer(Modifier.height(2.dp))
        LargeTitleText(sub.plan.name)
        Spacer(Modifier.height(8.dp))
        SubscriptionStatus(sub.status, Modifier.testTag("subscription-status"))
    }
}

/** Translucent dock: secondary action on the left, the primary one on the right. */
@Composable
private fun ActionBar(actions: List<String>, running: String?, onAction: (String) -> Unit) {
    ActionDock {
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

private fun LazyListScope.subscriptionContent(sub: SubscriptionDetail) {
    val period = Labels.billingPeriod(sub.plan.billingPeriod)
    val gutter = Modifier.padding(horizontal = ScreenPadding)

    item(key = "price") {
        Column(gutter.fillMaxWidth().entrance(0).paperCard(CardShape).padding(20.dp)) {
            Text("Recurring price", style = MaterialTheme.typography.bodySmall, color = Palette.TextMuted)
            Spacer(Modifier.height(4.dp))
            Text(
                moneyFigure(sub.recurringTotal ?: sub.totals.total, minorScale = 0.6f, color = Palette.Text),
                style = MaterialTheme.typography.headlineLarge.copy(fontFamily = MaterialTheme.typography.titleMedium.fontFamily),
                fontWeight = FontWeight.SemiBold,
                color = Palette.Text,
            )
            Text("per $period, tax included", style = MaterialTheme.typography.bodyMedium, color = Palette.TextMuted)
            Labels.closeReason(sub.closeReason)?.let {
                Spacer(Modifier.height(4.dp))
                Text(it, style = MaterialTheme.typography.bodyMedium, color = Palette.TextMuted)
            }
            if ("accept" in sub.allowedActions) {
                Spacer(Modifier.height(16.dp))
                Row(
                    Modifier.fillMaxWidth().clip(ControlShape).background(StatusColors.quotationTint).padding(horizontal = 14.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Icon(AppIcons.Clock, contentDescription = null, tint = StatusColors.quotation, modifier = Modifier.padding(top = 1.dp).size(18.dp))
                    Text(
                        "Check the lines below, then accept" + (sub.quotationValidUntil?.let { " by ${formatDate(it)}" } ?: "") + ".",
                        style = MaterialTheme.typography.bodyMedium,
                        color = QuotationInk,
                    )
                }
            }
            if (sub.isExpired) {
                Spacer(Modifier.height(16.dp))
                FormBanner("This subscription is past its expiry date, so billing has stopped.")
            }
        }
    }

    item(key = "details") {
        Column(gutter.padding(top = GroupGap).entrance(1)) {
            SectionHeader("Details")
            InsetGroup {
                val rows = buildList {
                    add(Triple(AppIcons.Calendar, "Start date", formatDate(sub.startDate)))
                    add(Triple(AppIcons.Calendar, "Expiry date", formatDate(sub.expiryDate)))
                    if (sub.status == "quotation") add(Triple(AppIcons.Clock, "Valid until", formatDate(sub.quotationValidUntil)))
                    if (sub.nextInvoiceDate != null) add(Triple(AppIcons.Receipt, "Next invoice", formatDate(sub.nextInvoiceDate)))
                    sub.paymentTermDays?.let { add(Triple(AppIcons.Card, "Payment terms", if (it == 0) "Due on receipt" else "$it days")) }
                    add(Triple(AppIcons.Repeat, "Billed", "Every $period"))
                }
                rows.forEachIndexed { index, (icon, label, value) ->
                    if (index > 0) GroupDivider(start = 58.dp)
                    ValueRow(label, value, icon = icon)
                }
            }
        }
    }

    item(key = "lines") {
        Column(gutter.padding(top = GroupGap).entrance(2)) {
            SectionHeader("Lines", trailing = "${sub.lines.size} ${if (sub.lines.size == 1) "line" else "lines"}")
            InsetGroup {
                LinesLedger(sub.lines)
                DashedDivider(Modifier.padding(horizontal = 18.dp))
                TotalsBlock(
                    untaxedAmount = sub.totals.untaxedAmount,
                    discountTotal = sub.totals.discountTotal,
                    taxTotal = sub.totals.taxTotal,
                    total = sub.totals.total,
                    orderDiscount = sub.orderDiscount,
                )
            }
        }
    }

    sub.invoiceSummary?.takeIf { it.count > 0 }?.let { summary ->
        item(key = "invoices") {
            Column(gutter.padding(top = GroupGap).entrance(3)) {
                SectionHeader("Invoices")
                InsetGroup {
                    ValueRow("Invoices so far", summary.count.toString())
                    GroupDivider()
                    ValueRow("Outstanding", formatMoney(summary.outstandingAmount))
                    summary.lastInvoice?.let {
                        GroupDivider()
                        ValueRow("Latest", null) { DocNumber(it.number, color = Palette.Text) }
                    }
                }
            }
        }
    }
}

/** Quotation hue darkened for body text on its tint (AA contrast). */
private val QuotationInk = androidx.compose.ui.graphics.Color(0xFF6A3D00)
