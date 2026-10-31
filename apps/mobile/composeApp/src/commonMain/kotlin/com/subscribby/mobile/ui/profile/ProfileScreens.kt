package com.subscribby.mobile.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
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
import com.subscribby.mobile.ui.components.BackButton
import com.subscribby.mobile.ui.components.ConfirmDialog
import com.subscribby.mobile.ui.components.FormBanner
import com.subscribby.mobile.ui.components.FormTextField
import com.subscribby.mobile.ui.components.LabelValueRow
import com.subscribby.mobile.ui.components.PasswordField
import com.subscribby.mobile.ui.components.PasswordRulesChecklist
import com.subscribby.mobile.ui.components.SectionCard
import com.subscribby.mobile.util.passwordProblem
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
                auth.updateName(name)
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

@OptIn(ExperimentalMaterial3Api::class)
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
        topBar = { TopAppBar(title = { Text("Profile") }) },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Box(
                    Modifier.size(56.dp).background(MaterialTheme.colorScheme.primaryContainer, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        user.name.trim().take(1).uppercase(),
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
                Column(Modifier.weight(1f)) {
                    Text(user.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    Text(user.email, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (vm.refreshing) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            }

            SectionCard(title = "Account") {
                LabelValueRow("Name", user.name)
                LabelValueRow("Email", user.email)
                TextButton(onClick = { editingName = true }) {
                    Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Edit name")
                }
            }

            val customer = user.customer
            SectionCard(title = "Company") {
                LabelValueRow("Company", customer?.name ?: "—")
                customer?.phone?.takeIf { it.isNotBlank() }?.let { LabelValueRow("Phone", it) }
                customer?.billingAddress?.singleLine()?.takeIf { it.isNotBlank() }?.let { LabelValueRow("Billing address", it) }
                customer?.taxId?.takeIf { it.isNotBlank() }?.let { LabelValueRow("GSTIN", it) }
                Text(
                    "To change company details, contact Brightloop billing.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            OutlinedButton(onClick = onChangePassword, modifier = Modifier.fillMaxWidth().height(48.dp)) {
                Icon(Icons.Default.Lock, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Change password")
            }
            Button(
                onClick = { confirmLogout = true },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer,
                    contentColor = MaterialTheme.colorScheme.onErrorContainer,
                ),
            ) {
                Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Log out")
            }
        }
    }

    if (editingName) {
        var name by rememberSaveable { mutableStateOf(user.name) }
        val error = if (name.trim().length < 2) "Enter your name" else null
        AlertDialog(
            onDismissRequest = { editingName = false },
            title = { Text("Edit name") },
            text = { FormTextField(name, { name = it }, "Full name", error = error, imeAction = ImeAction.Done) },
            confirmButton = {
                TextButton(
                    onClick = { vm.updateName(name) { editingName = false } },
                    enabled = error == null && !vm.savingName,
                ) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { editingName = false }) { Text("Cancel") } },
        )
    }
    if (confirmLogout) {
        ConfirmDialog(
            title = "Log out?",
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

    fun submit() {
        if (state.submitting) return
        val errors = buildMap {
            if (state.current.isEmpty()) put("currentPassword", "Enter your current password")
            passwordProblem(state.new)?.let { put("newPassword", it) }
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
 * Change password from Profile, or — with [forced] — the "Set your password" step for accounts
 * that still have a temporary password (`mustChangePassword: true`).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChangePasswordScreen(onDone: () -> Unit, forced: Boolean = false) {
    val container = LocalAppContainer.current
    val vm = viewModel { ChangePasswordViewModel(container.auth) }
    val s = vm.state
    LaunchedEffect(s.done) { if (s.done) onDone() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (forced) "Set your password" else "Change password") },
                navigationIcon = { if (!forced) BackButton(onDone) },
                actions = { if (forced) TextButton(onClick = { container.auth.logout() }) { Text("Log out") } },
            )
        },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (forced) {
                Text(
                    "Your account has a temporary password. Choose your own to continue.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            s.formError?.let { FormBanner(it) }
            PasswordField(s.current, vm::onCurrent, if (forced) "Temporary password" else "Current password", error = s.errors["currentPassword"])
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                PasswordField(s.new, vm::onNew, "New password", error = s.errors["newPassword"])
                PasswordRulesChecklist(s.new)
            }
            PasswordField(
                s.confirm,
                vm::onConfirm,
                "Confirm new password",
                error = s.errors["confirmPassword"],
                imeAction = ImeAction.Done,
                onImeAction = vm::submit,
            )
            Button(onClick = vm::submit, enabled = !s.submitting, modifier = Modifier.fillMaxWidth().height(48.dp)) {
                if (s.submitting) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text("Save password")
            }
        }
    }
}
