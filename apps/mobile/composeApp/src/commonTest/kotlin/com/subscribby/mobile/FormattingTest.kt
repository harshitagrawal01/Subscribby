package com.subscribby.mobile

import com.subscribby.mobile.util.PASSWORD_RULES
import com.subscribby.mobile.util.formatDate
import com.subscribby.mobile.util.formatMoney
import com.subscribby.mobile.util.passwordProblem
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class FormattingTest {
    @Test
    fun moneyUsesIndianGrouping() {
        assertEquals("₹1,28,148.00", formatMoney(12814800L))
        assertEquals("₹2,950.00", formatMoney(295000L))
        assertEquals("₹0.00", formatMoney(0L))
    }

    @Test
    fun moneyEdgeCases() {
        assertEquals("₹0.05", formatMoney(5L))
        assertEquals("₹999.99", formatMoney(99999L))
        assertEquals("₹1,000.00", formatMoney(100000L))
        assertEquals("₹4,560.00", formatMoney(456000L))
        assertEquals("₹36,344.00", formatMoney(3634400L))
        assertEquals("₹1,00,00,000.00", formatMoney(1_000_000_000L))
        assertEquals("-₹500.00", formatMoney(-50000L))
        assertEquals("—", formatMoney(null as Long?))
    }

    @Test
    fun datesLikeTheWebApp() {
        assertEquals("31 Oct 2026", formatDate("2026-10-31"))
        assertEquals("01 Jan 2027", formatDate("2027-01-01"))
        assertEquals("31 Oct 2026", formatDate("2026-10-31T09:30:00Z"))
        assertEquals("—", formatDate(null))
        assertEquals("soon", formatDate("soon"))
    }

    @Test
    fun passwordRulesMatchTheSpec() {
        assertNull(passwordProblem("Customer@2026!"))
        assertNull(passwordProblem("Kite@2026!"))
        assertNotNull(passwordProblem("Abcdef@1")) // exactly 8 = too short ("more than 8")
        assertNotNull(passwordProblem("abcdefgh@1")) // no uppercase
        assertNotNull(passwordProblem("ABCDEFGH@1")) // no lowercase
        assertNotNull(passwordProblem("Abcdefgh12")) // no special
        assertEquals(4, PASSWORD_RULES.count { !it.test("") })
        assertTrue(PASSWORD_RULES.all { it.test("Customer@2026!") })
    }
}
