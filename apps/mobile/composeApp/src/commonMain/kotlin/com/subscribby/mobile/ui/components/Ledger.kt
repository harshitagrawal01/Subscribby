package com.subscribby.mobile.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.subscribby.mobile.data.model.AppliedDiscount
import com.subscribby.mobile.data.model.PricedLine
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.ui.theme.StatusColors
import com.subscribby.mobile.util.formatMoney

/** Horizontal padding inside receipts and line groups. */
private val Gutter = 18.dp

/** Dashed rule: the perforation between sections of a receipt. */
@Composable
fun DashedDivider(modifier: Modifier = Modifier, color: Color = Palette.LineStrong) {
    Canvas(modifier.fillMaxWidth().height(1.dp)) {
        drawLine(
            color = color,
            start = Offset(0f, size.height / 2),
            end = Offset(size.width, size.height / 2),
            strokeWidth = 1.dp.toPx(),
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx())),
        )
    }
}

/** Warm white paper with a torn bottom edge and a soft drop shadow. */
@Composable
fun ReceiptPaper(modifier: Modifier = Modifier, overlay: @Composable BoxScope.() -> Unit = {}, content: @Composable ColumnScope.() -> Unit) {
    val shape = remember { TornEdgeShape(tooth = 12.dp, depth = 6.dp) }
    Box(
        modifier
            .fillMaxWidth()
            .shadow(10.dp, shape, ambientColor = Palette.Shadow.copy(alpha = 0.12f), spotColor = Palette.Shadow.copy(alpha = 0.22f))
            .background(Palette.Receipt, shape),
    ) {
        Column(Modifier.fillMaxWidth().padding(bottom = 14.dp), content = content)
        overlay()
    }
}

/** Rotated rubber stamp ("PAID · 07 OCT") in the status green, like the web login's receipts. */
@Composable
fun PaidStamp(text: String, modifier: Modifier = Modifier, color: Color = StatusColors.active, fontSize: TextUnit = 15.sp) {
    Box(
        modifier
            .rotate(-9f)
            .border(2.dp, color.copy(alpha = 0.85f), RoundedCornerShape(8.dp))
            .padding(horizontal = (fontSize.value * 0.75f).dp, vertical = (fontSize.value * 0.25f).dp)
            .semantics { contentDescription = text },
    ) {
        Text(
            text.uppercase(),
            style = MaterialTheme.typography.labelLarge.copy(letterSpacing = 0.14.em, fontSize = fontSize),
            color = color.copy(alpha = 0.9f),
        )
    }
}

/** Priced lines exactly as the API sent them (the app never recalculates). */
@Composable
fun LinesLedger(lines: List<PricedLine>, modifier: Modifier = Modifier, dashed: Boolean = false) {
    Column(modifier.fillMaxWidth()) {
        if (lines.isEmpty()) {
            Text(
                "No lines on this document.",
                style = MaterialTheme.typography.bodyMedium,
                color = Palette.TextMuted,
                modifier = Modifier.padding(Gutter),
            )
        }
        lines.forEachIndexed { index, line ->
            if (index > 0) {
                if (dashed) DashedDivider(Modifier.padding(horizontal = Gutter)) else GroupDivider(start = Gutter)
            }
            LedgerLine(line)
        }
    }
}

@Composable
private fun LedgerLine(line: PricedLine) {
    Column(Modifier.fillMaxWidth().padding(horizontal = Gutter, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Row {
            Column(Modifier.weight(1f).padding(end = 16.dp)) {
                Text(line.title, style = MaterialTheme.typography.titleSmall, color = Palette.Text)
                line.variantLabel?.takeIf { it.isNotBlank() }?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = Palette.TextMuted)
                }
            }
            Money(line.total, style = MaterialTheme.typography.titleSmall, color = Palette.Text)
        }
        Adjustment("${line.quantity} × ${formatMoney(line.unitPrice)}", formatMoney(line.subtotal))
        line.discount?.let { Adjustment(it.name, "−" + formatMoney(it.amount)) }
        if (line.orderDiscountShare > 0) Adjustment("Share of discount", "−" + formatMoney(line.orderDiscountShare))
        if (line.taxes.isEmpty()) {
            if (line.taxAmount != 0L) Adjustment("Tax", formatMoney(line.taxAmount))
        } else {
            line.taxes.forEach { Adjustment(it.name, formatMoney(it.amount)) }
        }
    }
}

@Composable
private fun Adjustment(label: String, value: String) {
    Row(Modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = Palette.TextMuted, modifier = Modifier.weight(1f).padding(end = 16.dp))
        Text(value, style = MaterialTheme.typography.bodySmall, color = Palette.TextMuted, textAlign = TextAlign.End)
    }
}

/** Totals in a ledger column. [extra] adds rows after the total (paid, balance due). */
@Composable
fun TotalsBlock(
    untaxedAmount: Long,
    discountTotal: Long,
    taxTotal: Long,
    total: Long,
    orderDiscount: AppliedDiscount?,
    modifier: Modifier = Modifier,
    extra: @Composable ColumnScope.() -> Unit = {},
) {
    Column(modifier.fillMaxWidth().padding(horizontal = Gutter, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
        TotalRow("Untaxed amount", formatMoney(untaxedAmount))
        if (discountTotal != 0L) TotalRow("Discounts", "−" + formatMoney(discountTotal))
        orderDiscount?.let {
            Text("Includes ${it.name}", style = MaterialTheme.typography.bodySmall, color = Palette.TextFaint)
        }
        TotalRow("Tax", formatMoney(taxTotal))
        DashedDivider(Modifier.padding(vertical = 5.dp))
        TotalRow("Total", formatMoney(total), strong = true)
        extra()
    }
}

@Composable
fun TotalRow(label: String, value: String, strong: Boolean = false, color: Color = Color.Unspecified) {
    val style = if (strong) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium
    Row(Modifier.fillMaxWidth()) {
        Text(
            label,
            style = style,
            color = if (strong) color.takeOrElse(Palette.Text) else Palette.TextMuted,
            modifier = Modifier.weight(1f),
        )
        Text(
            value,
            style = style,
            color = color.takeOrElse(if (strong) Palette.Text else Palette.Text),
            fontWeight = if (strong) FontWeight.SemiBold else null,
            textAlign = TextAlign.End,
        )
    }
}

private fun Color.takeOrElse(other: Color) = if (this == Color.Unspecified) other else this
