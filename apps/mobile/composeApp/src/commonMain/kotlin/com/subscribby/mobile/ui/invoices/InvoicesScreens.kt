package com.subscribby.mobile.ui.invoices

import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.subscribby.mobile.data.model.InvoiceDetail
import com.subscribby.mobile.data.model.InvoiceListItem
import com.subscribby.mobile.data.repo.InvoiceFilter
import com.subscribby.mobile.ui.LocalAppContainer
import com.subscribby.mobile.ui.components.AppIcons
import com.subscribby.mobile.ui.components.DocNumber
import com.subscribby.mobile.ui.components.Dot
import com.subscribby.mobile.ui.components.EmptyState
import com.subscribby.mobile.ui.components.ErrorState
import com.subscribby.mobile.ui.components.GroupGap
import com.subscribby.mobile.ui.components.HeaderIconButton
import com.subscribby.mobile.ui.components.InvoiceStatus
import com.subscribby.mobile.ui.components.KeyValueRow
import com.subscribby.mobile.ui.components.LinesLedger
import com.subscribby.mobile.ui.components.ListSkeleton
import com.subscribby.mobile.ui.components.LoadState
import com.subscribby.mobile.ui.components.Money
import com.subscribby.mobile.ui.components.Panel
import com.subscribby.mobile.ui.components.PanelDivider
import com.subscribby.mobile.ui.components.ScreenHeader
import com.subscribby.mobile.ui.components.ScreenPadding
import com.subscribby.mobile.ui.components.ScreenSkeleton
import com.subscribby.mobile.ui.components.SectionTitle
import com.subscribby.mobile.ui.components.TotalRow
import com.subscribby.mobile.ui.components.TotalsBlock
import com.subscribby.mobile.ui.components.dataOrNull
import com.subscribby.mobile.ui.components.focusRing
import com.subscribby.mobile.ui.components.rowClickable
import com.subscribby.mobile.ui.theme.LocalHeroStyle
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.ui.theme.StatusColors
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
        containerColor = Palette.Paper,
        topBar = {
            ScreenHeader(title = "Invoices") { HeaderIconButton(AppIcons.Refresh, "Refresh", vm::load) }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            FilterTabs(vm.filter, vm::selectFilter)
            val state = vm.state
            PullToRefreshBox(
                isRefreshing = state is LoadState.Success && state.refreshing,
                onRefresh = vm::load,
                modifier = Modifier.fillMaxSize(),
            ) {
                when (state) {
                    LoadState.Loading -> ListSkeleton(Modifier.padding(ScreenPadding))
                    is LoadState.Error -> ErrorState("Couldn't load your invoices. ${state.message}", onRetry = vm::load)
                    is LoadState.Success -> Column(
                        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(ScreenPadding).padding(bottom = 16.dp),
                    ) {
                        if (state.data.isEmpty()) {
                            when (vm.filter) {
                                InvoiceFilter.Unpaid -> EmptyState(
                                    "Nothing to pay. Every invoice so far is settled.",
                                    actionLabel = "Show all invoices",
                                    onAction = { vm.selectFilter(InvoiceFilter.All) },
                                )
                                InvoiceFilter.Paid -> EmptyState(
                                    "No paid invoices yet. They appear here once a payment is recorded.",
                                    actionLabel = "Show all invoices",
                                    onAction = { vm.selectFilter(InvoiceFilter.All) },
                                )
                                InvoiceFilter.All -> EmptyState(
                                    "No invoices yet. The first one is created on your subscription's billing date.",
                                    actionLabel = "Check again",
                                    onAction = vm::load,
                                )
                            }
                        } else {
                            Panel(Modifier.testTag("invoices-list")) {
                                state.data.forEachIndexed { index, invoice ->
                                    if (index > 0) PanelDivider()
                                    InvoiceRow(invoice) { onOpenInvoice(invoice.id) }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Text tabs with an ink underline on the selected one, over a hairline. */
@Composable
private fun FilterTabs(selected: InvoiceFilter, onSelect: (InvoiceFilter) -> Unit) {
    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(horizontal = 8.dp).selectableGroup()) {
            InvoiceFilter.entries.forEach { filter ->
                val isSelected = filter == selected
                val source = remember { MutableInteractionSource() }
                Box(
                    Modifier
                        .focusRing(source, outset = (-2).dp)
                        .selectable(
                            selected = isSelected,
                            onClick = { onSelect(filter) },
                            role = Role.Tab,
                            interactionSource = source,
                            indication = LocalIndication.current,
                        )
                        .testTag("filter-${filter.name}")
                        .padding(horizontal = 8.dp)
                        .then(if (isSelected) Modifier.drawBehind { underline() } else Modifier),
                ) {
                    Text(
                        filter.label,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                        color = if (isSelected) Palette.Ink8 else Palette.TextMuted,
                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 12.dp),
                    )
                }
            }
        }
        PanelDivider()
    }
}

private fun DrawScope.underline() {
    val h = 2.dp.toPx()
    drawRect(Palette.Ink8, topLeft = Offset(0f, size.height - h), size = Size(size.width, h))
}

@Composable
private fun InvoiceRow(invoice: InvoiceListItem, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().rowClickable(onClick).padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Column(Modifier.weight(1f).padding(end = 12.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            DocNumber(invoice.number, size = 13.sp, color = Palette.Text, fontWeight = FontWeight.Medium)
            Text(
                when {
                    invoice.isOverdue -> "Due ${formatDate(invoice.dueDate)}, ${days(invoice.daysOverdue)} late"
                    invoice.status == "paid" -> "Issued ${formatDate(invoice.invoiceDate)}"
                    else -> "Due ${formatDate(invoice.dueDate)}"
                },
                style = MaterialTheme.typography.bodySmall,
                color = if (invoice.isOverdue) StatusColors.overdue else Palette.TextMuted,
            )
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Money(invoice.total, style = MaterialTheme.typography.titleSmall)
            if (invoice.status == "confirmed" && invoice.balance > 0 && invoice.balance != invoice.total) {
                Text("${formatMoney(invoice.balance)} left", style = MaterialTheme.typography.bodySmall, color = Palette.TextMuted)
            }
            InvoiceStatus(invoice.status, invoice.isOverdue)
        }
    }
}

private fun days(n: Int) = if (n == 1) "1 day" else "$n days"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoiceDetailScreen(id: String, onBack: () -> Unit, onOpenSubscription: (String) -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel(key = "invoice-$id") { InvoiceDetailViewModel(container.portal, id) }
    LaunchedEffect(Unit) { vm.load() }
    val state = vm.state

    Scaffold(
        containerColor = Palette.Paper,
        topBar = { ScreenHeader(title = state.dataOrNull?.number, backLabel = "Invoices", onBack = onBack) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state is LoadState.Success && state.refreshing,
            onRefresh = vm::load,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            when (state) {
                LoadState.Loading -> ScreenSkeleton(rows = 3)
                is LoadState.Error -> ErrorState("Couldn't load this invoice. ${state.message}", onRetry = vm::load)
                is LoadState.Success -> InvoiceContent(state.data, onOpenSubscription)
            }
        }
    }
}

@Composable
private fun InvoiceContent(invoice: InvoiceDetail, onOpenSubscription: (String) -> Unit) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = ScreenPadding).padding(top = 4.dp, bottom = 32.dp),
    ) {
        // Focal point: what's left to pay, or what was paid once it's settled.
        val settled = invoice.status == "paid"
        Text(if (settled) "Amount paid" else "Balance due", style = MaterialTheme.typography.labelMedium, color = Palette.TextMuted)
        Spacer(Modifier.height(4.dp))
        Money(if (settled) invoice.amountPaid else invoice.balance, style = LocalHeroStyle.current)
        Spacer(Modifier.height(6.dp))
        val (note, noteColor) = when {
            invoice.isOverdue -> "Was due ${formatDate(invoice.dueDate)}, ${days(invoice.daysOverdue)} ago" to StatusColors.overdue
            invoice.status == "paid" -> "Paid in full" + (invoice.payments.maxOfOrNull { it.paymentDate }?.let { " on ${formatDate(it)}" } ?: "") to StatusColors.active
            invoice.status == "cancelled" -> "This invoice was cancelled" to Palette.TextMuted
            else -> "Due ${formatDate(invoice.dueDate)}" to Palette.TextMuted
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (noteColor != Palette.TextMuted) Dot(noteColor)
            Text(note, style = MaterialTheme.typography.bodyMedium, color = noteColor)
        }

        Spacer(Modifier.height(GroupGap))
        PaperInvoice(invoice, onOpenSubscription)

        Spacer(Modifier.height(GroupGap))
        SectionTitle("Payments")
        Panel {
            if (invoice.payments.isEmpty()) {
                Text(
                    "No payments recorded yet.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Palette.TextMuted,
                    modifier = Modifier.padding(16.dp),
                )
            }
            invoice.payments.forEachIndexed { index, payment ->
                if (index > 0) PanelDivider()
                Row(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f).padding(end = 12.dp)) {
                        Text(Labels.paymentMethod(payment.method), style = MaterialTheme.typography.titleSmall)
                        Text(
                            listOfNotNull(formatDate(payment.paymentDate), payment.note?.takeIf { it.isNotBlank() }).joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                            color = Palette.TextMuted,
                        )
                    }
                    Money(payment.amount, style = MaterialTheme.typography.titleSmall)
                }
            }
        }
    }
}

