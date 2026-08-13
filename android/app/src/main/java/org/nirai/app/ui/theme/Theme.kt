package org.nirai.app.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Standard Tactical Dark Color Scheme (Default)
private val StandardDarkColorScheme = darkColorScheme(
    primary = PrimaryCyan,
    secondary = PrimaryBlue,
    tertiary = AiTelemetryAccent,
    background = BgDark950,
    surface = BgDark900,
    onPrimary = Color.Black,
    onSecondary = Color.White,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    outline = BorderDark
)

// High-Contrast Offline Fallback Amber Color Scheme
private val OfflineAmberColorScheme = darkColorScheme(
    primary = OfflineAmberPrimary,
    secondary = OfflineAmberSecondary,
    tertiary = AiTelemetryAccent,
    background = OfflineAmberBg,
    surface = OfflineAmberSurface,
    onPrimary = Color.Black,
    onSecondary = Color.White,
    onBackground = OfflineAmberText,
    onSurface = OfflineAmberText,
    outline = OfflineAmberBorder
)

@Composable
fun NiraiTheme(
    isOfflineMode: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = if (isOfflineMode) {
        OfflineAmberColorScheme
    } else {
        StandardDarkColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
