package com.subscribby.mobile.ui.subscriptions

import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.subscribby.mobile.data.model.InvoiceListItem
import com.subscribby.mobile.data.model.PendingQuotation
import com.subscribby.mobile.data.model.PortalSummary
import com.subscribby.mobile.data.model.SubscriptionListItem
import com.subscribby.mobile.data.repo.SessionState
import com.subscribby.mobile.ui.LocalAppContainer
import com.subscribby.mobile.ui.components.AppIcons
import com.subscribby.mobile.ui.components.BarIconButton
import com.subscribby.mobile.ui.components.BrandMark
import com.subscribby.mobile.ui.components.CardShape
import com.subscribby.mobile.ui.components.DocNumber
import com.subscribby.mobile.ui.components.Dot
import com.subscribby.mobile.ui.components.EmptyState
import com.subscribby.mobile.ui.components.ErrorState
import com.subscribby.mobile.ui.components.GroupDivider
import com.subscribby.mobile.ui.components.GroupGap
import com.subscribby.mobile.ui.components.HeroAmount
import com.subscribby.mobile.ui.components.HomeSkeleton
import com.subscribby.mobile.ui.components.IconTile
import com.subscribby.mobile.ui.components.InsetGroup
import com.subscribby.mobile.ui.components.LargeTitleScreen
import com.subscribby.mobile.ui.components.LargeTitleText
import com.subscribby.mobile.ui.components.ListRow
import com.subscribby.mobile.ui.components.LoadState
import com.subscribby.mobile.ui.components.OnInkButton
import com.subscribby.mobile.ui.components.PrimaryButton
import com.subscribby.mobile.ui.components.RowSubtitle
import com.subscribby.mobile.ui.components.RowTitle
import com.subscribby.mobile.ui.components.ScreenPadding
import com.subscribby.mobile.ui.components.SecondaryButton
import com.subscribby.mobile.ui.components.SectionHeader
import com.subscribby.mobile.ui.components.StatusText
import com.subscribby.mobile.ui.components.SubscriptionStatus
import com.subscribby.mobile.ui.components.TitleInset
import com.subscribby.mobile.ui.components.entrance
import com.subscribby.mobile.ui.components.focusRing
import com.subscribby.mobile.ui.components.logoSilhouetteVector
import com.subscribby.mobile.ui.components.moneyFigure
import com.subscribby.mobile.ui.components.paperCard
import com.subscribby.mobile.ui.components.pressScale
import com.subscribby.mobile.ui.components.statusTint
import com.subscribby.mobile.ui.components.subscriptionStatusColor
import com.subscribby.mobile.ui.components.withDocNumbers
import com.subscribby.mobile.ui.theme.LocalHeroStyle
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.ui.theme.Radii
import com.subscribby.mobile.ui.theme.StatusColors
import com.subscribby.mobile.util.Labels
import com.subscribby.mobile.util.formatDate
import com.subscribby.mobile.util.formatMoney
import kotlinx.coroutines.delay

@Composable
fun SubscriptionsScreen(onOpenSubscription: (String) -> Unit, onOpenInvoices: () -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel { SubscriptionsViewModel(container.portal) }
    val session by container.session.state.collectAsStateWithLifecycle()
    val user = (session as? SessionState.LoggedIn)?.user
    val company = user?.customer?.name
    // Re-runs every time the tab is shown again, so data is fresh after accepting a quotation.
    LaunchedEffect(Unit) { vm.load() }

    val state = vm.state
    // The staggered entrance plays once; after that, coming back to the tab shows content instantly.
    var played by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(state is LoadState.Success) {
        if (state is LoadState.Success) {
            delay(900)
            played = true
        }
    }

    LargeTitleScreen(
        title = company ?: "Home",
        compactTitle = null,
        navigation = { BrandMark(Modifier.padding(start = 12.dp), markSize = 24.dp, wordSize = 19.sp) },
        actions = { BarIconButton(AppIcons.Refresh, "Refresh", vm::load) },
        header = {
            Column(Modifier.fillMaxWidth().padding(start = TitleInset, end = TitleInset, top = 6.dp, bottom = 18.dp)) {
                LargeTitleText(company ?: user?.name ?: "Home")
                if (user != null && company != null) {
                    Spacer(Modifier.height(2.dp))
                    Text("Signed in as ${user.name}", style = MaterialTheme.typography.bodyMedium, color = Palette.TextMuted)
                }
            }
        },
        refreshing = state is LoadState.Success && state.refreshing,
        onRefresh = vm::load,
        listTag = "subscriptions-list",
    ) {
        when (state) {
            LoadState.Loading -> item(key = "skeleton") { HomeSkeleton() }
            is LoadState.Error -> item(key = "error") { ErrorState("Couldn't load your account. ${state.message}", onRetry = vm::load) }
            is LoadState.Success -> homeContent(state.data, onOpenSubscription, onOpenInvoices, onReload = vm::load, animate = !played)
        }
    }
}

