package com.subscribby.mobile.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.tween
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.ui.theme.StatusColors

private val ButtonShape = RoundedCornerShape(16.dp)

/** Shared body for every button: press squeeze, ripple, focus ring, spinner while loading. */
@Composable
private fun ButtonBase(
    onClick: () -> Unit,
    container: Color,
    content: Color,
    modifier: Modifier,
    enabled: Boolean,
    loading: Boolean,
    fillWidth: Boolean,
    height: Dp,
    label: String,
    icon: ImageVector? = null,
) {
    val source = remember { MutableInteractionSource() }
    val active = enabled && !loading
    Box(
        modifier
            .then(if (fillWidth) Modifier.fillMaxWidth() else Modifier)
            .heightIn(min = height)
            .pressScale(source)
            .focusRing(source, corner = 16.dp)
            .clip(ButtonShape)
            .background(if (enabled || loading) container else container.copy(alpha = 0.4f))
            .clickable(
                interactionSource = source,
                indication = LocalIndication.current,
                enabled = active,
                role = Role.Button,
                onClick = onClick,
            )
            .padding(horizontal = 20.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        AnimatedContent(
            targetState = loading,
            transitionSpec = { fadeIn(tween(Motion.QUICK)) togetherWith fadeOut(tween(Motion.QUICK)) },
            label = "button-loading",
        ) { busy ->
            if (busy) {
                CircularProgressIndicator(Modifier.size(20.dp), color = content, strokeWidth = 2.dp)
            } else {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(label, style = MaterialTheme.typography.labelLarge, color = content, textAlign = TextAlign.Center)
                    if (icon != null) Icon(icon, contentDescription = null, tint = content, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

/** Filled ink. The one primary action on a screen. */
@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    destructive: Boolean = false,
    fillWidth: Boolean = true,
    height: Dp = 52.dp,
    icon: ImageVector? = null,
) = ButtonBase(
    onClick = onClick,
    container = if (destructive) StatusColors.overdue else Palette.Ink8,
    content = Color.White,
    modifier = modifier,
    enabled = enabled,
    loading = loading,
    fillWidth = fillWidth,
    height = height,
    label = text,
    icon = icon,
)

/** Tonal ink tint (or red tint when destructive). For the second most important action. */
@Composable
fun SecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    destructive: Boolean = false,
    fillWidth: Boolean = true,
    height: Dp = 52.dp,
) = ButtonBase(
    onClick = onClick,
    container = if (destructive) StatusColors.overdueTint else Palette.Ink0,
    content = if (destructive) StatusColors.overdue else Palette.Ink8,
    modifier = modifier,
    enabled = enabled,
    loading = loading,
    fillWidth = fillWidth,
    height = height,
    label = text,
)

/** Cream on the dark ink hero card. */
@Composable
fun OnInkButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, icon: ImageVector? = null) = ButtonBase(
    onClick = onClick,
    container = Palette.OnInk,
    content = Palette.Ink9,
    modifier = modifier,
    enabled = true,
    loading = false,
    fillWidth = false,
    height = 44.dp,
    label = text,
    icon = icon,
)

/** Text only. For links and low-stakes actions. 48dp tall. */
@Composable
fun TertiaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    destructive: Boolean = false,
) {
    TertiaryButton(onClick, modifier, enabled, destructive) {
        Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun TertiaryButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    destructive: Boolean = false,
    contentPadding: PaddingValues = PaddingValues(horizontal = 12.dp),
    content: @Composable RowScope.() -> Unit,
) {
    val source = remember { MutableInteractionSource() }
    val color = if (destructive) StatusColors.overdue else Palette.Ink8
    Row(
        modifier
            .heightIn(min = 48.dp)
            .focusRing(source, corner = 12.dp, outset = 0.dp)
            .clip(RoundedCornerShape(12.dp))
            .clickable(interactionSource = source, indication = LocalIndication.current, enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(contentPadding),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        androidx.compose.runtime.CompositionLocalProvider(
            androidx.compose.material3.LocalContentColor provides if (enabled) color else color.copy(alpha = 0.4f),
        ) { content() }
    }
}
