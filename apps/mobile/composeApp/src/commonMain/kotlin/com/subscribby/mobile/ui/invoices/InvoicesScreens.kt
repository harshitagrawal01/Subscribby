package com.subscribby.mobile.ui.invoices

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.subscribby.mobile.data.model.InvoiceDetail
import com.subscribby.mobile.data.model.InvoiceListItem
import com.subscribby.mobile.data.repo.InvoiceFilter
import com.subscribby.mobile.ui.LocalAppContainer
import com.subscribby.mobile.ui.components.AppIcons
import com.subscribby.mobile.ui.components.BackButton
import com.subscribby.mobile.ui.components.BarIconButton
import com.subscribby.mobile.ui.components.DashedDivider
import com.subscribby.mobile.ui.components.DetailSkeleton
import com.subscribby.mobile.ui.components.DocNumber
import com.subscribby.mobile.ui.components.Dot
import com.subscribby.mobile.ui.components.EmptyState
import com.subscribby.mobile.ui.components.ErrorState
import com.subscribby.mobile.ui.components.GroupDivider
import com.subscribby.mobile.ui.components.GroupGap
import com.subscribby.mobile.ui.components.HeroAmount
import com.subscribby.mobile.ui.components.IconTile
import com.subscribby.mobile.ui.components.InsetGroup
import com.subscribby.mobile.ui.components.InvoiceStatus
import com.subscribby.mobile.ui.components.LargeTitleScreen
import com.subscribby.mobile.ui.components.LinesLedger
import com.subscribby.mobile.ui.components.ListRow
import com.subscribby.mobile.ui.components.ListSkeleton
import com.subscribby.mobile.ui.components.LoadState
import com.subscribby.mobile.ui.components.LogoMark
import com.subscribby.mobile.ui.components.Motion
import com.subscribby.mobile.ui.components.PaidStamp
import com.subscribby.mobile.ui.components.ReceiptPaper
import com.subscribby.mobile.ui.components.RowSubtitle
import com.subscribby.mobile.ui.components.RowTitle
import com.subscribby.mobile.ui.components.ScreenPadding
import com.subscribby.mobile.ui.components.SectionHeader
import com.subscribby.mobile.ui.components.TitleInset
import com.subscribby.mobile.ui.components.TotalRow
import com.subscribby.mobile.ui.components.TotalsBlock
import com.subscribby.mobile.ui.components.ValueRow
import com.subscribby.mobile.ui.components.dataOrNull
import com.subscribby.mobile.ui.components.entrance
import com.subscribby.mobile.ui.components.focusRing
import com.subscribby.mobile.ui.components.invoiceStatusColor
import com.subscribby.mobile.ui.components.paperCard
import com.subscribby.mobile.ui.components.statusTint
import com.subscribby.mobile.ui.theme.LocalHeroStyle
import com.subscribby.mobile.ui.theme.LocalMonoFamily
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.ui.theme.StatusColors
import com.subscribby.mobile.util.Labels
import com.subscribby.mobile.util.formatDate
import com.subscribby.mobile.util.formatMoney

@Composable
fun InvoicesScreen(onOpenInvoice: (String) -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel { InvoicesViewModel(container.portal) }
    LaunchedEffect(Unit) { vm.load() }
    val state = vm.state

    LargeTitleScreen(
        title = "Invoices",
        actions = { BarIconButton(AppIcons.Refresh, "Refresh", vm::load) },
        refreshing = state is LoadState.Success && state.refreshing,
        onRefresh = vm::load,
    ) {
        item(key = "filter") {
            SegmentedControl(
                options = InvoiceFilter.entries,
                selected = vm.filter,
                label = { it.label },
                tag = { "filter-${it.name}" },
                onSelect = vm::selectFilter,
                modifier = Modifier.padding(horizontal = ScreenPadding).padding(bottom = 20.dp),
            )
        }
        when (state) {
            LoadState.Loading -> item(key = "loading") { ListSkeleton(Modifier.padding(horizontal = ScreenPadding)) }
            is LoadState.Error -> item(key = "error") { ErrorState("Couldn't load your invoices. ${state.message}", onRetry = vm::load) }
            is LoadState.Success -> invoiceList(state.data, vm.filter, onOpenInvoice, vm::selectFilter, vm::load)
        }
    }
}

