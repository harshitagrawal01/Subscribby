package com.subscribby.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.ui.theme.StatusColors
import com.subscribby.mobile.util.EDGE_SPACE_MESSAGE
import com.subscribby.mobile.util.PASSWORD_RULES
import com.subscribby.mobile.util.hasEdgeSpace

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Palette.Ink6,
    unfocusedBorderColor = Palette.LineStrong,
    disabledBorderColor = Palette.Line,
    errorBorderColor = StatusColors.overdue,
    focusedContainerColor = Palette.Surface,
    unfocusedContainerColor = Palette.Surface,
    disabledContainerColor = Palette.Paper,
    errorContainerColor = Palette.Surface,
    cursorColor = Palette.Ink8,
    errorCursorColor = StatusColors.overdue,
    focusedTextColor = Palette.Text,
    unfocusedTextColor = Palette.Text,
)

/** Label above the field (not floating), with an optional hint or link on the right. */
@Composable
private fun FieldLabel(label: String, hint: String?, trailing: (@Composable () -> Unit)?) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = Palette.Text, modifier = Modifier.weight(1f))
        if (hint != null) Text(hint, style = MaterialTheme.typography.bodySmall, color = Palette.TextFaint)
        trailing?.invoke()
    }
}

@Composable
private fun FieldError(error: String?) {
    if (error != null) Text(error, style = MaterialTheme.typography.bodySmall, color = StatusColors.overdue)
}

@Composable
fun FormTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    error: String? = null,
    hint: String? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    capitalization: KeyboardCapitalization = KeyboardCapitalization.None,
    imeAction: ImeAction = ImeAction.Next,
    onImeAction: (() -> Unit)? = null,
    enabled: Boolean = true,
) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        FieldLabel(label, hint, null)
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            isError = error != null,
            enabled = enabled,
            shape = ControlShape,
            colors = fieldColors(),
            textStyle = MaterialTheme.typography.bodyLarge,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = imeAction, capitalization = capitalization),
            keyboardActions = KeyboardActions(onAny = { onImeAction?.invoke() }),
            modifier = modifier.fillMaxWidth().semantics { contentDescription = label },
        )
        FieldError(error)
    }
}

@Composable
fun PasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    error: String? = null,
    imeAction: ImeAction = ImeAction.Next,
    onImeAction: (() -> Unit)? = null,
    enabled: Boolean = true,
    labelAction: (@Composable () -> Unit)? = null,
    below: (@Composable () -> Unit)? = null,
) {
    var visible by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        FieldLabel(label, null, labelAction)
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            isError = error != null,
            enabled = enabled,
            shape = ControlShape,
            colors = fieldColors(),
            textStyle = MaterialTheme.typography.bodyLarge,
            visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
            trailingIcon = {
                TertiaryButton(onClick = { visible = !visible }, contentPadding = PaddingValues(horizontal = 12.dp)) {
                    Text(if (visible) "Hide" else "Show", style = MaterialTheme.typography.labelMedium, color = Palette.TextMuted)
                }
            },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = imeAction),
            keyboardActions = KeyboardActions(onAny = { onImeAction?.invoke() }),
            modifier = modifier.fillMaxWidth().semantics { contentDescription = label },
        )
        FieldError(error)
        below?.invoke()
    }
}

/** Quiet live checklist under a new-password field (same four rules as the web app). */
@Composable
fun PasswordRulesChecklist(password: String, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth().padding(top = 2.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        PASSWORD_RULES.chunked(2).forEach { pair ->
            Row(Modifier.fillMaxWidth()) {
                pair.forEach { rule -> RuleItem(rule.label, rule.test(password), Modifier.weight(1f)) }
                if (pair.size == 1) Box(Modifier.weight(1f))
            }
        }
        if (hasEdgeSpace(password)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(Modifier.size(14.dp), contentAlignment = Alignment.Center) { Dot(StatusColors.overdue, size = 5.dp) }
                Text(EDGE_SPACE_MESSAGE, style = MaterialTheme.typography.bodySmall, color = StatusColors.overdue)
            }
        }
    }
}

@Composable
private fun RuleItem(label: String, met: Boolean, modifier: Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.size(14.dp), contentAlignment = Alignment.Center) {
            if (met) {
                Icon(AppIcons.Check, contentDescription = "Met", tint = StatusColors.active, modifier = Modifier.size(14.dp))
            } else {
                Dot(Palette.LineStrong, size = 5.dp, modifier = Modifier.semantics { contentDescription = "Not met" })
            }
        }
        Text(label, style = MaterialTheme.typography.bodySmall, color = if (met) Palette.TextMuted else Palette.TextFaint)
    }
}

/** One-line notice at the top of a form: what happened, in plain words. */
@Composable
fun FormBanner(message: String, modifier: Modifier = Modifier, success: Boolean = false) {
    val tone: Color = if (success) StatusColors.active else StatusColors.overdue
    val background = if (success) Color(0xFFF0F6F2) else Color(0xFFFCF1F0)
    Row(
        modifier
            .fillMaxWidth()
            .background(background, ControlShape)
            .border(1.dp, tone.copy(alpha = 0.25f), ControlShape)
            .padding(horizontal = 12.dp, vertical = 10.dp)
            .testTag(if (success) "form-success" else "form-error"),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(Modifier.padding(top = 7.dp)) { Dot(tone) }
        Text(message, style = MaterialTheme.typography.bodyMedium, color = if (success) Palette.Text else Color(0xFF8A1C12))
    }
}
