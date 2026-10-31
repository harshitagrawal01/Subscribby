package com.subscribby.mobile.data.repo

import com.subscribby.mobile.data.api.ApiClient
import com.subscribby.mobile.data.api.ApiException
import com.subscribby.mobile.data.model.AuthUser
import com.subscribby.mobile.data.model.ChangePasswordRequest
import com.subscribby.mobile.data.model.ForgotPasswordRequest
import com.subscribby.mobile.data.model.ForgotPasswordResponse
import com.subscribby.mobile.data.model.LoginRequest
import com.subscribby.mobile.data.model.Session
import com.subscribby.mobile.data.model.SignupRequest
import com.subscribby.mobile.data.model.UpdateMeRequest

/** Customer auth only (spec §5). Staff log in on the web console, never here. */
class AuthRepository(
    private val api: ApiClient,
    private val session: SessionStore,
) {
    suspend fun login(email: String, password: String): AuthUser {
        val result = api.post<LoginRequest, Session>(
            "auth/customer/login",
            LoginRequest(email.trim(), password),
            auth = false,
        )
        // The customer endpoint already rejects staff; this is a belt-and-braces check.
        if (result.user.role != "customer") {
            throw ApiException(401, "INVALID_CREDENTIALS", "Wrong email or password")
        }
        session.save(result)
        return result.user
    }

    suspend fun signup(name: String, companyName: String?, email: String, password: String): AuthUser {
        val result = api.post<SignupRequest, Session>(
            "auth/customer/signup",
            SignupRequest(
                name = name.trim(),
                companyName = companyName?.trim()?.ifBlank { null },
                email = email.trim(),
                password = password,
            ),
            auth = false,
        )
        session.save(result)
        return result.user
    }

    suspend fun forgotPassword(email: String): ForgotPasswordResponse =
        api.post<ForgotPasswordRequest, ForgotPasswordResponse>(
            "auth/forgot-password",
            ForgotPasswordRequest(email.trim(), portal = "customer"),
            auth = false,
        )

    /** Refreshes the cached user (with the embedded customer record). */
    suspend fun me(): AuthUser = api.get<AuthUser>("auth/me").also(session::updateUser)

    suspend fun updateName(name: String): AuthUser =
        api.patch<UpdateMeRequest, AuthUser>("auth/me", UpdateMeRequest(name = name.trim())).also(session::updateUser)

    /** The API returns a fresh token (the old one stops working), so the session is replaced. */
    suspend fun changePassword(currentPassword: String, newPassword: String): AuthUser {
        val result = api.post<ChangePasswordRequest, Session>(
            "auth/change-password",
            ChangePasswordRequest(currentPassword, newPassword),
        )
        session.save(result)
        return result.user
    }

    fun logout() = session.clear()
}
