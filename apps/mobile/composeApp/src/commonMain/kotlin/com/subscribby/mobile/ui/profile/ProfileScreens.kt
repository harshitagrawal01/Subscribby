package com.subscribby.mobile.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.subscribby.mobile.data.api.ApiException
import com.subscribby.mobile.data.api.userMessage
import com.subscribby.mobile.data.repo.AuthRepository
import com.subscribby.mobile.data.repo.SessionState
import com.subscribby.mobile.ui.LocalAppContainer
import com.subscribby.mobile.ui.components.ActionDock
import com.subscribby.mobile.ui.components.AppIcons
import com.subscribby.mobile.ui.components.AppSheet
import com.subscribby.mobile.ui.components.AppSnack
import com.subscribby.mobile.ui.components.BackButton
import com.subscribby.mobile.ui.components.CardShape
import com.subscribby.mobile.ui.components.ConfirmSheet
import com.subscribby.mobile.ui.components.FormBanner
import com.subscribby.mobile.ui.components.FormTextField
import com.subscribby.mobile.ui.components.GroupDivider
import com.subscribby.mobile.ui.components.GroupFootnote
import com.subscribby.mobile.ui.components.GroupGap
import com.subscribby.mobile.ui.components.IconTile
import com.subscribby.mobile.ui.components.InsetGroup
import com.subscribby.mobile.ui.components.LargeTitleScreen
import com.subscribby.mobile.ui.components.LogoMark
import com.subscribby.mobile.ui.components.PasswordField
import com.subscribby.mobile.ui.components.PasswordRulesChecklist
import com.subscribby.mobile.ui.components.PrimaryButton
import com.subscribby.mobile.ui.components.ScreenPadding
import com.subscribby.mobile.ui.components.SectionHeader
import com.subscribby.mobile.ui.components.TertiaryButton
import com.subscribby.mobile.ui.components.TitleInset
import com.subscribby.mobile.ui.components.ValueRow
import com.subscribby.mobile.ui.components.dismissKeyboardOnTap
import com.subscribby.mobile.ui.components.entrance
import com.subscribby.mobile.ui.components.paperCard
import com.subscribby.mobile.ui.components.rememberSheetCloser
import com.subscribby.mobile.ui.components.rowClickable
import com.subscribby.mobile.ui.theme.LocalSerifFamily
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.ui.theme.StatusColors
import com.subscribby.mobile.util.newPasswordProblem
import kotlinx.coroutines.launch

class ProfileViewModel(private val auth: AuthRepository) : ViewModel() {
    var refreshing by mutableStateOf(false)
        private set
    var savingName by mutableStateOf(false)
        private set
    var message by mutableStateOf<String?>(null)
        private set
    var messageSuccess by mutableStateOf(false)
        private set

    fun refresh() {
        refreshing = true
        viewModelScope.launch {
            runCatching { auth.me() }.onFailure {
                messageSuccess = false
                message = it.userMessage()
            }
            refreshing = false
        }
    }

    fun updateName(name: String, onDone: () -> Unit) {
        savingName = true
        viewModelScope.launch {
            try {
                auth.updateName(name.trim())
                messageSuccess = true
                message = "Name updated"
                onDone()
            } catch (e: ApiException) {
                messageSuccess = false
                message = e.fieldErrors["name"] ?: e.userMessage()
            } catch (e: Exception) {
                messageSuccess = false
                message = e.userMessage()
            } finally {
                savingName = false
            }
        }
    }

    fun messageShown() { message = null }
    fun logout() = auth.logout()
}

