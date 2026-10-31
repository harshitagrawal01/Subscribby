package com.subscribby.mobile.util

private val MONTHS = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

/**
 * "2026-10-31" → "31 Oct 2026". Also accepts ISO timestamps ("2026-10-31T09:30:00Z" → "31 Oct 2026").
 * Null/blank → "—". Anything unparseable is returned unchanged.
 */
fun formatDate(value: String?): String {
    if (value.isNullOrBlank()) return "—"
    val datePart = value.take(10)
    val parts = datePart.split("-")
    if (parts.size != 3) return value
    val year = parts[0].toIntOrNull() ?: return value
    val month = parts[1].toIntOrNull()?.takeIf { it in 1..12 } ?: return value
    val day = parts[2].toIntOrNull()?.takeIf { it in 1..31 } ?: return value
    return "${day.toString().padStart(2, '0')} ${MONTHS[month - 1]} $year"
}
