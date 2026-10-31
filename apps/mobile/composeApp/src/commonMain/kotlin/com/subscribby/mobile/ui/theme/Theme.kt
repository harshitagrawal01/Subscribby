package com.subscribby.mobile.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.subscribby.mobile.resources.Res
import com.subscribby.mobile.resources.fraunces_heading
import com.subscribby.mobile.resources.ibm_plex_mono_medium
import com.subscribby.mobile.resources.ibm_plex_mono_regular
import com.subscribby.mobile.resources.ibm_plex_sans_medium
import com.subscribby.mobile.resources.ibm_plex_sans_regular
import com.subscribby.mobile.resources.ibm_plex_sans_semibold
import org.jetbrains.compose.resources.Font

/** Design tokens from apps/web/docs/design.md: ledger ink on warm paper. */
object Palette {
    val Ink9 = Color(0xFF162741)
    val Ink8 = Color(0xFF223A5E)
    val Ink6 = Color(0xFF3D5F91)
    val Ink1 = Color(0xFFD9E1EC)
    val Ink0 = Color(0xFFEEF2F7)

    val Paper = Color(0xFFF7F5F1)
    val Surface = Color(0xFFFFFFFF)
    val Line = Color(0xFFE4E0D8)
    /** Input borders: a step darker than [Line] so fields read as fields. */
    val LineStrong = Color(0xFFCFCAC0)
    /** Skeleton blocks. */
    val Placeholder = Color(0xFFECE8E1)

    val Text = Color(0xFF1C1B19)
    val TextMuted = Color(0xFF6B675F)
    val TextFaint = Color(0xFF8F8A80)

    /** Brand: logo ink, logo marigold (logo only), and the warmer paper behind the auth sheet. */
    val BrandInk = Color(0xFF1D2B44)
    val Marigold = Color(0xFFF2B544)
    val AuthPaper = Color(0xFFF4EFE6)
}

/** Status colours: text plus a 7dp dot, never pills. */
object StatusColors {
    val active = Color(0xFF2F7A4F)
    val overdue = Color(0xFFB42318)
    val quotation = Color(0xFFA15C00)
    val confirmed = Palette.Ink6
    val paused = Color(0xFF8A6A1F)
    val draft = Color(0xFF8F8A80)
    val closed = Color(0xFF4F4C46)
}

private val Colors = lightColorScheme(
    primary = Palette.Ink8,
    onPrimary = Color.White,
    primaryContainer = Palette.Ink0,
    onPrimaryContainer = Palette.Ink9,
    inversePrimary = Palette.Ink1,
    secondary = Palette.Ink6,
    onSecondary = Color.White,
    secondaryContainer = Palette.Ink1,
    onSecondaryContainer = Palette.Ink9,
    tertiary = Palette.Ink6,
    onTertiary = Color.White,
    tertiaryContainer = Palette.Ink0,
    onTertiaryContainer = Palette.Ink9,
    background = Palette.Paper,
    onBackground = Palette.Text,
    surface = Palette.Paper,
    onSurface = Palette.Text,
    surfaceVariant = Palette.Paper,
    onSurfaceVariant = Palette.TextMuted,
    surfaceTint = Color.Transparent,
    surfaceBright = Palette.Surface,
    surfaceDim = Palette.Paper,
    surfaceContainerLowest = Palette.Surface,
    surfaceContainerLow = Palette.Surface,
    surfaceContainer = Palette.Surface,
    surfaceContainerHigh = Palette.Surface,
    surfaceContainerHighest = Palette.Surface,
    inverseSurface = Palette.Text,
    inverseOnSurface = Palette.Paper,
    outline = Palette.LineStrong,
    outlineVariant = Palette.Line,
    error = StatusColors.overdue,
    onError = Color.White,
    errorContainer = Color(0xFFFCEFEE),
    onErrorContainer = Color(0xFF7A1A12),
    scrim = Color(0xFF1C1B19),
)

