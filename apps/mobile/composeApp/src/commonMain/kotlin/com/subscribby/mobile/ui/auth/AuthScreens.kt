package com.subscribby.mobile.ui.auth

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.subscribby.mobile.ui.LocalAppContainer
import com.subscribby.mobile.ui.components.AppIcons
import com.subscribby.mobile.ui.components.BackButton
import com.subscribby.mobile.ui.components.BrandMark
import com.subscribby.mobile.ui.components.DashedDivider
import com.subscribby.mobile.ui.components.DocNumber
import com.subscribby.mobile.ui.components.FormBanner
import com.subscribby.mobile.ui.components.FormTextField
import com.subscribby.mobile.ui.components.LogoMark
import com.subscribby.mobile.ui.components.Motion
import com.subscribby.mobile.ui.components.PaidStamp
import com.subscribby.mobile.ui.components.PasswordField
import com.subscribby.mobile.ui.components.PasswordRulesChecklist
import com.subscribby.mobile.ui.components.PrimaryButton
import com.subscribby.mobile.ui.components.ReceiptPaper
import com.subscribby.mobile.ui.components.StatusText
import com.subscribby.mobile.ui.components.TertiaryButton
import com.subscribby.mobile.ui.components.dismissKeyboardOnTap
import com.subscribby.mobile.ui.components.entrance
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.ui.theme.StatusColors

/**
 * Shared by the three auth screens: warm paper, brand, a Fraunces headline, fields that float
 * their labels, and the primary button docked at the bottom so it rides above the keyboard.
 */
@Composable
private fun AuthShell(
    title: String,
    subtitle: String,
    primary: @Composable () -> Unit,
    footer: (@Composable () -> Unit)?,
    onBack: (() -> Unit)? = null,
    showArt: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(Palette.AuthPaper)
            .dismissKeyboardOnTap()
            .windowInsetsPadding(WindowInsets.statusBars),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(Modifier.fillMaxWidth().heightIn(min = 52.dp).padding(horizontal = 8.dp), contentAlignment = Alignment.CenterStart) {
            if (onBack != null) BackButton(onBack, "Log in") else BrandMark(Modifier.padding(start = 16.dp), markSize = 26.dp, wordSize = 20.sp)
        }
        Column(
            Modifier
                .weight(1f)
                .widthIn(max = 460.dp)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp),
        ) {
            if (showArt) {
                ReceiptArt(Modifier.padding(top = 8.dp).entrance(0))
                Spacer(Modifier.height(20.dp))
            } else {
                Spacer(Modifier.height(12.dp))
                LogoMark(44.dp, Modifier.entrance(0))
                Spacer(Modifier.height(20.dp))
            }
            Text(
                title,
                style = MaterialTheme.typography.displayLarge,
                color = Palette.Text,
                modifier = Modifier.semantics { heading() }.entrance(1),
            )
            Spacer(Modifier.height(8.dp))
            Text(subtitle, style = MaterialTheme.typography.bodyLarge, color = Palette.TextMuted, modifier = Modifier.entrance(1))
            Spacer(Modifier.height(28.dp))
            Column(Modifier.entrance(2), verticalArrangement = Arrangement.spacedBy(14.dp), content = content)
            Spacer(Modifier.height(24.dp))
        }
        // Docked actions: above the navigation bar, and above the keyboard when it's open.
        Column(
            Modifier
                .widthIn(max = 460.dp)
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.navigationBars.union(WindowInsets.ime))
                .padding(horizontal = 24.dp)
                .padding(top = 8.dp, bottom = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            primary()
            if (footer != null) {
                Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) { footer() }
            }
        }
    }
}

@Composable
private fun FooterLink(prompt: String, action: String, onClick: () -> Unit) {
    Text(prompt, style = MaterialTheme.typography.bodyMedium, color = Palette.TextMuted)
    TertiaryButton(onClick = onClick) {
        Text(action, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
    }
}

/** This month's bill on top of last month's paid receipt: the web login's receipt stack, phone-sized. */
@Composable
private fun ReceiptArt(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(196.dp).clearAndSetSemantics { }) {
        // Last month, paid
        ReceiptPaper(
            Modifier.align(Alignment.TopEnd).width(196.dp).rotate(6f),
        ) {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                DocNumber("INV/2026/0277", size = 11.sp, color = Palette.TextFaint)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    PaidStamp("Paid · 3 Oct", fontSize = 11.sp)
                }
                MiniLine("Starter plan", "₹3,000.00", faded = true)
                MiniLine("GST 18%", "₹540.00", faded = true)
                Spacer(Modifier.height(10.dp))
            }
        }
        // This month, due
        ReceiptPaper(
            Modifier.align(Alignment.BottomStart).offset(y = (-4).dp).width(228.dp).rotate(-4f),
        ) {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    LogoMark(18.dp)
                    Spacer(Modifier.width(6.dp))
                    Text("Subscribby", style = MaterialTheme.typography.labelMedium, color = Palette.Text, modifier = Modifier.weight(1f))
                    StatusText("Unpaid", StatusColors.confirmed)
                }
                MiniLine("Starter plan", "₹3,000.00")
                MiniLine("Launch offer", "−₹500.00", faded = true)
                DashedDivider()
                Row(verticalAlignment = Alignment.Bottom) {
                    Column(Modifier.weight(1f)) {
                        Text("Due 10 Nov", style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp), color = Palette.TextMuted)
                        Text("Total", style = MaterialTheme.typography.labelMedium, color = Palette.Text)
                    }
                    Text("₹2,950.00", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = Palette.Text)
                }
            }
        }
    }
}

