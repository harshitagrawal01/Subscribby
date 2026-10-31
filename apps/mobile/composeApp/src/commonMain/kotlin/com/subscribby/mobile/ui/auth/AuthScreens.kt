package com.subscribby.mobile.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.subscribby.mobile.ui.LocalAppContainer
import com.subscribby.mobile.ui.components.BrandMark
import com.subscribby.mobile.ui.components.FormBanner
import com.subscribby.mobile.ui.components.FormTextField
import com.subscribby.mobile.ui.components.PasswordField
import com.subscribby.mobile.ui.components.PasswordRulesChecklist
import com.subscribby.mobile.ui.components.PrimaryButton
import com.subscribby.mobile.ui.components.TertiaryButton
import com.subscribby.mobile.ui.theme.Palette

private val SheetShape = RoundedCornerShape(18.dp)
private val SheetShadow = Color(0xFF3C2D14)

/** Shared by the three auth screens: logo on warm paper, then a white sheet holding a left-aligned form. */
@Composable
private fun AuthShell(
    title: String,
    subtitle: String,
    footer: @Composable () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(Modifier.fillMaxSize(), color = Palette.AuthPaper) {
        Box(
            Modifier.fillMaxSize().safeDrawingPadding().imePadding().verticalScroll(rememberScrollState()),
            contentAlignment = Alignment.TopCenter,
        ) {
            Column(Modifier.widthIn(max = 440.dp).fillMaxWidth().padding(horizontal = 16.dp, vertical = 24.dp)) {
                BrandMark(Modifier.padding(start = 8.dp))
                Spacer(Modifier.height(28.dp))
                Column(
                    Modifier
                        .fillMaxWidth()
                        .shadow(18.dp, SheetShape, ambientColor = SheetShadow.copy(alpha = 0.08f), spotColor = SheetShadow.copy(alpha = 0.30f))
                        .background(Palette.Surface, SheetShape)
                        .padding(horizontal = 22.dp, vertical = 28.dp),
                ) {
                    Text(title, style = MaterialTheme.typography.headlineLarge)
                    Spacer(Modifier.height(8.dp))
                    Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = Palette.TextMuted)
                    Spacer(Modifier.height(28.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(20.dp), content = content)
                    Spacer(Modifier.height(20.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) { footer() }
                }
            }
        }
    }
}

@Composable
private fun FooterLink(prompt: String, action: String, onClick: () -> Unit) {
    Text(prompt, style = MaterialTheme.typography.bodyMedium, color = Palette.TextMuted)
    TertiaryButton(action, onClick = onClick)
}

@Composable
fun LoginScreen(onSignup: () -> Unit, onForgotPassword: () -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel { LoginViewModel(container.auth) }
    val notice by container.session.notice.collectAsStateWithLifecycle()
    val s = vm.state

    AuthShell(
        title = "Log in to Subscribby",
        subtitle = "See your subscriptions, invoices and payments.",
        footer = { FooterLink("New here?", "Create an account", onSignup) },
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
            labelAction = {
                TertiaryButton(onClick = onForgotPassword, contentPadding = PaddingValues(horizontal = 4.dp)) {
                    Text("Forgot password?", style = MaterialTheme.typography.labelMedium)
                }
            },
        )
        PrimaryButton("Log in", onClick = vm::submit, loading = s.submitting, modifier = Modifier.testTag("login-submit"))
    }
}

@Composable
fun SignupScreen(onLogin: () -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel { SignupViewModel(container.auth) }
    val s = vm.state

    AuthShell(
        title = "Create an account",
        subtitle = "Use the email your invoices go to, and your subscriptions show up straight away.",
        footer = { FooterLink("Already have an account?", "Log in", onLogin) },
    ) {
        s.formError?.let { FormBanner(it) }
        FormTextField(s.name, vm::onName, "Full name", error = s.errors["name"], capitalization = KeyboardCapitalization.Words)
        FormTextField(
            s.company,
            vm::onCompany,
            "Company",
            error = s.errors["companyName"],
            hint = "Optional",
            capitalization = KeyboardCapitalization.Words,
        )
        FormTextField(s.email, vm::onEmail, "Email", error = s.errors["email"], keyboardType = KeyboardType.Email)
        PasswordField(
            s.password,
            vm::onPassword,
            "Password",
            error = s.errors["password"],
            below = { PasswordRulesChecklist(s.password) },
        )
        PasswordField(
            s.confirm,
            vm::onConfirm,
            "Confirm password",
            error = s.errors["confirmPassword"],
            imeAction = ImeAction.Done,
            onImeAction = vm::submit,
        )
        PrimaryButton("Create account", onClick = vm::submit, loading = s.submitting)
    }
}

@Composable
fun ForgotPasswordScreen(onBackToLogin: () -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel { ForgotPasswordViewModel(container.auth) }
    val s = vm.state

    AuthShell(
        title = "Reset your password",
        subtitle = "We'll email a link that works once, for 30 minutes.",
        footer = { FooterLink("Remembered it?", "Back to log in", onBackToLogin) },
    ) {
        if (s.sentTo != null) {
            FormBanner("If an account exists for ${s.sentTo}, a reset link is on its way.", success = true)
            Text(
                "Open the link in that email to choose a new password, then log in here.",
                style = MaterialTheme.typography.bodyMedium,
                color = Palette.TextMuted,
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
            PrimaryButton("Send reset link", onClick = vm::submit, loading = s.submitting)
        }
    }
}
