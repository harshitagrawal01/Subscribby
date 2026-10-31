package com.subscribby.mobile.ui.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.subscribby.mobile.data.api.ApiException
import com.subscribby.mobile.data.api.userMessage
import com.subscribby.mobile.data.repo.AuthRepository
import com.subscribby.mobile.data.repo.SessionState
import com.subscribby.mobile.ui.LocalAppContainer
import com.subscribby.mobile.ui.components.ConfirmDialog
import com.subscribby.mobile.ui.components.FormBanner
import com.subscribby.mobile.ui.components.FormTextField
import com.subscribby.mobile.ui.components.GroupGap
import com.subscribby.mobile.ui.components.KeyValueRow
import com.subscribby.mobile.ui.components.Panel
import com.subscribby.mobile.ui.components.PanelDivider
import com.subscribby.mobile.ui.components.PanelShape
import com.subscribby.mobile.ui.components.PasswordField
import com.subscribby.mobile.ui.components.PasswordRulesChecklist
import com.subscribby.mobile.ui.components.PrimaryButton
import com.subscribby.mobile.ui.components.ScreenHeader
import com.subscribby.mobile.ui.components.ScreenPadding
import com.subscribby.mobile.ui.components.SecondaryButton
import com.subscribby.mobile.ui.components.SectionTitle
import com.subscribby.mobile.ui.components.TertiaryButton
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.util.newPasswordProblem
import kotlinx.coroutines.launch

class ProfileViewModel(private val auth: AuthRepository) : ViewModel() {
    var refreshing by mutableStateOf(false)
        private set
    var savingName by mutableStateOf(false)
        private set
    var message by mutableStateOf<String?>(null)
        private set

    fun refresh() {
        refreshing = true
        viewModelScope.launch {
            runCatching { auth.me() }.onFailure { message = it.userMessage() }
            refreshing = false
        }
    }

    fun updateName(name: String, onDone: () -> Unit) {
        savingName = true
        viewModelScope.launch {
            try {
                auth.updateName(name.trim())
                message = "Name updated"
                onDone()
            } catch (e: ApiException) {
                message = e.fieldErrors["name"] ?: e.userMessage()
            } catch (e: Exception) {
                message = e.userMessage()
            } finally {
                savingName = false
            }
        }
    }

    fun messageShown() { message = null }
    fun logout() = auth.logout()
}

@Composable
fun ProfileScreen(onChangePassword: () -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel { ProfileViewModel(container.auth) }
    val session by container.session.state.collectAsStateWithLifecycle()
    val user = (session as? SessionState.LoggedIn)?.user ?: return
    val snackbar = remember { SnackbarHostState() }
    var editingName by rememberSaveable { mutableStateOf(false) }
    var confirmLogout by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(Unit) { vm.refresh() }
    LaunchedEffect(vm.message) {
        vm.message?.let {
            snackbar.showSnackbar(it)
            vm.messageShown()
        }
    }

    Scaffold(
        containerColor = Palette.Paper,
        topBar = { ScreenHeader(title = "Profile") },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState())
                .padding(horizontal = ScreenPadding).padding(top = 4.dp, bottom = 32.dp),
        ) {
            Spacer(Modifier.height(8.dp))
            SectionTitle("Account")
            Panel {
                KeyValueRow("Name", user.name, onClick = { editingName = true })
                PanelDivider()
                KeyValueRow("Email", user.email)
                PanelDivider()
                KeyValueRow("Password", "Change", onClick = onChangePassword)
            }

            val customer = user.customer
            Spacer(Modifier.height(GroupGap))
            SectionTitle("Billing details")
            Panel {
                KeyValueRow("Company", customer?.name ?: "—")
                customer?.phone?.takeIf { it.isNotBlank() }?.let { PanelDivider(); KeyValueRow("Phone", it) }
                customer?.billingAddress?.singleLine()?.takeIf { it.isNotBlank() }?.let { PanelDivider(); KeyValueRow("Billing address", it) }
                customer?.taxId?.takeIf { it.isNotBlank() }?.let { PanelDivider(); KeyValueRow("GSTIN", it) }
            }
            Text(
                "Only your billing team can change these details.",
                style = MaterialTheme.typography.bodySmall,
                color = Palette.TextMuted,
                modifier = Modifier.padding(top = 8.dp, start = 4.dp),
            )

            Spacer(Modifier.height(GroupGap))
            TertiaryButton(onClick = { confirmLogout = true }, destructive = true, contentPadding = PaddingValues(horizontal = 4.dp)) {
                Text("Log out", style = MaterialTheme.typography.labelLarge)
            }
        }
    }

    if (editingName) {
        var name by rememberSaveable { mutableStateOf(user.name) }
        // Trimmed before checking and saving.
        val error = if (name.trim().length < 2) "Enter your full name" else null
        AlertDialog(
            onDismissRequest = { editingName = false },
            shape = PanelShape,
            containerColor = Palette.Surface,
            tonalElevation = 0.dp,
            title = { Text("Edit your name", style = MaterialTheme.typography.titleMedium) },
            text = {
                FormTextField(
                    name,
                    { name = it },
                    "Full name",
                    error = error,
                    capitalization = KeyboardCapitalization.Words,
                    imeAction = ImeAction.Done,
                )
            },
            confirmButton = {
                PrimaryButton(
                    "Save name",
                    onClick = { vm.updateName(name) { editingName = false } },
                    enabled = error == null,
                    loading = vm.savingName,
                    fillWidth = false,
                    height = 40.dp,
                )
            },
            dismissButton = { SecondaryButton("Cancel", onClick = { editingName = false }, fillWidth = false, height = 40.dp) },
        )
    }
    if (confirmLogout) {
        ConfirmDialog(
            title = "Log out of Subscribby?",
            message = "You'll need your email and password to log back in.",
            confirmLabel = "Log out",
            destructive = true,
            onConfirm = { confirmLogout = false; vm.logout() },
            onDismiss = { confirmLogout = false },
        )
    }
}