private fun LazyListScope.homeContent(
    data: HomeData,
    onOpen: (String) -> Unit,
    onOpenInvoices: () -> Unit,
    onReload: () -> Unit,
    animate: Boolean,
) {
    val periodsById = data.subscriptions.associate { it.id to it.plan.billingPeriod }
    val gutter = Modifier.padding(horizontal = ScreenPadding)

    item(key = "hero") {
        AmountDueCard(data, onOpenInvoices, gutter.entrance(0, animate), animateFigure = animate)
    }

    if (data.summary.pendingQuotations.isNotEmpty()) {
        item(key = "quotations-title") {
            SectionHeader(
                "Waiting for your approval",
                prominent = true,
                modifier = gutter.padding(top = GroupGap).entrance(1, animate),
            )
        }
        itemsIndexed(data.summary.pendingQuotations, key = { _, q -> "q-${q.id}" }) { index, quotation ->
            // Only the first quotation gets the filled button: one primary action per screen.
            QuotationCard(
                quotation,
                periodsById[quotation.id],
                primary = index == 0,
                onClick = { onOpen(quotation.id) },
                modifier = gutter.padding(bottom = 12.dp).entrance(2 + index, animate),
            )
        }
    }

    item(key = "subs-title") {
        SectionHeader(
            "Subscriptions",
            prominent = true,
            trailing = data.subscriptions.size.takeIf { it > 0 }?.toString(),
            modifier = gutter.padding(top = if (data.summary.pendingQuotations.isEmpty()) GroupGap else GroupGap - 12.dp).entrance(3, animate),
        )
    }
    item(key = "subs") {
        if (data.subscriptions.isEmpty()) {
            EmptyState(
                "Quotations sent to you will appear here.",
                title = "No subscriptions yet",
                actionLabel = "Check again",
                onAction = onReload,
                modifier = gutter.entrance(4, animate),
            )
        } else {
            InsetGroup(gutter.entrance(4, animate)) {
                data.subscriptions.forEachIndexed { index, sub ->
                    if (index > 0) GroupDivider(start = 68.dp)
                    SubscriptionRow(sub, onClick = { onOpen(sub.id) })
                }
            }
        }
    }
}

/**
 * The focal point: a deep ink card with what the customer owes (or their next payment), when,
 * and one action. A faint logo silhouette gives it texture; a perforated rule separates the stats,
 * like the stub of a receipt.
 */
