package com.subscribby.mobile.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.text
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.subscribby.mobile.ui.theme.LocalMonoFamily
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.ui.theme.StatusColors
import com.subscribby.mobile.util.Labels
import com.subscribby.mobile.util.formatMoney
import kotlin.math.roundToLong

/** Paise as rupees in Plex Sans with tabular figures (set on every text style in the theme). */
@Composable
fun Money(
    paise: Long,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.bodyMedium,
    color: Color = Color.Unspecified,
    fontWeight: FontWeight? = null,
    prefix: String = "",
) {
    Text(prefix + formatMoney(paise), modifier, style = style, color = color, fontWeight = fontWeight, textAlign = TextAlign.End)
}

/**
 * "₹2,950.00" with the rupee sign and paise set smaller and softer than the whole rupees,
 * the way banking apps print a balance.
 */
fun moneyFigure(paise: Long, minorScale: Float = 0.58f, minorAlpha: Float = 0.7f, color: Color): AnnotatedString {
    val text = formatMoney(paise)
    val symbolEnd = text.indexOf('₹') + 1
    val dot = text.lastIndexOf('.')
    val soft = SpanStyle(fontSize = minorScale.em, color = color.copy(alpha = color.alpha * minorAlpha))
    return buildAnnotatedString {
        if (symbolEnd > 0) {
            append(text.substring(0, symbolEnd - 1))
            withStyle(soft) { append("₹") }
            append(" ")
        }
        append(text.substring(symbolEnd.coerceAtLeast(0), if (dot > 0) dot else text.length))
        if (dot > 0) withStyle(soft) { append(text.substring(dot)) }
    }
}

/**
 * Big figure that counts up to its value the first time it's shown (skipped with reduce motion).
 * Screen readers and tests always see the final amount.
 */
@Composable
fun HeroAmount(paise: Long, style: TextStyle, color: Color, modifier: Modifier = Modifier, animate: Boolean = true) {
    val reduce = LocalReduceMotion.current
    val shown = remember { Animatable(if (animate && !reduce) 0f else paise.toFloat()) }
    LaunchedEffect(paise) {
        if (animate && !reduce) shown.animateTo(paise.toFloat(), tween(750, easing = Motion.EaseOut)) else shown.snapTo(paise.toFloat())
    }
    // Snap to the exact paise at the end so float rounding never shows a wrong figure.
    val value = if (shown.isRunning) (shown.value / 100f).roundToLong() * 100 else paise
    val finalText = formatMoney(paise)
    Text(
        moneyFigure(value, color = color),
        modifier = modifier.clearAndSetSemantics { text = AnnotatedString(finalText) },
        style = style,
        color = color,
        maxLines = 1,
    )
}

/** Document number (SUB/2026/0042, INV/2026/0311) in Plex Mono, a touch smaller than the text around it. */
@Composable
fun DocNumber(
    number: String,
    modifier: Modifier = Modifier,
    size: TextUnit = 13.sp,
    color: Color = Palette.TextMuted,
    fontWeight: FontWeight = FontWeight.Normal,
) {
    Text(
        number,
        modifier,
        style = TextStyle(fontFamily = LocalMonoFamily.current, fontSize = size, lineHeight = (size.value + 6).sp, fontWeight = fontWeight),
        color = color,
        maxLines = 1,
    )
}

private val DOC_NUMBER = Regex("[A-Z]{2,4}/\\d{4}/\\d{3,6}")

/** Sets any document number inside running text (SUB/2026/0042) in Plex Mono, a touch smaller. */
@Composable
fun withDocNumbers(text: String): AnnotatedString {
    val mono = LocalMonoFamily.current
    return buildAnnotatedString {
        var last = 0
        DOC_NUMBER.findAll(text).forEach { match ->
            append(text.substring(last, match.range.first))
            withStyle(SpanStyle(fontFamily = mono, fontSize = 0.92.em)) { append(match.value) }
            last = match.range.last + 1
        }
        append(text.substring(last))
    }
}

/** Status as a 7dp dot and sentence-case text in the status colour. */
@Composable
fun StatusText(label: String, color: Color, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Dot(color)
        Text(label, style = MaterialTheme.typography.labelMedium, color = color, maxLines = 1)
    }
}

fun subscriptionStatusColor(status: String): Color = when (status) {
    "active" -> StatusColors.active
    "quotation" -> StatusColors.quotation
    "confirmed" -> StatusColors.confirmed
    "paused" -> StatusColors.paused
    "draft" -> StatusColors.draft
    else -> StatusColors.closed
}

/** Light background for a row's leading tile, matching its status hue. */
fun statusTint(color: Color): Color = when (color) {
    StatusColors.active -> StatusColors.activeTint
    StatusColors.overdue -> StatusColors.overdueTint
    StatusColors.quotation -> StatusColors.quotationTint
    StatusColors.confirmed -> Palette.Ink0
    else -> Palette.PaperDeep
}

@Composable
fun SubscriptionStatus(status: String, modifier: Modifier = Modifier) {
    StatusText(Labels.subscriptionStatus(status), subscriptionStatusColor(status), modifier)
}

/** Overdue wins over the stored status (the API computes it, it is never stored). */
fun invoiceStatusColor(status: String, isOverdue: Boolean): Color = when {
    isOverdue -> StatusColors.overdue
    status == "paid" -> StatusColors.active
    status == "confirmed" -> StatusColors.quotation // unpaid, not yet due
    status == "draft" -> StatusColors.draft
    else -> StatusColors.closed
}

fun invoiceStatusLabel(status: String, isOverdue: Boolean): String =
    if (isOverdue) "Overdue" else Labels.invoiceStatus(status)

@Composable
fun InvoiceStatus(status: String, isOverdue: Boolean, modifier: Modifier = Modifier) {
    StatusText(invoiceStatusLabel(status, isOverdue), invoiceStatusColor(status, isOverdue), modifier)
}