@Composable
private fun MiniLine(label: String, amount: String, faded: Boolean = false) {
    val color = if (faded) Palette.TextFaint else Palette.Text
    Row {
        Text(label, style = MaterialTheme.typography.bodySmall, color = color, modifier = Modifier.weight(1f))
        Text(amount, style = MaterialTheme.typography.bodySmall, color = color)
    }
}

@Composable
fun LoginScreen(onSignup: () -> Unit, onForgotPassword: () -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel { LoginViewModel(container.auth) }
    val notice by container.session.notice.collectAsStateWithLifecycle()
    val haptics = LocalHapticFeedback.current
    val s = vm.state
    val submit = {
        vm.submit()
        if (vm.state.emailError != null || vm.state.passwordError != null) haptics.performHapticFeedback(HapticFeedbackType.Reject)
    }

    AuthShell(
        title = "Log in to Subscribby",
        subtitle = "See your subscriptions, invoices and payments.",
        showArt = true,
        primary = { PrimaryButton("Log in", onClick = submit, loading = s.submitting, modifier = Modifier.testTag("login-submit")) },
        footer = { FooterLink("New here?", "Create an account", onSignup) },
    ) {
        val banner = s.formError ?: notice
        AnimatedBanner(banner)
        FormTextField(
            value = s.email,
            onValueChange = { vm.onEmail(it); container.session.consumeNotice() },
            label = "Email",
            error = s.emailError,
            leadingIcon = AppIcons.Mail,
            keyboardType = KeyboardType.Email,
            autofill = ContentType.EmailAddress + ContentType.Username,
            modifier = Modifier.testTag("login-email"),
        )
        PasswordField(
            value = s.password,
            onValueChange = vm::onPassword,
            label = "Password",
            error = s.passwordError,
            imeAction = ImeAction.Done,
            onImeAction = submit,
            modifier = Modifier.testTag("login-password"),
            labelAction = {
                TertiaryButton(onClick = onForgotPassword) {
                    Text("Forgot password?", style = MaterialTheme.typography.labelMedium)
                }
            },
        )
    }
}

@Composable
private fun AnimatedBanner(message: String?) {
    AnimatedContent(
        targetState = message,
        transitionSpec = { fadeIn(tween(Motion.QUICK)) togetherWith fadeOut(tween(Motion.QUICK)) },
        label = "form-banner",
    ) { text -> if (text != null) FormBanner(text) }
}

@Composable
fun SignupScreen(onLogin: () -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel { SignupViewModel(container.auth) }
    val haptics = LocalHapticFeedback.current
    val s = vm.state
    val submit = {
        vm.submit()
        if (vm.state.errors.isNotEmpty()) haptics.performHapticFeedback(HapticFeedbackType.Reject)
    }

    AuthShell(
        title = "Create an account",
        subtitle = "Use the email your invoices go to, and your subscriptions show up straight away.",
        onBack = onLogin,
        primary = { PrimaryButton("Create account", onClick = submit, loading = s.submitting) },
        footer = { FooterLink("Already have an account?", "Log in", onLogin) },
    ) {
        AnimatedBanner(s.formError)
        FormTextField(
            s.name,
            vm::onName,
            "Full name",
            error = s.errors["name"],
            leadingIcon = AppIcons.User,
            capitalization = KeyboardCapitalization.Words,
            autofill = ContentType.PersonFullName,
        )
        FormTextField(
            s.company,
            vm::onCompany,
            "Company",
            error = s.errors["companyName"],
            hint = "Optional",
            leadingIcon = AppIcons.Building,
            capitalization = KeyboardCapitalization.Words,
        )
        FormTextField(
            s.email,
            vm::onEmail,
            "Email",
            error = s.errors["email"],
            leadingIcon = AppIcons.Mail,
            keyboardType = KeyboardType.Email,
            autofill = ContentType.EmailAddress + ContentType.NewUsername,
        )
        PasswordField(
            s.password,
            vm::onPassword,
            "Password",
            error = s.errors["password"],
            newPassword = true,
            below = { PasswordRulesChecklist(s.password) },
        )
        PasswordField(
            s.confirm,
            vm::onConfirm,
            "Confirm password",
            error = s.errors["confirmPassword"],
            newPassword = true,
            imeAction = ImeAction.Done,
            onImeAction = submit,
        )
    }
}

@Composable
fun ForgotPasswordScreen(onBackToLogin: () -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel { ForgotPasswordViewModel(container.auth) }
    val haptics = LocalHapticFeedback.current
    val s = vm.state
    val submit = {
        vm.submit()
        if (vm.state.emailError != null) haptics.performHapticFeedback(HapticFeedbackType.Reject)
    }

    AuthShell(
        title = "Reset your password",
        subtitle = "We'll email a link that works once, for 30 minutes.",
        onBack = onBackToLogin,
        primary = {
            if (s.sentTo != null) PrimaryButton("Back to log in", onClick = onBackToLogin)
            else PrimaryButton("Send reset link", onClick = submit, loading = s.submitting)
        },
        footer = if (s.sentTo == null) ({ FooterLink("Remembered it?", "Back to log in", onBackToLogin) }) else null,
    ) {
        AnimatedContent(
            targetState = s.sentTo,
            transitionSpec = { fadeIn(tween(Motion.ENTER)) togetherWith fadeOut(tween(Motion.EXIT)) },
            label = "forgot",
        ) { sentTo ->
            if (sentTo != null) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    FormBanner("If an account exists for $sentTo, a reset link is on its way.", success = true)
                    Text(
                        "Open the link in that email to choose a new password, then log in here.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Palette.TextMuted,
                    )
                }
            } else {
                FormTextField(
                    s.email,
                    vm::onEmail,
                    "Email",
                    error = s.emailError,
                    leadingIcon = AppIcons.Mail,
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Done,
                    onImeAction = submit,
                    autofill = ContentType.EmailAddress,
                )
            }
        }
    }
}
