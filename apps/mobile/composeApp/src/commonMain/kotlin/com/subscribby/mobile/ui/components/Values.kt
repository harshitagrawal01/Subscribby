package com.subscribby.mobile.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.subscribby.mobile.ui.theme.LocalMonoFamily
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.ui.theme.StatusColors
import com.subscribby.mobile.util.Labels
import com.subscribby.mobile.util.formatMoney

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

/** Document number (SUB/2026/0042, INV/2026/0311) in Plex Mono, a touch smaller than the text around it. */
@Composable
fun DocNumber(
    number: String,
    modifier: Modifier = Modifier,
    size: TextUnit = 12.sp,
    color: Color = Palette.TextMuted,
    fontWeight: FontWeight = FontWeight.Normal,
) {
    Text(
        number,
        modifier,
        style = TextStyle(fontFamily = LocalMonoFamily.current, fontSize = size, lineHeight = (size.value + 6).sp, fontWeight = fontWeight),
        color = color,
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
            withStyle(SpanStyle(fontFamily = mono, fontSize = 0.93.em)) { append(match.value) }
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
        Text(label, style = MaterialTheme.typography.labelMedium, color = color)
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

@Composable
fun SubscriptionStatus(status: String, modifier: Modifier = Modifier) {
    StatusText(Labels.subscriptionStatus(status), subscriptionStatusColor(status), modifier)
}

/** Overdue wins over the stored status (the API computes it, it is never stored). */
@Composable
fun InvoiceStatus(status: String, isOverdue: Boolean, modifier: Modifier = Modifier) {
    if (isOverdue) {
        StatusText("Overdue", StatusColors.overdue, modifier)
        return
    }
    val color = when (status) {
        "paid" -> StatusColors.active
        "confirmed" -> StatusColors.quotation // unpaid, not yet due
        "draft" -> StatusColors.draft
        else -> StatusColors.closed
    }
    StatusText(Labels.invoiceStatus(status), color, modifier)
}
