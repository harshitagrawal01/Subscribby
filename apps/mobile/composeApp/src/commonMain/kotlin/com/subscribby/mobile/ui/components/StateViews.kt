package com.subscribby.mobile.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.subscribby.mobile.ui.theme.Palette

/** Grey block that gently pulses while content loads. */
@Composable
fun SkeletonBlock(width: Dp?, height: Dp, modifier: Modifier = Modifier) {
    val pulse by rememberInfiniteTransition(label = "skeleton").animateFloat(
        initialValue = 1f,
        targetValue = 0.55f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "skeleton-alpha",
    )
    Spacer(
        modifier
            .then(if (width != null) Modifier.width(width) else Modifier.fillMaxWidth())
            .height(height)
            .alpha(pulse)
            .clip(ControlShape)
            .background(Palette.Placeholder),
    )
}

/** Rows shaped like a list of documents: title and meta on the left, amount and status on the right. */
@Composable
fun ListSkeleton(modifier: Modifier = Modifier, rows: Int = 4) {
    Panel(modifier.testTag("loading")) {
        repeat(rows) { index ->
            if (index > 0) PanelDivider()
            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SkeletonBlock(140.dp, 14.dp)
                    SkeletonBlock(96.dp, 10.dp)
                }
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SkeletonBlock(72.dp, 14.dp)
                    SkeletonBlock(48.dp, 10.dp)
                }
            }
        }
    }
}

/** A hero figure followed by a list: the shape of the home and detail screens. */
@Composable
fun ScreenSkeleton(modifier: Modifier = Modifier, rows: Int = 3) {
    Column(
        modifier.fillMaxSize().padding(horizontal = ScreenPadding, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        SkeletonBlock(88.dp, 12.dp)
        SkeletonBlock(180.dp, 32.dp)
        SkeletonBlock(150.dp, 12.dp)
        Spacer(Modifier.height(GroupGap - 10.dp))
        ListSkeleton(rows = rows)
    }
}

/** One line saying what failed, and "Try again". */
@Composable
fun ErrorState(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        // Scrollable so pull-to-refresh still works around it.
        modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(ScreenPadding),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(message, style = MaterialTheme.typography.bodyMedium)
        SecondaryButton("Try again", onClick = onRetry, fillWidth = false, height = 40.dp)
    }
}

/** One line saying why it's empty, and at most one action. */
@Composable
fun EmptyState(
    message: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Panel(modifier) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(message, style = MaterialTheme.typography.bodyMedium, color = Palette.TextMuted)
            if (actionLabel != null && onAction != null) {
                TertiaryButton(onClick = onAction, contentPadding = PaddingValues(0.dp)) {
                    Text(actionLabel, style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }
}
