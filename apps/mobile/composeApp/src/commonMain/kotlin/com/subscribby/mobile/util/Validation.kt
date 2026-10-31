package com.subscribby.mobile.util

/** Password rule from spec §5: more than 8 characters, an uppercase, a lowercase and a special character. */
data class PasswordRule(val label: String, val test: (String) -> Boolean)

val PASSWORD_RULES: List<PasswordRule> = listOf(
    PasswordRule("More than 8 characters") { it.length > 8 },
    PasswordRule("An uppercase letter") { pw -> pw.any { it in 'A'..'Z' } },
    PasswordRule("A lowercase letter") { pw -> pw.any { it in 'a'..'z' } },
    PasswordRule("A special character") { pw -> pw.any { !(it in 'A'..'Z' || it in 'a'..'z' || it in '0'..'9') } },
)

fun passwordProblem(password: String): String? {
    val missing = PASSWORD_RULES.filterNot { it.test(password) }
    return if (missing.isEmpty()) null else "Needs " + missing.joinToString(", ") { it.label.lowercase() }
}

private val EMAIL_REGEX = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")

fun isValidEmail(email: String): Boolean = EMAIL_REGEX.matches(email.trim())
