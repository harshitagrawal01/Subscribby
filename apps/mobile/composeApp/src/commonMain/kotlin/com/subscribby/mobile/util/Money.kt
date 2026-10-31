package com.subscribby.mobile.util

import kotlin.math.abs

/**
 * Formats whole paise as Indian rupees with Indian digit grouping, in common code
 * (no platform NumberFormat, so every target prints the same thing).
 *
 * 12814800 → "₹1,28,148.00", 295000 → "₹2,950.00", 0 → "₹0.00", -50000 → "-₹500.00".
 * Display only: the app never calculates prices, it formats what the API sends.
 */
fun formatMoney(paise: Long): String {
    val negative = paise < 0
    val absolute = if (paise == Long.MIN_VALUE) Long.MAX_VALUE else abs(paise)
    val rupees = absolute / 100
    val fraction = (absolute % 100).toString().padStart(2, '0')
    return (if (negative) "-" else "") + "₹" + groupIndian(rupees.toString()) + "." + fraction
}

fun formatMoney(paise: Long?): String = if (paise == null) "—" else formatMoney(paise)

/** "12814800" → "1,28,14,800": last three digits, then groups of two. */
internal fun groupIndian(digits: String): String {
    if (digits.length <= 3) return digits
    val last3 = digits.takeLast(3)
    val rest = digits.dropLast(3)
    val groups = mutableListOf<String>()
    var end = rest.length
    while (end > 0) {
        val start = maxOf(0, end - 2)
        groups.add(0, rest.substring(start, end))
        end = start
    }
    return groups.joinToString(",") + "," + last3
}
