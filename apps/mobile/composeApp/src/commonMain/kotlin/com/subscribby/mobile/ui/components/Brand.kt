package com.subscribby.mobile.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.graphics.vector.group
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.subscribby.mobile.ui.theme.LocalWordmarkStyle
import com.subscribby.mobile.ui.theme.Palette

// Same geometry as apps/web/src/components/Logo.tsx (viewBox 0 0 32 32).
private const val BACK =
    "M11.4 3 H24.6 A2.4 2.4 0 0 1 27 5.4 V24 l-3.000 -2.0 l-3.000 2.0 l-3.000 -2.0 l-3.000 2.0 l-3.000 -2.0 l-3.000 2.0 V5.4 A2.4 2.4 0 0 1 11.4 3 Z"
private const val FRONT =
    "M7.4 7 H20.6 A2.4 2.4 0 0 1 23 9.4 V28.5 l-3.000 -2.0 l-3.000 2.0 l-3.000 -2.0 l-3.000 2.0 l-3.000 -2.0 l-3.000 2.0 V9.4 A2.4 2.4 0 0 1 7.4 7 Z"
private const val LINES = "M9.5 13.2 H18.5 M9.5 17.4 H15.5"
private const val DOT = "M15.3 21.6 a2.3 2.3 0 1 0 4.6 0 a2.3 2.3 0 1 0 -4.6 0 Z"

/** Two receipts, one tucked behind the other, with a punched dot. [light] is for dark backgrounds. */
fun logoMarkVector(light: Boolean = false): ImageVector {
    val ink = if (light) Color(0xFFFBF7EF) else Palette.BrandInk
    return ImageVector.Builder("subscribby-mark", 32.dp, 32.dp, 32f, 32f).apply {
        group(rotate = 9f, pivotX = 18f, pivotY = 14f) {
            addPath(addPathNodes(BACK), fill = SolidColor(ink))
        }
        group(rotate = -5f, pivotX = 14f, pivotY = 18f) {
            addPath(addPathNodes(FRONT), fill = SolidColor(Palette.Marigold))
            addPath(
                addPathNodes(LINES),
                fill = null,
                stroke = SolidColor(Palette.BrandInk),
                strokeLineWidth = 2.1f,
                strokeLineCap = StrokeCap.Round,
            )
            addPath(addPathNodes(DOT), fill = SolidColor(Palette.BrandInk))
        }
    }.build()
}

@Composable
fun LogoMark(size: Dp = 28.dp, modifier: Modifier = Modifier) {
    val vector = remember { logoMarkVector() }
    Image(vector, contentDescription = null, modifier = modifier.size(size))
}

/** Mark + lowercase "subscribby" in Fraunces. */
@Composable
fun BrandMark(modifier: Modifier = Modifier, markSize: Dp = 28.dp, wordSize: TextUnit = 22.sp) {
    Row(
        modifier.semantics(mergeDescendants = true) { contentDescription = "Subscribby" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        LogoMark(markSize)
        Text("subscribby", style = LocalWordmarkStyle.current.copy(fontSize = wordSize, lineHeight = wordSize))
    }
}