/** The invoice laid out like the printed document: issuer and number, bill-to and dates, lines, totals. */
@Composable
private fun PaperInvoice(invoice: InvoiceDetail, onOpenSubscription: (String) -> Unit) {
    Panel(Modifier.testTag("invoice-paper")) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f).padding(end = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(invoice.company?.name ?: "Invoice", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                invoice.company?.address?.takeIf { it.isNotBlank() }?.let { Small(it) }
                invoice.company?.taxId?.takeIf { it.isNotBlank() }?.let { Small("GSTIN $it") }
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Tax invoice", style = MaterialTheme.typography.bodySmall, color = Palette.TextMuted)
                DocNumber(invoice.number, size = 13.sp, color = Palette.Text, fontWeight = FontWeight.Medium)
                InvoiceStatus(invoice.status, invoice.isOverdue)
            }
        }
        PanelDivider()

        invoice.customerSnapshot?.let { billedTo ->
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Small("Bill to")
                Text(billedTo.name, style = MaterialTheme.typography.titleSmall)
                billedTo.billingAddress?.singleLine()?.takeIf { it.isNotBlank() }?.let { Small(it) }
                billedTo.taxId?.takeIf { it.isNotBlank() }?.let { Small("GSTIN $it") }
            }
            PanelDivider()
        }

        Spacer(Modifier.height(10.dp))
        KeyValueRow("Invoice date", formatDate(invoice.invoiceDate), dense = true)
        KeyValueRow("Due date", formatDate(invoice.dueDate), dense = true)
        if (invoice.periodStart != null || invoice.periodEnd != null) {
            KeyValueRow("Period", "${formatDate(invoice.periodStart)} to ${formatDate(invoice.periodEnd)}", dense = true)
        }
        if (invoice.subscription == null) Spacer(Modifier.height(10.dp))
        invoice.subscription?.let { sub ->
            KeyValueRow("Subscription", onClick = { onOpenSubscription(sub.id) }) {
                DocNumber(sub.number, size = 13.sp, color = Palette.Ink8)
            }
        }
        PanelDivider()

        LinesLedger(invoice.lines)
        PanelDivider()
        TotalsBlock(
            untaxedAmount = invoice.untaxedAmount,
            discountTotal = invoice.discountTotal,
            taxTotal = invoice.taxTotal,
            total = invoice.total,
            orderDiscount = invoice.orderDiscount,
        ) {
            TotalRow("Paid", "−" + formatMoney(invoice.amountPaid))
            PanelDivider(Modifier.padding(vertical = 4.dp))
            TotalRow(
                "Balance due",
                formatMoney(invoice.balance),
                strong = true,
                color = if (invoice.isOverdue) StatusColors.overdue else Palette.Text,
            )
        }
    }
}

@Composable
private fun Small(text: String) {
    Text(text, style = MaterialTheme.typography.bodySmall, color = Palette.TextMuted, textAlign = TextAlign.Start)
}