@Composable
private fun AmountDueCard(data: HomeData, onOpenInvoices: () -> Unit, modifier: Modifier = Modifier, animateFigure: Boolean) {
    val summary = data.summary
    val next = summary.nextInvoice
    val owes = summary.outstandingAmount > 0
    val showsDue = owes || next == null
    val shape = RoundedCornerShape(Radii.hero)
    val silhouette = rememberVectorPainter(remember { logoSilhouetteVector(Palette.OnInk.copy(alpha = 0.06f)) })

    Column(
        modifier
            .fillMaxWidth()
            .testTag("summary-card")
            .shadow(20.dp, shape, ambientColor = Palette.Ink9.copy(alpha = 0.35f), spotColor = Palette.Ink9.copy(alpha = 0.5f))
            .clip(shape)
            .background(Palette.Ink9)
            .drawBehind {
                // The two-receipt mark, large and faint, tucked into the top-right corner.
                val s = 260.dp.toPx()
                translate(left = size.width - s * 0.7f, top = -s * 0.12f) {
                    with(silhouette) { draw(Size(s, s)) }
                }
            },
    ) {
        Column(Modifier.padding(start = 22.dp, end = 22.dp, top = 22.dp, bottom = 20.dp)) {
            Text(
                if (showsDue) "Amount due" else "Next payment",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                color = Palette.OnInkMuted,
            )
            Spacer(Modifier.height(6.dp))
            HeroAmount(
                if (showsDue) summary.outstandingAmount else next.amount,
                style = LocalHeroStyle.current,
                color = Palette.OnInk,
                animate = animateFigure,
            )
            Spacer(Modifier.height(6.dp))
            DueNote(summary, data.unpaid, owes)
            if (owes) {
                Spacer(Modifier.height(18.dp))
                OnInkButton("See unpaid invoices", onClick = onOpenInvoices, icon = AppIcons.ArrowRight)
            }
        }
        Perforation()
        Row(Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 16.dp), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            if (owes && next != null) {
                Stat(
                    "Next invoice",
                    Modifier.weight(1f),
                ) {
                    Text(
                        buildAnnotatedString {
                            append(formatMoney(next.amount))
                            withStyle(SpanStyle(color = Palette.OnInkMuted, fontWeight = FontWeight.Normal)) { append(" on ${formatDate(next.date)}") }
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = Palette.OnInk,
                    )
                }
            }
            Stat("Active", if (owes && next != null) Modifier else Modifier.weight(1f)) {
                Text(
                    summary.activeSubscriptions.toString(),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = Palette.OnInk,
                )
            }
            if (summary.overdueCount > 0) {
                Stat("Overdue") {
                    Text(
                        summary.overdueCount.toString(),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = StatusColors.overdueOnInk,
                    )
                }
            }
        }
    }
}

@Composable
private fun Stat(label: String, modifier: Modifier = Modifier, value: @Composable () -> Unit) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = Palette.OnInkMuted)
        value()
    }
}

/** Dashed rule with two half-circle punches at the card edges. */
@Composable
private fun Perforation() {
    Box(
        Modifier.fillMaxWidth().height(20.dp).drawBehind {
            val r = 10.dp.toPx()
            val y = size.height / 2
            drawLine(
                Palette.OnInk.copy(alpha = 0.22f),
                start = Offset(r + 8.dp.toPx(), y),
                end = Offset(size.width - r - 8.dp.toPx(), y),
                strokeWidth = 1.dp.toPx(),
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(6.dp.toPx(), 5.dp.toPx())),
            )
            drawCircle(Palette.Paper, r, Offset(0f, y))
            drawCircle(Palette.Paper, r, Offset(size.width, y))
        },
    )
}

@Composable
private fun DueNote(summary: PortalSummary, unpaid: List<InvoiceListItem>, owes: Boolean) {
    val next = summary.nextInvoice
    val overdue = unpaid.filter { it.isOverdue }.sortedByDescending { it.daysOverdue }
    val muted = Palette.OnInkMuted
    val alert = StatusColors.overdueOnInk
    val (text, color) = when {
        overdue.size == 1 -> "${overdue[0].number} is ${days(overdue[0].daysOverdue)} overdue" to alert
        overdue.size > 1 -> "${overdue.size} invoices overdue, the oldest by ${days(overdue[0].daysOverdue)}" to alert
        summary.overdueCount > 0 -> "${summary.overdueCount} overdue ${if (summary.overdueCount == 1) "invoice" else "invoices"}" to alert
        owes && unpaid.isNotEmpty() -> {
            val first = unpaid.minBy { it.dueDate }
            "Due ${formatDate(first.dueDate)} for ${first.number}" to muted
        }
        owes -> "Across your unpaid invoices" to muted
        next != null -> "Billed on ${formatDate(next.date)} for ${next.subscriptionNumber}" to muted
        else -> "Nothing is due. You're paid up." to muted
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (color == alert) Dot(color)
        Text(withDocNumbers(text), style = MaterialTheme.typography.bodyMedium, color = color)
    }
}

private fun days(n: Int) = if (n == 1) "1 day" else "$n days"

private fun shortPeriod(period: String?): String = when (period) {
    "daily" -> "day"
    "weekly" -> "wk"
    "monthly" -> "mo"
    "yearly" -> "yr"
    else -> Labels.billingPeriod(period)
}