private fun LazyListScope.invoiceList(
    invoices: List<InvoiceListItem>,
    filter: InvoiceFilter,
    onOpen: (String) -> Unit,
    onSelectFilter: (InvoiceFilter) -> Unit,
    onReload: () -> Unit,
) {
    val gutter = Modifier.padding(horizontal = ScreenPadding)
    if (invoices.isEmpty()) {
        item(key = "empty-$filter") {
            when (filter) {
                InvoiceFilter.Unpaid -> EmptyState(
                    "Every invoice so far is settled.",
                    title = "Nothing to pay",
                    actionLabel = "Show all invoices",
                    onAction = { onSelectFilter(InvoiceFilter.All) },
                    modifier = gutter.entrance(0),
                )
                InvoiceFilter.Paid -> EmptyState(
                    "They appear here once a payment is recorded.",
                    title = "No paid invoices yet",
                    actionLabel = "Show all invoices",
                    onAction = { onSelectFilter(InvoiceFilter.All) },
                    modifier = gutter.entrance(0),
                )
                InvoiceFilter.All -> EmptyState(
                    "The first one is created on your subscription's billing date.",
                    title = "No invoices yet",
                    actionLabel = "Check again",
                    onAction = onReload,
                    modifier = gutter.entrance(0),
                )
            }
        }
        return
    }
    // Year sections, newest first as the API sends them (monthly billing would make month
    // sections one row each).
    val sections = invoices.groupBy { it.invoiceDate.take(4) }.entries.toList()
    item(key = "list-$filter") {
        Column(gutter.testTag("invoices-list")) {
            sections.forEachIndexed { sectionIndex, (month, items) ->
                Column(Modifier.entrance(sectionIndex).padding(bottom = 22.dp)) {
                    SectionHeader(month, trailing = "${items.size} ${if (items.size == 1) "invoice" else "invoices"}")
                    InsetGroup {
                        items.forEachIndexed { index, invoice ->
                            if (index > 0) GroupDivider(start = 68.dp)
                            InvoiceRow(invoice) { onOpen(invoice.id) }
                        }
                    }
                }
            }
        }
    }
}

/** iOS-style segmented control: paper track, white thumb that slides, haptic tick on change. */
@Composable
fun <T> SegmentedControl(
    options: List<T>,
    selected: T,
    label: (T) -> String,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
    tag: (T) -> String = { label(it) },
) {
    val haptics = LocalHapticFeedback.current
    val selectedIndex = options.indexOf(selected).coerceAtLeast(0)
    val track = RoundedCornerShape(14.dp)
    BoxWithConstraints(
        modifier
            .fillMaxWidth()
            .height(48.dp)
            .background(Palette.PaperDeep, track)
            .padding(4.dp)
            .selectableGroup(),
    ) {
        val segment = maxWidth / options.size
        val offset by animateDpAsState(
            segment * selectedIndex,
            spring(dampingRatio = 0.85f, stiffness = Spring.StiffnessMedium),
            label = "segment-thumb",
        )
        Box(
            Modifier
                .offset(x = offset)
                .width(segment)
                .fillMaxHeight()
                .paperCard(RoundedCornerShape(11.dp), elevation = 2.dp),
        )
        Row(Modifier.fillMaxSize()) {
            options.forEachIndexed { index, option ->
                val isSelected = index == selectedIndex
                val color by animateColorAsState(if (isSelected) Palette.Text else Palette.TextMuted, tween(Motion.QUICK), label = "segment-color")
                val source = remember { MutableInteractionSource() }
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .focusRing(source, corner = 11.dp, outset = 0.dp)
                        .selectable(
                            selected = isSelected,
                            onClick = {
                                if (!isSelected) haptics.performHapticFeedback(HapticFeedbackType.SegmentTick)
                                onSelect(option)
                            },
                            role = Role.Tab,
                            interactionSource = source,
                            indication = null,
                        )
                        .testTag(tag(option)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        label(option),
                        style = MaterialTheme.typography.labelMedium.copy(fontSize = 14.sp),
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                        color = color,
                    )
                }
            }
        }
    }
}

