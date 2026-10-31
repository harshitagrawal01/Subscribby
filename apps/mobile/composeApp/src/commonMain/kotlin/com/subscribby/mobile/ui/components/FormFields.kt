package com.subscribby.mobile.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.liveRegion
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
private fun fieldColors() = TextFieldDefaults.colors(
    focusedContainerColor = Palette.Surface,
    unfocusedContainerColor = Palette.Surface,
    errorContainerColor = Palette.Surface,
    disabledContainerColor = Palette.Paper,
    focusedIndicatorColor = Color.Transparent,
    unfocusedIndicatorColor = Color.Transparent,
    errorIndicatorColor = Color.Transparent,
    disabledIndicatorColor = Color.Transparent,
    focusedLabelColor = Palette.Ink6,
    unfocusedLabelColor = Palette.TextMuted,
    errorLabelColor = StatusColors.overdue,
    cursorColor = Palette.Ink8,
    errorCursorColor = StatusColors.overdue,
    focusedTextColor = Palette.Text,
    unfocusedTextColor = Palette.Text,
    errorTextColor = Palette.Text,
    focusedLeadingIconColor = Palette.Ink8,
    unfocusedLeadingIconColor = Palette.TextFaint,
    errorLeadingIconColor = StatusColors.overdue,
    focusedTrailingIconColor = Palette.TextMuted,
    unfocusedTrailingIconColor = Palette.TextMuted,
    errorTrailingIconColor = Palette.TextMuted,
)

/** Animated border: hairline at rest, 1.5dp ink when focused, red with an error. */
@Composable
private fun Modifier.fieldBorder(source: MutableInteractionSource, error: Boolean): Modifier {
    val focused by source.collectIsFocusedAsState()
    val color by animateColorAsState(
        when {
            error -> StatusColors.overdue
            focused -> Palette.Ink6
            else -> Palette.LineStrong
        },
        tween(Motion.QUICK),
        label = "field-border",
    )
    val width by animateDpAsState(if (focused || error) 1.5.dp else 1.dp, tween(Motion.QUICK), label = "field-border-width")
    return border(width, color, ControlShape)
}

/** Error under a field, sliding in; announced politely to screen readers. */
@Composable
private fun FieldError(error: String?) {
    AnimatedVisibility(
        visible = error != null,
        enter = fadeIn(tween(Motion.QUICK)) + expandVertically(tween(Motion.QUICK)),
        exit = fadeOut(tween(Motion.QUICK)) + shrinkVertically(tween(Motion.QUICK)),
    ) {
        // Keep showing the last message while it animates out.
        val last = remember { mutableStateOf(error) }
        if (error != null) last.value = error
        Row(
            Modifier.padding(start = 4.dp, top = 6.dp).semantics { liveRegion = LiveRegionMode.Polite },
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(AppIcons.AlertCircle, contentDescription = null, tint = StatusColors.overdue, modifier = Modifier.size(15.dp))
            Text(last.value.orEmpty(), style = MaterialTheme.typography.bodySmall, color = StatusColors.overdue)
        }
    }
}

private fun keyboardActions(imeAction: ImeAction, onImeAction: (() -> Unit)?): KeyboardActions =
    // Leave Next to the system so focus moves to the next field; only Done/Go run the form action.
    if (onImeAction == null || imeAction == ImeAction.Next) KeyboardActions.Default
    else KeyboardActions(onDone = { onImeAction() }, onGo = { onImeAction() }, onSend = { onImeAction() })

/**
 * Filled white field with a floating label inside it (no web-style label stacked above),
 * optional leading icon, inline error, and the right keyboard + autofill type.
 */
@Composable
fun FormTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    error: String? = null,
    hint: String? = null,
    leadingIcon: ImageVector? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    capitalization: KeyboardCapitalization = KeyboardCapitalization.None,
    imeAction: ImeAction = ImeAction.Next,
    onImeAction: (() -> Unit)? = null,
    enabled: Boolean = true,
    autofill: ContentType? = null,
) {
    val source = remember { MutableInteractionSource() }
    Column(Modifier.fillMaxWidth()) {
        TextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            isError = error != null,
            enabled = enabled,
            shape = ControlShape,
            colors = fieldColors(),
            label = { Text(label) },
            leadingIcon = leadingIcon?.let { icon -> { Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp)) } },
            trailingIcon = hint?.let { text ->
                { Text(text, style = MaterialTheme.typography.bodySmall, color = Palette.TextFaint, modifier = Modifier.padding(end = 16.dp)) }
            },
            textStyle = MaterialTheme.typography.bodyLarge,
            keyboardOptions = KeyboardOptions(
                keyboardType = keyboardType,
                imeAction = imeAction,
                capitalization = capitalization,
                autoCorrectEnabled = keyboardType != KeyboardType.Email,
            ),
            keyboardActions = keyboardActions(imeAction, onImeAction),
            interactionSource = source,
            modifier = modifier
                .fillMaxWidth()
                .fieldBorder(source, error != null)
                .then(if (autofill != null) Modifier.semantics { contentType = autofill } else Modifier),
        )
        FieldError(error)
    }
}