private fun initials(name: String): String =
    name.trim().split(' ').filter { it.isNotBlank() }.let { parts ->
        (parts.firstOrNull()?.take(1).orEmpty() + (if (parts.size > 1) parts.last().take(1) else "")).uppercase()
    }.ifEmpty { "?" }

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
            snackbar.showSnackbar(AppSnack(it, success = vm.messageSuccess))
            vm.messageShown()
        }
    }

    val gutter = Modifier.padding(horizontal = ScreenPadding)
    LargeTitleScreen(
        title = "Profile",
        refreshing = vm.refreshing,
        onRefresh = vm::refresh,
        snackbar = snackbar,
        listTag = "profile-list",
    ) {
        item(key = "identity") {
            Row(
                gutter.fillMaxWidth().entrance(0).paperCard(CardShape).padding(18.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(60.dp).clip(CircleShape).background(Palette.Ink8), contentAlignment = Alignment.Center) {
                    Text(
                        initials(user.name),
                        style = TextStyle(fontFamily = LocalSerifFamily.current, fontWeight = FontWeight.SemiBold, fontSize = 24.sp),
                        color = Palette.OnInk,
                    )
                }
                Spacer(Modifier.width(16.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(user.name, style = MaterialTheme.typography.titleMedium, color = Palette.Text)
                    Text(user.email, style = MaterialTheme.typography.bodySmall, color = Palette.TextMuted)
                    user.customer?.name?.let {
                        Text(it, style = MaterialTheme.typography.bodySmall, color = Palette.TextMuted)
                    }
                }
            }
        }

        item(key = "account") {
            Column(gutter.padding(top = GroupGap).entrance(1)) {
                SectionHeader("Account")
                InsetGroup {
                    ValueRow("Name", user.name, icon = AppIcons.User, onClick = { editingName = true })
                    GroupDivider(start = 58.dp)
                    ValueRow("Email", user.email, icon = AppIcons.Mail)
                    GroupDivider(start = 58.dp)
                    ValueRow("Password", "Change", icon = AppIcons.Lock, onClick = onChangePassword)
                }
            }
        }

        item(key = "billing") {
            val customer = user.customer
            Column(gutter.padding(top = GroupGap).entrance(2)) {
                SectionHeader("Billing details")
                InsetGroup {
                    ValueRow("Company", customer?.name ?: "—", icon = AppIcons.Building)
                    customer?.phone?.takeIf { it.isNotBlank() }?.let {
                        GroupDivider(start = 58.dp)
                        ValueRow("Phone", it, icon = AppIcons.Phone)
                    }
                    customer?.billingAddress?.singleLine()?.takeIf { it.isNotBlank() }?.let {
                        GroupDivider(start = 58.dp)
                        ValueRow("Address", it, icon = AppIcons.MapPin)
                    }
                    customer?.taxId?.takeIf { it.isNotBlank() }?.let {
                        GroupDivider(start = 58.dp)
                        ValueRow("GSTIN", it, icon = AppIcons.Id)
                    }
                }
                GroupFootnote("Only your billing team can change these details.")
            }
        }

        item(key = "logout") {
            InsetGroup(gutter.padding(top = GroupGap).entrance(3)) {
                Row(
                    Modifier.fillMaxWidth().rowClickable({ confirmLogout = true }).heightIn(min = 52.dp).padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconTile(AppIcons.Logout, tint = StatusColors.overdue, background = StatusColors.overdueTint, size = 30.dp, iconSize = 17.dp)
                    Spacer(Modifier.width(12.dp))
                    Text("Log out", style = MaterialTheme.typography.bodyLarge, color = StatusColors.overdue)
                }
            }
        }

        item(key = "brand") {
            Row(
                Modifier.fillMaxWidth().padding(top = 28.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                LogoMark(18.dp)
                Spacer(Modifier.width(6.dp))
                Text("Subscribby", style = MaterialTheme.typography.bodySmall, color = Palette.TextFaint)
            }
        }
    }

    if (editingName) {
        EditNameSheet(
            initial = user.name,
            saving = vm.savingName,
            onSave = { name, done -> vm.updateName(name, done) },
            onDismiss = { editingName = false },
        )
    }
    if (confirmLogout) {
        ConfirmSheet(
            title = "Log out of Subscribby?",
            message = "You'll need your email and password to log back in.",
            confirmLabel = "Log out",
            destructive = true,
            onConfirm = { confirmLogout = false; vm.logout() },
            onDismiss = { confirmLogout = false },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditNameSheet(initial: String, saving: Boolean, onSave: (String, () -> Unit) -> Unit, onDismiss: () -> Unit) {
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val close = rememberSheetCloser(state)
    val haptics = LocalHapticFeedback.current
    var name by rememberSaveable { mutableStateOf(initial) }
    var touched by rememberSaveable { mutableStateOf(false) }
    // Trimmed before checking and saving.
    val problem = if (name.trim().length < 2) "Enter your full name" else null
    val focus = remember { FocusRequester() }
    val save = {
        touched = true
        if (problem == null) {
            onSave(name) {
                haptics.performHapticFeedback(HapticFeedbackType.Confirm)
                close(onDismiss)
            }
        } else {
            haptics.performHapticFeedback(HapticFeedbackType.Reject)
        }
    }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }

    AppSheet(onDismiss = onDismiss, sheetState = state) {
        Text("Edit your name", style = MaterialTheme.typography.headlineMedium, color = Palette.Text, modifier = Modifier.semantics { heading() })
        Spacer(Modifier.height(6.dp))
        Text("It shows on your account and in emails from Subscribby.", style = MaterialTheme.typography.bodyMedium, color = Palette.TextMuted)
        Spacer(Modifier.height(20.dp))
        FormTextField(
            name,
            { name = it; touched = true },
            "Full name",
            error = problem.takeIf { touched },
            leadingIcon = AppIcons.User,
            capitalization = KeyboardCapitalization.Words,
            imeAction = ImeAction.Done,
            onImeAction = save,
            autofill = ContentType.PersonFullName,
            modifier = Modifier.focusRequester(focus),
        )
        Spacer(Modifier.height(20.dp))
        PrimaryButton("Save name", onClick = save, enabled = problem == null, loading = saving)
        Spacer(Modifier.height(4.dp))
        TertiaryButton("Cancel", onClick = { close(onDismiss) }, modifier = Modifier.fillMaxWidth())
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
 * that still have a temporary password (`mustChangePassword: true`). A plain scrolling form
 * (not a lazy list) so the focused field always scrolls above the keyboard; the save button
 * is docked above the keyboard too.
 */
@Composable
fun ChangePasswordScreen(onDone: () -> Unit, forced: Boolean = false) {
    val container = LocalAppContainer.current
    val vm = viewModel { ChangePasswordViewModel(container.auth) }
    val haptics = LocalHapticFeedback.current
    val s = vm.state
    LaunchedEffect(s.done) {
        if (s.done) {
            haptics.performHapticFeedback(HapticFeedbackType.Confirm)
            onDone()
        }
    }
    val submit = {
        vm.submit()
        if (vm.state.errors.isNotEmpty()) haptics.performHapticFeedback(HapticFeedbackType.Reject)
    }

    Column(Modifier.fillMaxSize().background(if (forced) Palette.AuthPaper else Palette.Paper).dismissKeyboardOnTap()) {
        Row(
            Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars).heightIn(min = 52.dp).padding(horizontal = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (forced) {
                LogoMark(26.dp, Modifier.padding(start = 14.dp))
                Spacer(Modifier.weight(1f))
                TertiaryButton("Log out", onClick = { container.auth.logout() })
            } else {
                BackButton(onDone, "Profile")
            }
        }
        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = ScreenPadding),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Column(Modifier.padding(start = TitleInset - ScreenPadding, top = 4.dp, bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    if (forced) "Set your password" else "Change password",
                    style = MaterialTheme.typography.displayLarge,
                    color = Palette.Text,
                    modifier = Modifier.semantics { heading() },
                )
                Text(
                    if (forced) "Your account has a temporary password. Choose your own to continue."
                    else "You'll stay logged in on this device. Other devices will need the new password.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Palette.TextMuted,
                )
            }
            s.formError?.let { FormBanner(it) }
            PasswordField(s.current, vm::onCurrent, if (forced) "Temporary password" else "Current password", error = s.errors["currentPassword"])
            PasswordField(
                s.new,
                vm::onNew,
                "New password",
                error = s.errors["newPassword"],
                newPassword = true,
                below = { PasswordRulesChecklist(s.new) },
            )
            PasswordField(
                s.confirm,
                vm::onConfirm,
                "Confirm new password",
                error = s.errors["confirmPassword"],
                newPassword = true,
                imeAction = ImeAction.Done,
                onImeAction = submit,
            )
            Spacer(Modifier.height(12.dp))
        }
        ActionDock {
            PrimaryButton("Save password", onClick = submit, loading = s.submitting, modifier = Modifier.weight(1f))
        }
    }
}
