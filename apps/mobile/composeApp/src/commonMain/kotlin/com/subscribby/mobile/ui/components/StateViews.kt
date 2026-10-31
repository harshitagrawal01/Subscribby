package com.subscribby.mobile.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.ui.theme.Radii

/** Soft light sweep across a placeholder (static with reduce motion). */
@Composable
fun Modifier.shimmer(base: Color = Palette.Placeholder): Modifier {
    if (LocalReduceMotion.current) return background(base)
    val progress by rememberInfiniteTransition(label = "shimmer").animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1400, easing = LinearEasing), RepeatMode.Restart),
        label = "shimmer-progress",
    )
    val highlight = Color(0xFFF7F4EE)
    return drawWithCache {
        val band = size.width.coerceAtLeast(240f)
        val x = -band + (size.width + 2 * band) * progress
        val brush = Brush.linearGradient(listOf(base, highlight, base), start = Offset(x, 0f), end = Offset(x + band, size.height))
        onDrawBehind { drawRect(brush) }
    }
}

@Composable
fun SkeletonBlock(width: Dp?, height: Dp, modifier: Modifier = Modifier, shape: Shape = RoundedCornerShape(6.dp)) {
    Spacer(
        modifier
            .then(if (width != null) Modifier.width(width) else Modifier.fillMaxWidth())
            .height(height)
            .clip(shape)
            .shimmer(),
    )
}

/** Rows shaped like the real list: tile, title + meta, amount + status. */
@Composable
fun ListSkeleton(modifier: Modifier = Modifier, rows: Int = 4) {
    InsetGroup(modifier.testTag("loading").semantics { contentDescription = "Loading" }) {
        repeat(rows) { index ->
            if (index > 0) GroupDivider(start = 68.dp)
            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                SkeletonBlock(40.dp, 40.dp, shape = RoundedCornerShape(12.dp))
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SkeletonBlock(132.dp, 14.dp)
                    SkeletonBlock(92.dp, 11.dp)
                }
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SkeletonBlock(76.dp, 14.dp)
                    SkeletonBlock(48.dp, 11.dp)
                }
            }
        }
    }
}

/** The hero card's footprint, then a list. */
@Composable
fun HomeSkeleton(modifier: Modifier = Modifier) {
    Column(modifier.padding(horizontal = ScreenPadding), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SkeletonBlock(null, 212.dp, shape = RoundedCornerShape(Radii.hero))
        Spacer(Modifier.height(GroupGap - 12.dp))
        SkeletonBlock(150.dp, 16.dp)
        ListSkeleton(rows = 2)
    }
}

/** A figure block and a list: detail screens. */
@Composable
fun DetailSkeleton(modifier: Modifier = Modifier, rows: Int = 3) {
    Column(modifier.padding(horizontal = ScreenPadding), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SkeletonBlock(null, 120.dp, shape = RoundedCornerShape(Radii.card))
        Spacer(Modifier.height(GroupGap - 12.dp))
        ListSkeleton(rows = rows)
    }
}

/** Centered receipt drawing, one line of why, one action. */
@Composable
fun EmptyState(
    message: String,
    modifier: Modifier = Modifier,
    title: String? = null,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Column(
        modifier.fillMaxWidth().paperCard(GroupShape).padding(horizontal = 24.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        EmptyReceipts()
        Spacer(Modifier.height(16.dp))
        if (title != null) {
            Text(title, style = MaterialTheme.typography.titleLarge, color = Palette.Text, textAlign = TextAlign.Center)
            Spacer(Modifier.height(6.dp))
        }
        Text(message, style = MaterialTheme.typography.bodyMedium, color = Palette.TextMuted, textAlign = TextAlign.Center)
        if (actionLabel != null && onAction != null) {
            Spacer(Modifier.height(8.dp))
            TertiaryButton(actionLabel, onClick = onAction)
        }
    }
}

/** What failed, in one line, and "Try again". */
@Composable
fun ErrorState(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxWidth().padding(horizontal = ScreenPadding).paperCard(GroupShape).padding(horizontal = 24.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(48.dp).clip(RoundedCornerShape(16.dp)).background(com.subscribby.mobile.ui.theme.StatusColors.overdueTint),
            contentAlignment = Alignment.Center,
        ) {
            androidx.compose.material3.Icon(
                AppIcons.AlertCircle,
                contentDescription = null,
                tint = com.subscribby.mobile.ui.theme.StatusColors.overdue,
                modifier = Modifier.size(24.dp),
            )
        }
        Spacer(Modifier.height(14.dp))
        Text(message, style = MaterialTheme.typography.bodyMedium, color = Palette.Text, textAlign = TextAlign.Center)
        Spacer(Modifier.height(16.dp))
        SecondaryButton("Try again", onClick = onRetry, fillWidth = false, height = 44.dp)
    }
}