class ChangePasswordViewModel(private val auth: AuthRepository) : ViewModel() {
    data class State(
        val current: String = "",
        val new: String = "",
        val confirm: String = "",
        val errors: Map<String, String> = emptyMap(),
        val formError: String? = null,
        val submitting: Boolean = false,
        val done: Boolean = false,
    )

    var state by mutableStateOf(State())
        private set

    fun onCurrent(v: String) { state = state.copy(current = v, errors = state.errors - "currentPassword", formError = null) }
    fun onNew(v: String) { state = state.copy(new = v, errors = state.errors - "newPassword", formError = null) }
    fun onConfirm(v: String) { state = state.copy(confirm = v, errors = state.errors - "confirmPassword", formError = null) }

    /** Passwords are never trimmed: the current one is sent as typed, a new one may not start or end with a space. */
    fun submit() {
        if (state.submitting) return
        val errors = buildMap {
            if (state.current.isEmpty()) put("currentPassword", "Enter your current password")
            newPasswordProblem(state.new)?.let { put("newPassword", it) }
            if (state.new.isNotEmpty() && state.new == state.current) put("newPassword", "Must be different from the current password")
            if (state.confirm != state.new) put("confirmPassword", "Passwords do not match")
        }
        if (errors.isNotEmpty()) {
            state = state.copy(errors = errors)
            return
        }
        state = state.copy(submitting = true, formError = null)
        viewModelScope.launch {
            state = try {
                auth.changePassword(state.current, state.new) // stores the fresh token
                State(done = true)
            } catch (e: ApiException) {
                if (e.details.isNotEmpty()) state.copy(submitting = false, errors = e.fieldErrors)
                else state.copy(submitting = false, formError = e.userMessage())
            } catch (e: Exception) {
                state.copy(submitting = false, formError = e.userMessage())
            }
        }
    }
}

/**
 * Change password from Profile, or, with [forced], the "Set your password" step for accounts
 * that still have a temporary password (`mustChangePassword: true`).
 */
@Composable
fun ChangePasswordScreen(onDone: () -> Unit, forced: Boolean = false) {
    val container = LocalAppContainer.current
    val vm = viewModel { ChangePasswordViewModel(container.auth) }
    val s = vm.state
    LaunchedEffect(s.done) { if (s.done) onDone() }

    Scaffold(
        containerColor = Palette.Paper,
        topBar = {
            if (forced) {
                ScreenHeader(title = null) {
                    Spacer(Modifier.weight(1f))
                    TertiaryButton("Log out", onClick = { container.auth.logout() })
                }
            } else {
                ScreenHeader(title = null, backLabel = "Profile", onBack = onDone)
            }
        },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).imePadding().verticalScroll(rememberScrollState())
                .padding(horizontal = ScreenPadding).padding(top = 4.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(if (forced) "Set your password" else "Change password", style = MaterialTheme.typography.headlineMedium)
                Text(
                    if (forced) "Your account has a temporary password. Choose your own to continue."
                    else "You'll stay logged in on this device. Other devices will need the new password.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Palette.TextMuted,
                )
            }
            s.formError?.let { FormBanner(it) }
            PasswordField(s.current, vm::onCurrent, if (forced) "Temporary password" else "Current password", error = s.errors["currentPassword"])
            PasswordField(s.new, vm::onNew, "New password", error = s.errors["newPassword"], below = { PasswordRulesChecklist(s.new) })
            PasswordField(
                s.confirm,
                vm::onConfirm,
                "Confirm new password",
                error = s.errors["confirmPassword"],
                imeAction = ImeAction.Done,
                onImeAction = vm::submit,
            )
            PrimaryButton("Save password", onClick = vm::submit, loading = s.submitting)
        }
    }
}