// 6dp controls, 10dp panels and dialogs (same as the web theme).
private val AppShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(6.dp),
    medium = RoundedCornerShape(6.dp),
    large = RoundedCornerShape(10.dp),
    extraLarge = RoundedCornerShape(10.dp),
)

/** Plex Mono, only for document numbers (SUB/2026/0042, INV/2026/0311). */
val LocalMonoFamily = staticCompositionLocalOf<FontFamily> { FontFamily.Monospace }

/** Lowercase "subscribby" next to the logo mark. */
val LocalWordmarkStyle = staticCompositionLocalOf { TextStyle.Default }

/** The single large figure a screen is built around (amount due, balance due). */
val LocalHeroStyle = staticCompositionLocalOf { TextStyle.Default }

@Composable
private fun plexSans() = FontFamily(
    Font(Res.font.ibm_plex_sans_regular, FontWeight.Normal),
    Font(Res.font.ibm_plex_sans_medium, FontWeight.Medium),
    Font(Res.font.ibm_plex_sans_semibold, FontWeight.SemiBold),
)

/**
 * Fraunces pinned to wght 640, SOFT 100, WONK 1, opsz 48 (a static instance of the variable font),
 * so titles look the same on Android, iOS and desktop.
 */
@Composable
private fun fraunces() = FontFamily(Font(Res.font.fraunces_heading, FontWeight.SemiBold))

@Composable
private fun plexMono() = FontFamily(
    Font(Res.font.ibm_plex_mono_regular, FontWeight.Normal),
    Font(Res.font.ibm_plex_mono_medium, FontWeight.Medium),
)

// Scale: 12 meta, 13 labels, 14 body, 16 section title, 22 screen title (serif), 28 auth title, 32 hero.
private fun typography(sans: FontFamily, serif: FontFamily): Typography {
    fun style(size: Int, line: Int, weight: FontWeight = FontWeight.Normal) =
        TextStyle(
            fontFamily = sans,
            fontSize = size.sp,
            lineHeight = line.sp,
            fontWeight = weight,
            letterSpacing = 0.sp,
            // Tabular figures so amounts and dates line up; ss02 matches the web app's Plex.
            fontFeatureSettings = "tnum, ss02",
        )
    fun heading(size: Int, line: Int) =
        TextStyle(fontFamily = serif, fontSize = size.sp, lineHeight = line.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.025).em)
    return Typography(
        displayLarge = heading(32, 40),
        displayMedium = heading(28, 36),
        displaySmall = heading(28, 36),
        headlineLarge = heading(28, 34),
        headlineMedium = heading(22, 28),
        headlineSmall = heading(22, 28),
        titleLarge = heading(22, 28),
        titleMedium = style(16, 24, FontWeight.SemiBold),
        titleSmall = style(14, 20, FontWeight.Medium),
        bodyLarge = style(16, 24),
        bodyMedium = style(14, 21),
        bodySmall = style(12, 18),
        labelLarge = style(14, 20, FontWeight.Medium),
        labelMedium = style(13, 18, FontWeight.Medium),
        labelSmall = style(12, 16, FontWeight.Medium),
    )
}

/** Light only on purpose: the ledger look is ink on paper. No dynamic colour. */
@Composable
fun SubscribbyTheme(content: @Composable () -> Unit) {
    val sans = plexSans()
    val serif = fraunces()
    val mono = plexMono()
    val wordmark = TextStyle(fontFamily = serif, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.025).em, color = Palette.BrandInk)
    // Money is Plex Sans with tabular figures; mono figures this large read like code.
    val hero = TextStyle(
        fontFamily = sans,
        fontSize = 32.sp,
        lineHeight = 40.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = (-0.5).sp,
        fontFeatureSettings = "tnum, ss02",
    )
    MaterialTheme(colorScheme = Colors, shapes = AppShapes, typography = typography(sans, serif)) {
        CompositionLocalProvider(
            LocalMonoFamily provides mono,
            LocalHeroStyle provides hero,
            LocalWordmarkStyle provides wordmark,
            content = content,
        )
    }
}
