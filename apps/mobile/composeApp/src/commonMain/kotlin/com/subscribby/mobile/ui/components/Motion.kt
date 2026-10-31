package com.subscribby.mobile.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

/** Shared motion tokens: enter decelerates, exit accelerates and is quicker than enter. */
object Motion {
    val EaseOut = CubicBezierEasing(0.2f, 0f, 0f, 1f)
    val EaseIn = CubicBezierEasing(0.3f, 0f, 1f, 1f)
    const val ENTER = 320
    const val EXIT = 200
    const val QUICK = 160
}

/** Provided once at the root so leaf components don't each query the platform. */
val LocalReduceMotion = staticCompositionLocalOf { false }

/** Gentle 0.97 squeeze while pressed (transform only, so it never moves layout). */
@Composable
fun Modifier.pressScale(source: InteractionSource, pressedScale: Float = 0.97f): Modifier {
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) pressedScale else 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMediumLow),
        label = "press-scale",
    )
    return graphicsLayer {
        scaleX = scale
        scaleY = scale
    }
}

/**
 * Fade + 12dp rise the first time an item appears. [index] staggers by 40ms (capped so long lists
 * never feel slow). [enabled] = false shows it immediately (already played, or reduce motion).
 */
@Composable
fun Modifier.entrance(index: Int = 0, enabled: Boolean = true): Modifier {
    val reduce = LocalReduceMotion.current
    if (!enabled || reduce) return this
    val progress = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        delay(40L * index.coerceAtMost(8))
        progress.animateTo(1f, tween(Motion.ENTER + 60, easing = Motion.EaseOut))
    }
    val rise = with(LocalDensity.current) { 12.dp.toPx() }
    return graphicsLayer {
        alpha = progress.value
        translationY = (1f - progress.value) * rise
    }
}
