package com.subscribby.mobile.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.ui.theme.StatusColors

private val ButtonPadding = PaddingValues(horizontal = 16.dp)

private fun Modifier.sized(fillWidth: Boolean, height: Dp) =
    (if (fillWidth) fillMaxWidth() else this).height(height)

/** Filled ink. One per screen. */
@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    destructive: Boolean = false,
    fillWidth: Boolean = true,
    height: Dp = 48.dp,
) {
    val source = remember { MutableInteractionSource() }
    val color = if (destructive) StatusColors.overdue else Palette.Ink8
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        shape = ControlShape,
        elevation = null,
        contentPadding = ButtonPadding,
        interactionSource = source,
        colors = ButtonDefaults.buttonColors(
            containerColor = color,
            contentColor = Color.White,
            disabledContainerColor = if (loading) color else color.copy(alpha = 0.35f),
            disabledContentColor = Color.White,
        ),
        modifier = modifier.focusRing(source).sized(fillWidth, height),
    ) {
        if (loading) Spinner(Color.White) else Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

/** Outlined, white fill. For the second most important action. */
@Composable
fun SecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    destructive: Boolean = false,
    fillWidth: Boolean = true,
    height: Dp = 48.dp,
) {
    val source = remember { MutableInteractionSource() }
    val content = if (destructive) StatusColors.overdue else Palette.Ink8
    OutlinedButton(
        onClick = onClick,
        enabled = enabled && !loading,
        shape = ControlShape,
        contentPadding = ButtonPadding,
        interactionSource = source,
        border = BorderStroke(1.dp, Palette.LineStrong),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = Palette.Surface,
            contentColor = content,
            disabledContainerColor = Palette.Surface,
            disabledContentColor = content.copy(alpha = 0.4f),
        ),
        modifier = modifier.focusRing(source).sized(fillWidth, height),
    ) {
        if (loading) Spinner(content) else Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

/** Text only. For links and low-stakes actions. */
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
    contentPadding: PaddingValues = PaddingValues(horizontal = 8.dp),
    content: @Composable RowScope.() -> Unit,
) {
    val source = remember { MutableInteractionSource() }
    TextButton(
        onClick = onClick,
        enabled = enabled,
        shape = ControlShape,
        contentPadding = contentPadding,
        interactionSource = source,
        colors = ButtonDefaults.textButtonColors(
            contentColor = if (destructive) StatusColors.overdue else Palette.Ink8,
        ),
        modifier = modifier.focusRing(source, outset = 0.dp).heightIn(min = 40.dp),
        content = content,
    )
}

@Composable
private fun Spinner(color: Color) {
    CircularProgressIndicator(Modifier.size(18.dp), color = color, strokeWidth = 2.dp)
}
