package com.subscribby.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.subscribby.mobile.ui.theme.StatusColors
import com.subscribby.mobile.util.Labels

@Composable
fun StatusChip(label: String, color: Color, container: Color, modifier: Modifier = Modifier) {
    Text(
        text = label,
        color = color,
        style = MaterialTheme.typography.labelMedium,
        fontWeight = FontWeight.SemiBold,
        modifier = modifier
            .background(container, RoundedCornerShape(50))
            .padding(horizontal = 10.dp, vertical = 3.dp),
    )
}

@Composable
fun SubscriptionStatusChip(status: String, modifier: Modifier = Modifier) {
    val (color, container) = when (status) {
        "quotation" -> StatusColors.info to StatusColors.infoContainer
        "confirmed" -> MaterialTheme.colorScheme.primary to MaterialTheme.colorScheme.primaryContainer
        "active" -> StatusColors.success to StatusColors.successContainer
        "paused" -> StatusColors.warning to StatusColors.warningContainer
        else -> StatusColors.neutral to StatusColors.neutralContainer
    }
    StatusChip(Labels.subscriptionStatus(status), color, container, modifier)
}

/** Overdue wins over the stored status (overdue is computed by the API, never stored). */
@Composable
fun InvoiceStatusChip(status: String, isOverdue: Boolean, modifier: Modifier = Modifier) {
    if (isOverdue) {
        StatusChip("Overdue", MaterialTheme.colorScheme.error, MaterialTheme.colorScheme.errorContainer, modifier)
        return
    }
    val (color, container) = when (status) {
        "paid" -> StatusColors.success to StatusColors.successContainer
        "confirmed" -> StatusColors.info to StatusColors.infoContainer
        else -> StatusColors.neutral to StatusColors.neutralContainer
    }
    StatusChip(Labels.invoiceStatus(status), color, container, modifier)
}