@Composable
private fun InvoiceRow(invoice: InvoiceListItem, onClick: () -> Unit) {
    val statusColor = invoiceStatusColor(invoice.status, invoice.isOverdue)
    ListRow(
        leading = { IconTile(AppIcons.Receipt, tint = statusColor, background = statusTint(statusColor)) },
        title = { DocNumber(invoice.number, size = 15.sp, color = Palette.Text, fontWeight = FontWeight.Medium) },
        subtitle = {
            RowSubtitle(
                when {
                    invoice.isOverdue -> "Due ${formatDate(invoice.dueDate)}, ${days(invoice.daysOverdue)} late"
                    invoice.status == "paid" -> "Issued ${formatDate(invoice.invoiceDate)}"
                    else -> "Due ${formatDate(invoice.dueDate)}"
                },
                color = if (invoice.isOverdue) StatusColors.overdue else Palette.TextMuted,
            )
        },
        trailing = {
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(formatMoney(invoice.total), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = Palette.Text)
                if (invoice.status == "confirmed" && invoice.balance > 0 && invoice.balance != invoice.total) {
                    Text("${formatMoney(invoice.balance)} left", style = MaterialTheme.typography.bodySmall, color = Palette.TextMuted)
                }
                InvoiceStatus(invoice.status, invoice.isOverdue)
            }
        },
        onClick = onClick,
    )
}

private fun days(n: Int) = if (n == 1) "1 day" else "$n days"

@Composable
fun InvoiceDetailScreen(id: String, onBack: () -> Unit, onOpenSubscription: (String) -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel(key = "invoice-$id") { InvoiceDetailViewModel(container.portal, id) }
    LaunchedEffect(Unit) { vm.load() }
    val state = vm.state
    val invoice = state.dataOrNull
    val mono = LocalMonoFamily.current

    LargeTitleScreen(
        title = invoice?.number ?: "Invoice",
        compactTitle = invoice?.number?.let { number ->
            buildAnnotatedString { withStyle(SpanStyle(fontFamily = mono, fontWeight = FontWeight.Medium, fontSize = 15.sp)) { append(number) } }
        },
        navigation = { BackButton(onBack, "Invoices") },
        header = invoice?.let { inv -> { AmountHeader(inv) } } ?: { Spacer(Modifier.height(8.dp)) },
        refreshing = state is LoadState.Success && state.refreshing,
        onRefresh = vm::load,
        listTag = "invoice-detail",
    ) {
        when (state) {
            LoadState.Loading -> item(key = "skeleton") { DetailSkeleton(rows = 3) }
            is LoadState.Error -> item(key = "error") { ErrorState("Couldn't load this invoice. ${state.message}", onRetry = vm::load) }
            is LoadState.Success -> invoiceContent(state.data, onOpenSubscription)
        }
    }
}

/** Focal point: what's left to pay, or what was paid once it's settled. */
@Composable
private fun AmountHeader(invoice: InvoiceDetail) {
    val settled = invoice.status == "paid"
    Column(Modifier.fillMaxWidth().padding(start = TitleInset, end = TitleInset, top = 4.dp, bottom = 20.dp)) {
        Text(if (settled) "Amount paid" else "Balance due", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, color = Palette.TextMuted)
        Spacer(Modifier.height(2.dp))
        HeroAmount(
            if (settled) invoice.amountPaid else invoice.balance,
            style = LocalHeroStyle.current,
            color = if (invoice.isOverdue) StatusColors.overdue else Palette.Text,
            animate = false,
        )
        Spacer(Modifier.height(4.dp))
        val (note, noteColor) = when {
            invoice.isOverdue -> "Was due ${formatDate(invoice.dueDate)}, ${days(invoice.daysOverdue)} ago" to StatusColors.overdue
            settled -> "Paid in full" + (lastPaymentDate(invoice)?.let { " on ${formatDate(it)}" } ?: "") to StatusColors.active
            invoice.status == "cancelled" -> "This invoice was cancelled" to Palette.TextMuted
            else -> "Due ${formatDate(invoice.dueDate)}" to Palette.TextMuted
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (noteColor != Palette.TextMuted) Dot(noteColor)
            Text(note, style = MaterialTheme.typography.bodyMedium, color = noteColor)
        }
    }
}

private fun lastPaymentDate(invoice: InvoiceDetail): String? = invoice.payments.maxOfOrNull { it.paymentDate }

