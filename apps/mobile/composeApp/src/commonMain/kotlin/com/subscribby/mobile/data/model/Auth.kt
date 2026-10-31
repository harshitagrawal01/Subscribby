package com.subscribby.mobile.data.model

import kotlinx.serialization.Serializable

@Serializable
data class Address(
    val line1: String? = null,
    val line2: String? = null,
    val city: String? = null,
    val state: String? = null,
    val postalCode: String? = null,
    val country: String? = null,
) {
    /** "69, FC Road, Pune, Maharashtra 411001" — skips blanks. */
    fun singleLine(): String =
        listOf(line1, line2, city, listOfNotNull(state, postalCode).filter { it.isNotBlank() }.joinToString(" "))
            .filterNot { it.isNullOrBlank() }
            .joinToString(", ")
}

/** The customer record embedded in `GET /auth/me`. */
@Serializable
data class CustomerInfo(
    val id: String,
    val name: String,
    val contactName: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val billingAddress: Address? = null,
    val taxId: String? = null,
)

@Serializable
data class AuthUser(
    val id: String,
    val name: String,
    val email: String,
    /** admin | staff | finance | customer. The mobile app only ever logs in customers. */
    val role: String,
    val status: String,
    val mustChangePassword: Boolean = false,
    val customerId: String? = null,
    val lastLoginAt: Timestamp? = null,
    val customer: CustomerInfo? = null,
)

/** `{ token, user }` returned by login, sign-up, change-password and reset-password. */
@Serializable
data class Session(val token: String, val user: AuthUser)

@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class SignupRequest(
    val name: String,
    val email: String,
    val password: String,
    val companyName: String? = null,
)

@Serializable
data class ForgotPasswordRequest(val email: String, val portal: String = "customer")

@Serializable
data class ForgotPasswordResponse(val ok: Boolean = true, val devResetUrl: String? = null)

@Serializable
data class ChangePasswordRequest(val currentPassword: String, val newPassword: String)

@Serializable
data class UpdateMeRequest(val name: String? = null, val phone: String? = null)
