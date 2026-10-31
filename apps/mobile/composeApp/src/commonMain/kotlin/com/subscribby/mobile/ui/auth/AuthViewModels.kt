package com.subscribby.mobile.ui.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.subscribby.mobile.data.api.ApiException
import com.subscribby.mobile.data.api.userMessage
import com.subscribby.mobile.data.repo.AuthRepository
import com.subscribby.mobile.util.isValidEmail
import com.subscribby.mobile.util.newPasswordProblem
import kotlinx.coroutines.launch

/** Same wording as the web app's login page. */
internal fun loginErrorMessage(e: Throwable): String = when ((e as? ApiException)?.code) {
    "INVALID_CREDENTIALS" -> "Wrong email or password."
    "ACCOUNT_DISABLED" -> "This account is disabled. Contact your admin."
    else -> e.userMessage()
}

class LoginViewModel(private val auth: AuthRepository) : ViewModel() {
    data class State(
        val email: String = "",
        val password: String = "",
        val emailError: String? = null,
        val passwordError: String? = null,
        val formError: String? = null,
        val submitting: Boolean = false,
    )

    var state by mutableStateOf(State())
        private set

    fun onEmail(value: String) { state = state.copy(email = value, emailError = null, formError = null) }
    fun onPassword(value: String) { state = state.copy(password = value, passwordError = null, formError = null) }

    fun submit() {
        if (state.submitting) return
        // Email is trimmed before checking and sending; the password is sent exactly as typed.
        state = state.copy(email = state.email.trim())
        val emailError = if (!isValidEmail(state.email)) "Enter a valid email" else null
        val passwordError = if (state.password.isEmpty()) "Password is required" else null
        if (emailError != null || passwordError != null) {
            state = state.copy(emailError = emailError, passwordError = passwordError)
            return
        }
        state = state.copy(submitting = true, formError = null)
        viewModelScope.launch {
            // On success the session flips to LoggedIn and App() swaps to the main screens.
            state = try {
                auth.login(state.email, state.password)
                state.copy(submitting = false)
            } catch (e: Exception) {
                state.copy(submitting = false, formError = loginErrorMessage(e))
            }
        }
    }
}

class SignupViewModel(private val auth: AuthRepository) : ViewModel() {
    data class State(
        val name: String = "",
        val company: String = "",
        val email: String = "",
        val password: String = "",
        val confirm: String = "",
        val errors: Map<String, String> = emptyMap(),
        val formError: String? = null,
        val submitting: Boolean = false,
    )

    var state by mutableStateOf(State())
        private set

    private fun edit(field: String, block: State.() -> State) {
        state = state.block().copy(errors = state.errors - field, formError = null)
    }

    fun onName(v: String) = edit("name") { copy(name = v) }
    fun onCompany(v: String) = edit("companyName") { copy(company = v) }
    fun onEmail(v: String) = edit("email") { copy(email = v) }
    fun onPassword(v: String) = edit("password") { copy(password = v) }
    fun onConfirm(v: String) = edit("confirmPassword") { copy(confirm = v) }

    fun submit() {
        if (state.submitting) return
        state = state.copy(name = state.name.trim(), company = state.company.trim(), email = state.email.trim())
        val errors = buildMap {
            if (state.name.length < 2) put("name", "Enter your full name")
            if (!isValidEmail(state.email)) put("email", "Enter a valid email")
            newPasswordProblem(state.password)?.let { put("password", it) }
            if (state.confirm != state.password) put("confirmPassword", "Passwords do not match")
        }
        if (errors.isNotEmpty()) {
            state = state.copy(errors = errors)
            return
        }
        state = state.copy(submitting = true, formError = null)
        viewModelScope.launch {
            state = try {
                auth.signup(state.name, state.company, state.email, state.password)
                state.copy(submitting = false)
            } catch (e: ApiException) {
                when {
                    e.code == "EMAIL_TAKEN" ->
                        state.copy(submitting = false, errors = mapOf("email" to "An account with this email already exists."))
                    e.details.isNotEmpty() ->
                        state.copy(submitting = false, errors = e.fieldErrors, formError = e.message.takeIf { _ ->
                            e.fieldErrors.keys.none { it in setOf("name", "companyName", "email", "password") }
                        })
                    else -> state.copy(submitting = false, formError = e.userMessage())
                }
            } catch (e: Exception) {
                state.copy(submitting = false, formError = e.userMessage())
            }
        }
    }
}

class ForgotPasswordViewModel(private val auth: AuthRepository) : ViewModel() {
    data class State(
        val email: String = "",
        val emailError: String? = null,
        val sentTo: String? = null,
        val submitting: Boolean = false,
    )

    var state by mutableStateOf(State())
        private set

    fun onEmail(v: String) { state = state.copy(email = v, emailError = null) }

    fun submit() {
        if (state.submitting) return
        state = state.copy(email = state.email.trim())
        if (!isValidEmail(state.email)) {
            state = state.copy(emailError = "Enter a valid email")
            return
        }
        state = state.copy(submitting = true)
        viewModelScope.launch {
            // The API answers 200 whether or not the email exists, so the result is always the same message.
            runCatching { auth.forgotPassword(state.email) }
            state = state.copy(submitting = false, sentTo = state.email)
        }
    }
}