private fun LazyListScope.invoiceContent(invoice: InvoiceDetail, onOpenSubscription: (String) -> Unit) {
    val gutter = Modifier.padding(horizontal = ScreenPadding)
    item(key = "paper") { PaperInvoice(invoice, gutter.entrance(0)) }

    invoice.subscription?.let { sub ->
        item(key = "subscription") {
            InsetGroup(gutter.padding(top = GroupGap).entrance(1)) {
                ValueRow("Subscription", null, icon = AppIcons.Repeat, onClick = { onOpenSubscription(sub.id) }) {
                    DocNumber(sub.number, size = 14.sp, color = Palette.Ink8)
                }
            }
        }
    }

    item(key = "payments") {
        Column(gutter.padding(top = GroupGap).entrance(2)) {
            SectionHeader("Payments")
            InsetGroup {
                if (invoice.payments.isEmpty()) {
                    Text(
                        "No payments recorded yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Palette.TextMuted,
                        modifier = Modifier.padding(16.dp),
                    )
                }
                invoice.payments.forEachIndexed { index, payment ->
                    if (index > 0) GroupDivider(start = 68.dp)
                    ListRow(
                        leading = { IconTile(AppIcons.Card, tint = StatusColors.active, background = StatusColors.activeTint) },
                        title = { RowTitle(Labels.paymentMethod(payment.method)) },
                        subtitle = {
                            RowSubtitle(listOfNotNull(formatDate(payment.paymentDate), payment.note?.takeIf { it.isNotBlank() }).joinToString(" · "))
                        },
                        trailing = {
                            Text(formatMoney(payment.amount), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = Palette.Text)
                        },
                    )
                }
            }
        }
    }
}

/** The invoice as a paper receipt: issuer and number, bill-to, dates, lines, totals; stamped when paid. */
@Composable
private fun PaperInvoice(invoice: InvoiceDetail, modifier: Modifier = Modifier) {
    val pad = Modifier.padding(horizontal = 18.dp)
    ReceiptPaper(modifier.testTag("invoice-paper")) {
        Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f).padding(end = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(invoice.company?.name ?: "Invoice", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = Palette.Text)
                invoice.company?.address?.takeIf { it.isNotBlank() }?.let { Small(it) }
                invoice.company?.taxId?.takeIf { it.isNotBlank() }?.let { Small("GSTIN $it") }
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Small("Tax invoice")
                DocNumber(invoice.number, size = 14.sp, color = Palette.Text, fontWeight = FontWeight.Medium)
                InvoiceStatus(invoice.status, invoice.isOverdue)
            }
        }
        DashedDivider(pad)

        val paidOn = lastPaymentDate(invoice)?.takeIf { invoice.status == "paid" }
        Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                invoice.customerSnapshot?.let { billedTo ->
                    Small("Bill to")
                    Text(billedTo.name, style = MaterialTheme.typography.titleSmall, color = Palette.Text)
                    billedTo.billingAddress?.singleLine()?.takeIf { it.isNotBlank() }?.let { Small(it) }
                    billedTo.taxId?.takeIf { it.isNotBlank() }?.let { Small("GSTIN $it") }
                }
            }
            if (paidOn != null) {
                PaidStamp("Paid · ${formatDate(paidOn).take(6)}", Modifier.padding(start = 8.dp))
            }
        }
        DashedDivider(pad)

        Column(pad.padding(vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            DateLine("Invoice date", formatDate(invoice.invoiceDate))
            DateLine("Due date", formatDate(invoice.dueDate))
            if (invoice.periodStart != null || invoice.periodEnd != null) {
                DateLine("Period", "${formatDate(invoice.periodStart)} to ${formatDate(invoice.periodEnd)}")
            }
        }
        DashedDivider(pad)

        LinesLedger(invoice.lines, dashed = true)
        DashedDivider(pad)
        TotalsBlock(
            untaxedAmount = invoice.untaxedAmount,
            discountTotal = invoice.discountTotal,
            taxTotal = invoice.taxTotal,
            total = invoice.total,
            orderDiscount = invoice.orderDiscount,
        ) {
            TotalRow("Paid", if (invoice.amountPaid == 0L) formatMoney(0L) else "−" + formatMoney(invoice.amountPaid))
            DashedDivider(Modifier.padding(vertical = 5.dp))
            TotalRow(
                "Balance due",
                formatMoney(invoice.balance),
                strong = true,
                color = if (invoice.isOverdue) StatusColors.overdue else Palette.Text,
            )
        }
        Row(
            Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 8.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LogoMark(14.dp)
            Spacer(Modifier.width(6.dp))
            Text("Billed with Subscribby", style = MaterialTheme.typography.bodySmall, color = Palette.TextFaint)
        }
    }
}

@Composable
private fun DateLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = Palette.TextMuted, modifier = Modifier.weight(1f))
        Text(value, style = MaterialTheme.typography.bodyMedium, color = Palette.Text, textAlign = TextAlign.End)
    }
}

@Composable
private fun Small(text: String) {
    Text(text, style = MaterialTheme.typography.bodySmall, color = Palette.TextMuted)
}
