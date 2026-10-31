package com.subscribby.mobile.ui.components

import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.subscribby.mobile.ui.theme.Palette

val PanelShape = RoundedCornerShape(10.dp)
val ControlShape = RoundedCornerShape(6.dp)

/** Spacing between groups on a screen; tight spacing inside groups is 4-8dp. */
val GroupGap = 28.dp
val ScreenPadding = 16.dp

/**
 * 2dp ink-6 ring while the element has keyboard focus. [outset] > 0 draws outside the bounds
 * (buttons), < 0 inside (full-width rows that would otherwise be clipped).
 */
@Composable
fun Modifier.focusRing(source: InteractionSource, corner: Dp = 6.dp, outset: Dp = 3.dp): Modifier {
    val focused by source.collectIsFocusedAsState()
    if (!focused) return this
    return drawWithContent {
        drawContent()
        val o = outset.toPx()
        val r = (corner.toPx() + o).coerceAtLeast(0f)
        drawRoundRect(
            color = Palette.Ink6,
            topLeft = Offset(-o, -o),
            size = Size(size.width + 2 * o, size.height + 2 * o),
            cornerRadius = CornerRadius(r, r),
            style = Stroke(width = 2.dp.toPx()),
        )
    }
}

/** Whole-row tap target with ripple and a focus ring. */
@Composable
fun Modifier.rowClickable(onClick: () -> Unit): Modifier {
    val source = remember { MutableInteractionSource() }
    return this
        .focusRing(source, corner = 0.dp, outset = (-2).dp)
        .clickable(interactionSource = source, indication = LocalIndication.current, role = Role.Button, onClick = onClick)
}

/** Flat white panel with a warm-grey border. No elevation. */
@Composable
fun Panel(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(PanelShape)
            .background(Palette.Surface)
            .border(1.dp, Palette.Line, PanelShape),
        content = content,
    )
}

@Composable
fun PanelDivider(modifier: Modifier = Modifier) {
    HorizontalDivider(modifier, thickness = 1.dp, color = Palette.Line)
}

/** 16sp section heading with an optional quiet trailing note (a count, a date). */
@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier, trailing: String? = null) {
    Row(modifier.fillMaxWidth().padding(bottom = 8.dp), verticalAlignment = Alignment.Bottom) {
        Text(text, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
        if (trailing != null) Text(trailing, style = MaterialTheme.typography.bodySmall, color = Palette.TextMuted)
    }
}

/** Label on the left, value on the right, inside a [Panel]. */
@Composable
fun KeyValueRow(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    dense: Boolean = false,
) {
    KeyValueRow(label, modifier, onClick, dense) {
        Text(value, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.End)
    }
}

@Composable
fun KeyValueRow(
    label: String,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    dense: Boolean = false,
    value: @Composable RowScope.() -> Unit,
) {
    // Tappable rows keep a 48dp target; read-only rows are tighter, and tighter still when [dense].
    val minHeight = when {
        onClick != null -> 48.dp
        dense -> 0.dp
        else -> 44.dp
    }
    Row(
        modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.rowClickable(onClick) else Modifier)
            .heightIn(min = minHeight)
            .padding(horizontal = 16.dp, vertical = if (dense) 5.dp else 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = Palette.TextMuted)
        Row(
            Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.End),
            verticalAlignment = Alignment.CenterVertically,
            content = value,
        )
        if (onClick != null) {
            Icon(AppIcons.ChevronRight, contentDescription = null, tint = Palette.TextFaint, modifier = Modifier.size(16.dp))
        }
    }
}

/** Top bar: optional back link on the left, title, optional actions on the right. */
@Composable
fun ScreenHeader(
    title: String?,
    modifier: Modifier = Modifier,
    backLabel: String? = null,
    onBack: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    Column(modifier.fillMaxWidth().background(Palette.Paper).windowInsetsPadding(WindowInsets.statusBars)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(start = if (onBack != null) 4.dp else ScreenPadding, end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (onBack != null) {
                BackButton(onBack, backLabel)
                Spacer(Modifier.weight(1f))
            } else if (title != null) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleLarge,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
            }
            actions()
        }
    }
}

/** "← Invoices": says where back goes. */
@Composable
fun BackButton(onBack: () -> Unit, label: String? = null) {
    TertiaryButton(onClick = onBack, contentPadding = PaddingValues(horizontal = 12.dp)) {
        Icon(AppIcons.ArrowLeft, contentDescription = "Back", modifier = Modifier.size(18.dp))
        if (label != null) {
            Spacer(Modifier.width(6.dp))
            Text(label, style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
fun HeaderIconButton(icon: ImageVector, description: String, onClick: () -> Unit) {
    IconButton(onClick = onClick) {
        Icon(icon, contentDescription = description, tint = Palette.TextMuted, modifier = Modifier.size(20.dp))
    }
}

@Composable
fun ConfirmDialog(
    title: String,
    message: String,
    confirmLabel: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    destructive: Boolean = false,
    dismissLabel: String = "Cancel",
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        shape = PanelShape,
        containerColor = Palette.Surface,
        tonalElevation = 0.dp,
        title = { Text(withDocNumbers(title), style = MaterialTheme.typography.titleMedium) },
        text = { Text(message, style = MaterialTheme.typography.bodyMedium, color = Palette.TextMuted) },
        confirmButton = {
            PrimaryButton(confirmLabel, onClick = onConfirm, destructive = destructive, fillWidth = false, height = 40.dp)
        },
        dismissButton = { SecondaryButton(dismissLabel, onClick = onDismiss, fillWidth = false, height = 40.dp) },
    )
}

/** Small coloured dot used by status text and notices. */
@Composable
fun Dot(color: Color, modifier: Modifier = Modifier, size: Dp = 7.dp) {
    Spacer(modifier.size(size).clip(RoundedCornerShape(50)).background(color))
}
