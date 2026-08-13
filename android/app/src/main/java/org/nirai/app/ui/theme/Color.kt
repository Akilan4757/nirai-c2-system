package org.nirai.app.ui.theme

import androidx.compose.ui.graphics.Color

// Layout and Surfaces (Dark theme default)
val BgDark950 = Color(0xFF020617)
val BgDark900 = Color(0xFF0B0F19)
val BgDark800 = Color(0xFF1E293B)
val BorderDark = Color(0xFF334155)

val TextPrimary = Color(0xFFF8FAFC)
val TextSecondary = Color(0xFF94A3B8)
val TextMuted = Color(0xFF64748B)

// Brand and Status
val PrimaryBlue = Color(0xFF3B82F6)
val PrimaryCyan = Color(0xFF06B6D4)
val MotherPurple = Color(0xFFA855F7)

// Airspace / Severity Colors
val SeverityCritical = Color(0xFFEF4444)
val SeverityWarning = Color(0xFFF59E0B)
val SeverityNominal = Color(0xFF10B981)

// AI Telemetry Accent (kept visually distinct from standard alert colors)
val AiTelemetryAccent = Color(0xFFD946EF)

// High-Contrast Offline Fallback Amber Theme (used on connectivity drops)
val OfflineAmberBg = Color(0xFF1C1304)      // Dark warm brown-black
val OfflineAmberSurface = Color(0xFF322005) // Deep amber surface
val OfflineAmberPrimary = Color(0xFFF59E0B) // Bright warning amber
val OfflineAmberSecondary = Color(0xFFD97706) // Muted orange-amber
val OfflineAmberText = Color(0xFFFEF3C7)      // Warm amber-cream text
val OfflineAmberTextMuted = Color(0xFFB45309) // Rust-amber secondary text
val OfflineAmberBorder = Color(0xFF78350F)    // Dark amber-orange border