/** Actionable card for a quotation waiting on the customer. The whole card opens it. */
@Composable
private fun QuotationCard(
    quotation: PendingQuotation,
    billingPeriod: String?,
    primary: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val source = remember { MutableInteractionSource() }
    Column(
        modifier
            .fillMaxWidth()
            .testTag("pending-quotation")
            .pressScale(source, 0.985f)
            .paperCard(CardShape)
            .focusRing(source, corner = Radii.card, outset = 0.dp)
            .clickable(interactionSource = source, indication = LocalIndication.current, role = Role.Button, onClick = onClick)
            .padding(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconTile(AppIcons.Receipt, tint = StatusColors.quotation, background = StatusColors.quotationTint, size = 44.dp, iconSize = 22.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(quotation.plan.name, style = MaterialTheme.typography.titleLarge, color = Palette.Text)
                DocNumber(quotation.number)
            }
            SubscriptionStatus("quotation")
        }
        Spacer(Modifier.height(16.dp))
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                moneyFigure(quotation.recurringTotal, minorScale = 0.62f, color = Palette.Text),
                style = MaterialTheme.typography.headlineMedium.copy(fontFamily = MaterialTheme.typography.titleMedium.fontFamily),
                fontWeight = FontWeight.SemiBold,
                color = Palette.Text,
            )
            Text(
                " per ${Labels.billingPeriod(billingPeriod ?: quotation.plan.billingPeriod)}",
                style = MaterialTheme.typography.bodyMedium,
                color = Palette.TextMuted,
                modifier = Modifier.padding(bottom = 3.dp),
            )
        }
        quotation.quotationValidUntil?.let {
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(AppIcons.Clock, contentDescription = null, tint = StatusColors.quotation, modifier = Modifier.size(16.dp))
                Text("Accept by ${formatDate(it)} to start this subscription.", style = MaterialTheme.typography.bodySmall, color = StatusColors.quotation)
            }
        }
        Spacer(Modifier.height(16.dp))
        if (primary) PrimaryButton("Review quotation", onClick = onClick, height = 48.dp, icon = AppIcons.ArrowRight)
        else SecondaryButton("Review quotation", onClick = onClick, height = 48.dp)
    }
}

/** Plan initials on a tile tinted by status, so the list scans by colour and by text. */
@Composable
private fun PlanTile(name: String, status: String) {
    val color = subscriptionStatusColor(status)
    val initials = name.split(' ', '-').filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }
    Box(
        Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(statusTint(color)),
        contentAlignment = Alignment.Center,
    ) {
        Text(initials, style = MaterialTheme.typography.labelLarge.copy(fontSize = 14.sp), color = if (color == StatusColors.draft) Palette.TextMuted else color)
    }
}

@Composable
private fun SubscriptionRow(sub: SubscriptionListItem, onClick: () -> Unit) {
    ListRow(
        leading = { PlanTile(sub.plan.name, sub.status) },
        title = { RowTitle(sub.plan.name) },
        subtitle = {
            DocNumber(sub.number, size = 12.sp)
            RowSubtitle(subscriptionDateLine(sub))
        },
        trailing = {
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    buildAnnotatedString {
                        append(formatMoney(sub.recurringTotal))
                        withStyle(SpanStyle(color = Palette.TextMuted, fontWeight = FontWeight.Normal, fontSize = 12.sp)) {
                            append("/${shortPeriod(sub.plan.billingPeriod)}")
                        }
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = Palette.Text,
                )
                StatusText(Labels.subscriptionStatus(sub.status), subscriptionStatusColor(sub.status))
            }
        },
        onClick = onClick,
    )
}

private fun subscriptionDateLine(sub: SubscriptionListItem): String = when (sub.status) {
    "quotation" -> "Valid until ${formatDate(sub.quotationValidUntil)}"
    "confirmed" -> "Starts ${formatDate(sub.startDate)}"
    "closed" -> Labels.closeReason(sub.closeReason) ?: "Closed"
    "paused" -> "No invoices while paused"
    else -> sub.nextInvoiceDate?.let { "Next invoice ${formatDate(it)}" } ?: "Ends ${formatDate(sub.expiryDate)}"
}
