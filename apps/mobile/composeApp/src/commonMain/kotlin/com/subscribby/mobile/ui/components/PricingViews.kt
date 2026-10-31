package com.subscribby.mobile.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.subscribby.mobile.data.model.AppliedDiscount
import com.subscribby.mobile.data.model.PricedLine
import com.subscribby.mobile.ui.theme.StatusColors
import com.subscribby.mobile.util.formatMoney

/** Priced lines exactly as the API sent them (the app never recalculates). */
@Composable
fun LinesCard(lines: List<PricedLine>, modifier: Modifier = Modifier) {
    SectionCard(modifier, title = "Items") {
        if (lines.isEmpty()) {
            Text("No items", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        lines.forEachIndexed { index, line ->
            if (index > 0) HorizontalDivider(Modifier.padding(vertical = 4.dp))
            LineItem(line)
        }
    }
}

@Composable
private fun LineItem(line: PricedLine) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f).padding(end = 12.dp)) {
                Text(line.title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                line.variantLabel?.takeIf { it.isNotBlank() }?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Text(formatMoney(line.total), style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
        }
        SmallRow("Qty ${line.quantity} × ${formatMoney(line.unitPrice)}", formatMoney(line.subtotal))
        line.discount?.let { SmallRow("Discount · ${it.name}", "−" + formatMoney(it.amount), highlight = true) }
        if (line.orderDiscountShare > 0) SmallRow("Order discount share", "−" + formatMoney(line.orderDiscountShare), highlight = true)
        if (line.taxes.isEmpty()) {
            SmallRow("Tax", formatMoney(line.taxAmount))
        } else {
            line.taxes.forEach { SmallRow("Tax · ${it.name}", formatMoney(it.amount)) }
        }
    }
}

@Composable
private fun SmallRow(label: String, value: String, highlight: Boolean = false) {
    val color = if (highlight) StatusColors.success else MaterialTheme.colorScheme.onSurfaceVariant
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = color, modifier = Modifier.weight(1f).padding(end = 12.dp))
        Text(value, style = MaterialTheme.typography.bodySmall, color = color)
    }
}

@Composable
fun TotalsCard(
    untaxedAmount: Long,
    discountTotal: Long,
    taxTotal: Long,
    total: Long,
    orderDiscount: AppliedDiscount?,
    modifier: Modifier = Modifier,
    extra: @Composable () -> Unit = {},
) {
    SectionCard(modifier, title = "Totals") {
        LabelValueRow("Untaxed amount", formatMoney(untaxedAmount))
        if (discountTotal != 0L) LabelValueRow("Discounts", "−" + formatMoney(discountTotal))
        orderDiscount?.let {
            Text("Includes ${it.name}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        LabelValueRow("Tax", formatMoney(taxTotal))
        HorizontalDivider()
        LabelValueRow("Total", formatMoney(total), emphasized = true)
        extra()
    }
}