/**
 * Password field: same look, lock icon, eye toggle (48dp target), never trims what's typed.
 * [labelAction] sits under the field on the right (e.g. "Forgot password?"); [below] under that.
 */
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
    newPassword: Boolean = false,
    labelAction: (@Composable () -> Unit)? = null,
    below: (@Composable () -> Unit)? = null,
) {
    var visible by rememberSaveable { mutableStateOf(false) }
    val source = remember { MutableInteractionSource() }
    Column(Modifier.fillMaxWidth()) {
        TextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            isError = error != null,
            enabled = enabled,
            shape = ControlShape,
            colors = fieldColors(),
            label = { Text(label) },
            leadingIcon = { Icon(AppIcons.Lock, contentDescription = null, modifier = Modifier.size(20.dp)) },
            trailingIcon = {
                val toggleSource = remember { MutableInteractionSource() }
                Box(
                    Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .clickable(toggleSource, LocalIndication.current, role = Role.Button) { visible = !visible }
                        .semantics { contentDescription = if (visible) "Hide password" else "Show password" },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(if (visible) AppIcons.EyeOff else AppIcons.Eye, contentDescription = null, modifier = Modifier.size(20.dp))
                }
            },
            textStyle = MaterialTheme.typography.bodyLarge,
            visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = imeAction, autoCorrectEnabled = false),
            keyboardActions = keyboardActions(imeAction, onImeAction),
            interactionSource = source,
            modifier = modifier
                .fillMaxWidth()
                .fieldBorder(source, error != null)
                .semantics { contentType = if (newPassword) ContentType.NewPassword else ContentType.Password },
        )
        FieldError(error)
        if (labelAction != null) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) { labelAction() }
        }
        below?.invoke()
    }
}

/** Quiet live checklist under a new-password field (same four rules as the web app). */
@Composable
fun PasswordRulesChecklist(password: String, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth().padding(start = 4.dp, top = 10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        PASSWORD_RULES.chunked(2).forEach { pair ->
            Row(Modifier.fillMaxWidth()) {
                pair.forEach { rule -> RuleItem(rule.label, rule.test(password), Modifier.weight(1f)) }
                if (pair.size == 1) Box(Modifier.weight(1f))
            }
        }
        AnimatedVisibility(hasEdgeSpace(password)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(AppIcons.AlertCircle, contentDescription = null, tint = StatusColors.overdue, modifier = Modifier.size(15.dp))
                Text(EDGE_SPACE_MESSAGE, style = MaterialTheme.typography.bodySmall, color = StatusColors.overdue)
            }
        }
    }
}

@Composable
private fun RuleItem(label: String, met: Boolean, modifier: Modifier) {
    val fill by animateColorAsState(if (met) StatusColors.active else Color.Transparent, tween(Motion.QUICK), label = "rule-fill")
    val ring by animateColorAsState(if (met) StatusColors.active else Palette.LineStrong, tween(Motion.QUICK), label = "rule-ring")
    Row(
        modifier.semantics(mergeDescendants = true) { contentDescription = "$label, ${if (met) "met" else "not met"}" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Box(
            Modifier.size(16.dp).clip(CircleShape).background(fill).border(1.5.dp, ring, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            if (met) Icon(AppIcons.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(11.dp))
        }
        Text(label, style = MaterialTheme.typography.bodySmall, color = if (met) Palette.Text else Palette.TextMuted)
    }
}

/** Notice at the top of a form: what happened, in plain words, with an icon. */
@Composable
fun FormBanner(message: String, modifier: Modifier = Modifier, success: Boolean = false) {
    val tone: Color = if (success) StatusColors.active else StatusColors.overdue
    val background = if (success) StatusColors.activeTint else StatusColors.overdueTint
    Row(
        modifier
            .fillMaxWidth()
            .clip(ControlShape)
            .background(background)
            .padding(horizontal = 14.dp, vertical = 12.dp)
            .semantics { liveRegion = LiveRegionMode.Polite }
            .testTag(if (success) "form-success" else "form-error"),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(
            if (success) AppIcons.CircleCheck else AppIcons.AlertCircle,
            contentDescription = null,
            tint = tone,
            modifier = Modifier.padding(top = 1.dp).size(20.dp),
        )
        Text(message, style = MaterialTheme.typography.bodyMedium, color = if (success) Color(0xFF1F5536) else Color(0xFF8A1C12))
    }
}
