package com.subscribby.mobile.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.graphics.vector.group
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
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

/** The logo's two receipts as one flat silhouette, for texture on the ink hero card. */
fun logoSilhouetteVector(color: Color): ImageVector =
    ImageVector.Builder("subscribby-silhouette", 32.dp, 32.dp, 32f, 32f).apply {
        group(rotate = 9f, pivotX = 18f, pivotY = 14f) {
            addPath(addPathNodes(BACK), fill = SolidColor(color.copy(alpha = color.alpha * 0.55f)))
        }
        group(rotate = -5f, pivotX = 14f, pivotY = 18f) {
            addPath(addPathNodes(FRONT), fill = SolidColor(color))
        }
    }.build()

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

/** Receipt outline with a torn (zig-zag) bottom edge, like the web's paper receipts. */
class TornEdgeShape(private val tooth: Dp = 12.dp, private val depth: Dp = 6.dp) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline {
        val path = with(density) { tornPath(size, tooth.toPx(), depth.toPx()) }
        return Outline.Generic(path)
    }
}

private fun tornPath(size: Size, tooth: Float, depth: Float, topRadius: Float = 0f): Path = Path().apply {
    val teeth = (size.width / tooth).toInt().coerceAtLeast(2).let { if (it % 2 == 1) it + 1 else it }
    val step = size.width / teeth
    moveTo(0f, topRadius)
    if (topRadius > 0f) quadraticTo(0f, 0f, topRadius, 0f) else lineTo(0f, 0f)
    lineTo(size.width - topRadius, 0f)
    if (topRadius > 0f) quadraticTo(size.width, 0f, size.width, topRadius)
    lineTo(size.width, size.height - depth)
    for (i in 1..teeth) {
        val x = size.width - i * step
        lineTo(x, if (i % 2 == 1) size.height else size.height - depth)
    }
    close()
}

/** Small drawing for empty states: two receipts, the back one plain, the front one with lines. */
@Composable
fun EmptyReceipts(modifier: Modifier = Modifier, accent: Color = Palette.Ink1) {
    Canvas(modifier.size(width = 112.dp, height = 96.dp)) {
        val w = 54.dp.toPx()
        val h = 68.dp.toPx()
        val tooth = 9.dp.toPx()
        val depth = 4.5.dp.toPx()
        // Back receipt
        translate(left = size.width * 0.42f, top = 6.dp.toPx()) {
            rotate(10f, pivot = Offset(w / 2, h / 2)) {
                drawPath(tornPath(Size(w, h), tooth, depth, 6.dp.toPx()), Palette.PaperDeep)
            }
        }
        // Front receipt
        translate(left = size.width * 0.14f, top = 18.dp.toPx()) {
            rotate(-6f, pivot = Offset(w / 2, h / 2)) {
                val outline = tornPath(Size(w, h), tooth, depth, 6.dp.toPx())
                drawPath(outline, Palette.Surface)
                drawPath(outline, Palette.LineStrong, style = Stroke(1.5.dp.toPx()))
                receiptLines(w, accent)
            }
        }
    }
}

private fun DrawScope.receiptLines(w: Float, accent: Color) {
    val x0 = 10.dp.toPx()
    val stroke = 3.dp.toPx()
    drawLine(Palette.LineStrong, Offset(x0, 16.dp.toPx()), Offset(w - x0, 16.dp.toPx()), stroke, StrokeCap.Round)
    drawLine(Palette.Line, Offset(x0, 26.dp.toPx()), Offset(w * 0.62f, 26.dp.toPx()), stroke, StrokeCap.Round)
    drawLine(Palette.Line, Offset(x0, 36.dp.toPx()), Offset(w * 0.7f, 36.dp.toPx()), stroke, StrokeCap.Round)
    drawCircle(accent, radius = 5.dp.toPx(), center = Offset(w - 15.dp.toPx(), 50.dp.toPx()))
}
