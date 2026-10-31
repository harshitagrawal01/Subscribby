package com.subscribby.mobile.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.subscribby.mobile.ui.LocalAppContainer
import com.subscribby.mobile.ui.components.FormBanner
import com.subscribby.mobile.ui.components.FormTextField
import com.subscribby.mobile.ui.components.PasswordField
import com.subscribby.mobile.ui.components.PasswordRulesChecklist

/** Centered, scrollable card-less layout shared by the three auth screens. */
@Composable
private fun AuthShell(
    title: String,
    subtitle: String,
    footer: @Composable () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Box(
            Modifier.fillMaxSize().safeDrawingPadding().imePadding().verticalScroll(rememberScrollState()),
            contentAlignment = Alignment.TopCenter,
        ) {
            Column(
                Modifier.widthIn(max = 480.dp).fillMaxWidth().padding(horizontal = 24.dp, vertical = 32.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    "Subscribby",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.height(8.dp))
                Text(title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
                Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(4.dp))
                content()
                Spacer(Modifier.height(8.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    footer()
                }
            }
        }
    }
}

@Composable
private fun SubmitButton(label: String, loading: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Button(onClick = onClick, enabled = !loading, modifier = modifier.fillMaxWidth().height(48.dp)) {
        if (loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text(label)
    }
}

@Composable
fun LoginScreen(onSignup: () -> Unit, onForgotPassword: () -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel { LoginViewModel(container.auth) }
    val notice by container.session.notice.collectAsStateWithLifecycle()
    val s = vm.state

    AuthShell(
        title = "Log in",
        subtitle = "Manage your subscriptions and invoices.",
        footer = {
            Text("New here?", style = MaterialTheme.typography.bodyMedium)
            TextButton(onClick = onSignup) { Text("Create an account") }
        },
    ) {
        val banner = s.formError ?: notice
        if (banner != null) FormBanner(banner)
        FormTextField(
            value = s.email,
            onValueChange = { vm.onEmail(it); container.session.consumeNotice() },
            label = "Email",
            error = s.emailError,
            keyboardType = KeyboardType.Email,
            modifier = Modifier.testTag("login-email"),
        )
        PasswordField(
            value = s.password,
            onValueChange = vm::onPassword,
            label = "Password",
            error = s.passwordError,
            imeAction = ImeAction.Done,
            onImeAction = vm::submit,
            modifier = Modifier.testTag("login-password"),
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            TextButton(onClick = onForgotPassword) { Text("Forgot password?") }
        }
        SubmitButton("Log in", s.submitting, vm::submit, Modifier.testTag("login-submit"))
    }
}

@Composable
fun SignupScreen(onLogin: () -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel { SignupViewModel(container.auth) }
    val s = vm.state

    AuthShell(
        title = "Create your account",
        subtitle = "See and manage your subscriptions without emailing anyone.",
        footer = {
            Text("Already have an account?", style = MaterialTheme.typography.bodyMedium)
            TextButton(onClick = onLogin) { Text("Log in") }
        },
    ) {
        s.formError?.let { FormBanner(it) }
        FormTextField(s.name, vm::onName, "Full name", error = s.errors["name"])
        FormTextField(s.company, vm::onCompany, "Company", error = s.errors["companyName"], supporting = "Optional")
        FormTextField(s.email, vm::onEmail, "Email", error = s.errors["email"], keyboardType = KeyboardType.Email)
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            PasswordField(s.password, vm::onPassword, "Password", error = s.errors["password"])
            PasswordRulesChecklist(s.password)
        }
        PasswordField(
            s.confirm,
            vm::onConfirm,
            "Confirm password",
            error = s.errors["confirmPassword"],
            imeAction = ImeAction.Done,
            onImeAction = vm::submit,
        )
        SubmitButton("Create account", s.submitting, vm::submit)
    }
}

@Composable
fun ForgotPasswordScreen(onBackToLogin: () -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel { ForgotPasswordViewModel(container.auth) }
    val s = vm.state

    AuthShell(
        title = "Forgot password",
        subtitle = "We'll email you a link to set a new password. It works once and expires in 30 minutes.",
        footer = { TextButton(onClick = onBackToLogin) { Text("Back to login") } },
    ) {
        if (s.sentTo != null) {
            FormBanner("If an account exists for ${s.sentTo}, a reset link is on its way.", success = true)
            Text(
                "Open the link from the email to choose a new password, then come back and log in.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            FormTextField(
                s.email,
                vm::onEmail,
                "Email",
                error = s.emailError,
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Done,
                onImeAction = vm::submit,
            )
            SubmitButton("Send reset link", s.submitting, vm::submit)
        }
    }
}
