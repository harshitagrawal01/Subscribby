package com.subscribby.mobile.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.subscribby.mobile.data.model.AppliedDiscount
import com.subscribby.mobile.data.model.PricedLine
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.util.formatMoney

/** Priced lines exactly as the API sent them (the app never recalculates). Meant to sit inside a [Panel]. */
@Composable
fun LinesLedger(lines: List<PricedLine>, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth()) {
        if (lines.isEmpty()) {
            Text(
                "No lines on this document.",
                style = MaterialTheme.typography.bodyMedium,
                color = Palette.TextMuted,
                modifier = Modifier.padding(16.dp),
            )
        }
        lines.forEachIndexed { index, line ->
            if (index > 0) PanelDivider(Modifier.padding(horizontal = 16.dp))
            LedgerLine(line)
        }
    }
}

@Composable
private fun LedgerLine(line: PricedLine) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f).padding(end = 16.dp)) {
                Text(line.title, style = MaterialTheme.typography.titleSmall)
                line.variantLabel?.takeIf { it.isNotBlank() }?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = Palette.TextMuted)
                }
            }
            Money(line.total, style = MaterialTheme.typography.titleSmall)
        }
        Adjustment("${line.quantity} × ${formatMoney(line.unitPrice)}", formatMoney(line.subtotal))
        line.discount?.let { Adjustment(it.name, "−" + formatMoney(it.amount)) }
        if (line.orderDiscountShare > 0) Adjustment("Order discount share", "−" + formatMoney(line.orderDiscountShare))
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
    extra: @Composable () -> Unit = {},
) {
    Column(modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        TotalRow("Untaxed amount", formatMoney(untaxedAmount))
        if (discountTotal != 0L) TotalRow("Discounts", "−" + formatMoney(discountTotal))
        orderDiscount?.let {
            Text("Includes ${it.name}", style = MaterialTheme.typography.bodySmall, color = Palette.TextFaint)
        }
        TotalRow("Tax", formatMoney(taxTotal))
        PanelDivider(Modifier.padding(vertical = 4.dp))
        TotalRow("Total", formatMoney(total), strong = true)
        extra()
    }
}

@Composable
fun TotalRow(label: String, value: String, strong: Boolean = false, color: Color = Color.Unspecified) {
    val style = if (strong) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            label,
            style = style,
            color = if (strong) color.takeOrElse(Palette.Text) else Palette.TextMuted,
            modifier = Modifier.weight(1f),
        )
        Text(value, style = style, color = color, fontWeight = if (strong) FontWeight.SemiBold else null, textAlign = TextAlign.End)
    }
}

private fun Color.takeOrElse(other: Color) = if (this == Color.Unspecified) other else this
