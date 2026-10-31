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
    /** One step down from [Paper]: segmented-control track, pressed rows. */
    val PaperDeep = Color(0xFFEDE9E1)
    val Surface = Color(0xFFFFFFFF)
    /** Receipt paper: a hair warmer than white. */
    val Receipt = Color(0xFFFFFEFB)
    val Line = Color(0xFFE4E0D8)
    /** Input borders: a step darker than [Line] so fields read as fields. */
    val LineStrong = Color(0xFFCFCAC0)
    /** Skeleton blocks. */
    val Placeholder = Color(0xFFECE8E1)

    val Text = Color(0xFF1C1B19)
    val TextMuted = Color(0xFF6B675F)
    /** Hints and meta text: 5.0:1 on white, 4.6:1 on paper (AA). */
    val TextFaint = Color(0xFF736E64)

    /** Brand: logo ink, logo marigold (logo only), and the warmer paper behind the auth screens. */
    val BrandInk = Color(0xFF1D2B44)
    val Marigold = Color(0xFFF2B544)
    val AuthPaper = Color(0xFFF4EFE6)

    /** Warm shadow tint so depth reads as paper on paper, not grey plastic. */
    val Shadow = Color(0xFF3C2D14)

    /** Text on the deep ink hero card. */
    val OnInk = Color(0xFFFBF7EF)
    val OnInkMuted = Color(0xB8FBF7EF)
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

    /** Soft tints of the status hues for icon tiles and notices. */
    val activeTint = Color(0xFFE8F2EC)
    val overdueTint = Color(0xFFFCEDEB)
    val quotationTint = Color(0xFFFAEEDB)

    /** Status hues lifted for the dark ink card (contrast ≥ 4.5:1 on Ink9). */
    val overdueOnInk = Color(0xFFFFB4A9)
    val activeOnInk = Color(0xFF9FD9B5)
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
    surfaceVariant = Palette.PaperDeep,
    onSurfaceVariant = Palette.TextMuted,
    surfaceTint = Color.Transparent,
    surfaceBright = Palette.Surface,
    surfaceDim = Palette.Paper,
    surfaceContainerLowest = Palette.Surface,
    surfaceContainerLow = Palette.Surface,
    surfaceContainer = Palette.Surface,
    surfaceContainerHigh = Palette.Surface,
    surfaceContainerHighest = Palette.Surface,
    inverseSurface = Palette.Ink9,
    inverseOnSurface = Palette.OnInk,
    outline = Palette.LineStrong,
    outlineVariant = Palette.Line,
    error = StatusColors.overdue,
    onError = Color.White,
    errorContainer = StatusColors.overdueTint,
    onErrorContainer = Color(0xFF7A1A12),
    scrim = Color(0xFF1C1B19),
)

/**
 * Mobile radii. The web uses 6/10/18; on a phone those read as boxy web panels, so controls get
 * 14dp, grouped lists 18dp, cards 22dp, the hero card 26dp and sheets 28dp (same family, scaled for touch).
 */
object Radii {
    val control = 14.dp
    val group = 18.dp
    val card = 22.dp
    val hero = 26.dp
    val sheet = 28.dp
}

private val AppShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(Radii.control),
    medium = RoundedCornerShape(Radii.control),
    large = RoundedCornerShape(Radii.group),
    extraLarge = RoundedCornerShape(Radii.sheet),
)

/** Plex Mono, only for document numbers (SUB/2026/0042, INV/2026/0311). */
val LocalMonoFamily = staticCompositionLocalOf<FontFamily> { FontFamily.Monospace }

/** Fraunces, for brand moments drawn outside the Material type scale (avatar initials). */
val LocalSerifFamily = staticCompositionLocalOf<FontFamily> { FontFamily.Serif }

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

/**
 * Mobile scale (all sp, so it follows the system font size):
 * 34 large title (serif) · 24 sheet title (serif) · 20 card title (serif) ·
 * 17 bar title / strong total · 16 body & row title · 15 secondary body · 13 meta · 11 tab label.
 */
private fun typography(sans: FontFamily, serif: FontFamily): Typography {
    fun style(size: Int, line: Int, weight: FontWeight = FontWeight.Normal, tracking: Double = 0.0) =
        TextStyle(
            fontFamily = sans,
            fontSize = size.sp,
            lineHeight = line.sp,
            fontWeight = weight,
            letterSpacing = tracking.sp,
            // Tabular figures so amounts and dates line up; ss02 matches the web app's Plex.
            fontFeatureSettings = "tnum, ss02",
        )
    fun heading(size: Int, line: Int) =
        TextStyle(fontFamily = serif, fontSize = size.sp, lineHeight = line.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.02).em)
    return Typography(
        displayLarge = heading(34, 41),
        displayMedium = heading(30, 36),
        displaySmall = heading(28, 34),
        headlineLarge = heading(28, 34),
        headlineMedium = heading(24, 30),
        headlineSmall = heading(22, 28),
        titleLarge = heading(20, 26),
        titleMedium = style(17, 24, FontWeight.SemiBold, -0.1),
        titleSmall = style(16, 22, FontWeight.Medium),
        bodyLarge = style(16, 24),
        bodyMedium = style(15, 22),
        bodySmall = style(13, 18),
        labelLarge = style(16, 20, FontWeight.SemiBold),
        labelMedium = style(13, 18, FontWeight.Medium),
        labelSmall = style(11, 14, FontWeight.Medium, 0.1),
    )
}

/** Light only on purpose: the ledger look is ink on paper. No dynamic colour, even if the phone is dark. */
@Composable
fun SubscribbyTheme(content: @Composable () -> Unit) {
    val sans = plexSans()
    val serif = fraunces()
    val mono = plexMono()
    val wordmark = TextStyle(fontFamily = serif, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.025).em, color = Palette.BrandInk)
    // Money is Plex Sans with tabular figures; mono figures this large read like code.
    val hero = TextStyle(
        fontFamily = sans,
        fontSize = 44.sp,
        lineHeight = 52.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = (-1.2).sp,
        fontFeatureSettings = "tnum, ss02",
    )
    MaterialTheme(colorScheme = Colors, shapes = AppShapes, typography = typography(sans, serif)) {
        CompositionLocalProvider(
            LocalMonoFamily provides mono,
            LocalSerifFamily provides serif,
            LocalHeroStyle provides hero,
            LocalWordmarkStyle provides wordmark,
            content = content,
        )
    }
}
