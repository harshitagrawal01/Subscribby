package com.subscribby.mobile.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/** Subscribby violet. */
val Violet = Color(0xFF7048E8)

private val LightColors = lightColorScheme(
    primary = Violet,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE9E1FF),
    onPrimaryContainer = Color(0xFF22005D),
    secondary = Color(0xFF625B71),
    secondaryContainer = Color(0xFFE8DEF8),
    onSecondaryContainer = Color(0xFF1D192B),
    tertiary = Color(0xFF0B7A5C),
    tertiaryContainer = Color(0xFFC9F2E1),
    onTertiaryContainer = Color(0xFF00382A),
    background = Color(0xFFFCFAFF),
    surface = Color(0xFFFCFAFF),
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color(0xFFF7F3FD),
    surfaceContainer = Color(0xFFF2EEF8),
    surfaceContainerHigh = Color(0xFFECE8F3),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFCFBDFF),
    onPrimary = Color(0xFF3A0D9C),
    primaryContainer = Color(0xFF5530C9),
    onPrimaryContainer = Color(0xFFE9E1FF),
    tertiary = Color(0xFF8ED7BB),
    tertiaryContainer = Color(0xFF005140),
    onTertiaryContainer = Color(0xFFC9F2E1),
)

/** Status colours that don't exist in the Material scheme. */
object StatusColors {
    val success = Color(0xFF2B8A3E)
    val successContainer = Color(0xFFD3F9D8)
    val warning = Color(0xFFE67700)
    val warningContainer = Color(0xFFFFF3BF)
    val info = Color(0xFF1971C2)
    val infoContainer = Color(0xFFD0EBFF)
    val neutral = Color(0xFF495057)
    val neutralContainer = Color(0xFFE9ECEF)
}

@Composable
fun SubscribbyTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (darkTheme) DarkColors else LightColors, content = content)
}
