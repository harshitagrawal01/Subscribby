package com.subscribby.mobile.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarVisuals
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.ui.theme.Radii
import kotlinx.coroutines.launch

/** Screen gutter; grouped lists sit this far from the edges, titles 4dp further in. */
val ScreenPadding = 16.dp
val TitleInset = 20.dp

/** Space between groups on a screen; tight spacing inside groups is 4-8dp. */
val GroupGap = 28.dp

val GroupShape = RoundedCornerShape(Radii.group)
val CardShape = RoundedCornerShape(Radii.card)
val ControlShape = RoundedCornerShape(Radii.control)

/**
 * Height taken at the bottom by app chrome (the floating tab bar plus the system navigation bar).
 * Null means no tab bar: screens pad for the navigation bar only.
 */
val LocalBottomChrome = compositionLocalOf<Dp?> { null }

/**
 * 2dp ink-6 ring while the element has keyboard focus. [outset] > 0 draws outside the bounds
 * (buttons), < 0 inside (full-width rows that would otherwise be clipped).
 */
@Composable
fun Modifier.focusRing(source: InteractionSource, corner: Dp = 6.dp, outset: Dp = 3.dp): Modifier {
    val focused by source.collectIsFocusedAsState()
    if (!focused) return this
    return drawWithContent {
        drawContent()
        val o = outset.toPx()
        val r = (corner.toPx() + o).coerceAtLeast(0f)
        drawRoundRect(
            color = Palette.Ink6,
            topLeft = Offset(-o, -o),
            size = Size(size.width + 2 * o, size.height + 2 * o),
            cornerRadius = CornerRadius(r, r),
            style = Stroke(width = 2.dp.toPx()),
        )
    }
}

/** Tapping empty space clears focus, which closes the keyboard (as native forms do). */
@Composable
fun Modifier.dismissKeyboardOnTap(): Modifier {
    val focusManager = LocalFocusManager.current
    return pointerInput(Unit) { detectTapGestures { focusManager.clearFocus() } }
}

/** Soft warm shadow + white fill: paper resting on paper. Used for groups and cards. */
fun Modifier.paperCard(shape: Shape, elevation: Dp = 3.dp, color: Color = Palette.Surface): Modifier =
    this
        .shadow(elevation, shape, clip = false, ambientColor = Palette.Shadow.copy(alpha = 0.10f), spotColor = Palette.Shadow.copy(alpha = 0.16f))
        .clip(shape)
        .background(color)

/** Whole-row tap target with ripple, focus ring and an optional haptic tick. */
@Composable
fun Modifier.rowClickable(onClick: () -> Unit, role: Role = Role.Button): Modifier {
    val source = remember { MutableInteractionSource() }
    return this
        .focusRing(source, corner = 0.dp, outset = (-2).dp)
        .clickable(interactionSource = source, indication = LocalIndication.current, role = role, onClick = onClick)
}

/** Settings-style rounded group: white, soft shadow, rows separated by inset hairlines. */
@Composable
fun InsetGroup(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.fillMaxWidth().paperCard(GroupShape), content = content)
}

/** Hairline between rows of an [InsetGroup], starting at the text column like iOS. */
@Composable
fun GroupDivider(start: Dp = 16.dp, modifier: Modifier = Modifier) {
    Box(
        modifier
            .fillMaxWidth()
            .padding(start = start)
            .height(1.dp)
            .background(Palette.Line.copy(alpha = 0.8f)),
    )
}

/** Full-width hairline (bars and receipts). */
@Composable
fun Hairline(modifier: Modifier = Modifier, color: Color = Palette.Line) {
    Box(modifier.fillMaxWidth().height(1.dp).background(color))
}

/** Section title above a group. [prominent] = 17sp semibold (home), otherwise a quiet 13sp label (settings). */
@Composable
fun SectionHeader(
    text: String,
    modifier: Modifier = Modifier,
    trailing: String? = null,
    prominent: Boolean = false,
    action: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier
            .fillMaxWidth()
            .padding(start = 4.dp, end = 4.dp, bottom = if (prominent) 10.dp else 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text,
            style = if (prominent) MaterialTheme.typography.titleMedium else MaterialTheme.typography.labelMedium,
            color = if (prominent) Palette.Text else Palette.TextMuted,
            modifier = Modifier.weight(1f).semantics { heading() },
        )
        if (trailing != null) {
            Text(trailing, style = MaterialTheme.typography.bodySmall, color = Palette.TextFaint)
        }
        action?.invoke()
    }
}

/** Small note under a group (who can change this, what happens next). */
@Composable
fun GroupFootnote(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        style = MaterialTheme.typography.bodySmall,
        color = Palette.TextMuted,
        modifier = modifier.padding(start = 4.dp, end = 4.dp, top = 8.dp),
    )
}

/** Rounded square behind an icon or initials: the leading element of a list row. */
@Composable
fun IconTile(
    icon: ImageVector,
    modifier: Modifier = Modifier,
    tint: Color = Palette.Ink8,
    background: Color = Palette.Ink0,
    size: Dp = 40.dp,
    iconSize: Dp = 20.dp,
) {
    Box(
        modifier.size(size).clip(RoundedCornerShape(size * 0.3f)).background(background),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(iconSize))
    }
}

/**
 * Native list row: optional leading tile, title + subtitle, trailing content and chevron.
 * The whole row is the touch target (min 64dp, or 52dp for single-line rows).
 */
@Composable
fun ListRow(
    modifier: Modifier = Modifier,
    leading: (@Composable () -> Unit)? = null,
    subtitle: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    chevron: Boolean = false,
    onClick: (() -> Unit)? = null,
    title: @Composable () -> Unit,
) {
    Row(
        modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.rowClickable(onClick) else Modifier)
            .heightIn(min = if (subtitle != null) 64.dp else 52.dp)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leading != null) {
            leading()
            Spacer(Modifier.width(12.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            title()
            subtitle?.invoke()
        }
        if (trailing != null) {
            Spacer(Modifier.width(12.dp))
            trailing()
        }
        if (chevron) {
            Spacer(Modifier.width(6.dp))
            Icon(AppIcons.ChevronRight, contentDescription = null, tint = Palette.LineStrong, modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
fun RowTitle(text: String, modifier: Modifier = Modifier, color: Color = Palette.Text) {
    Text(text, modifier, style = MaterialTheme.typography.titleSmall, color = color, maxLines = 2, overflow = TextOverflow.Ellipsis)
}

@Composable
fun RowSubtitle(text: AnnotatedString, modifier: Modifier = Modifier, color: Color = Palette.TextMuted) {
    Text(text, modifier, style = MaterialTheme.typography.bodySmall, color = color, maxLines = 2, overflow = TextOverflow.Ellipsis)
}

@Composable
fun RowSubtitle(text: String, modifier: Modifier = Modifier, color: Color = Palette.TextMuted) =
    RowSubtitle(AnnotatedString(text), modifier, color)

/** Settings row: optional small icon, label on the left, value on the right, chevron if tappable. */
@Composable
fun ValueRow(
    label: String,
    value: String?,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    valueColor: Color = Palette.TextMuted,
    onClick: (() -> Unit)? = null,
    valueContent: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.rowClickable(onClick) else Modifier)
            .heightIn(min = 52.dp)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            IconTile(icon, size = 30.dp, iconSize = 17.dp)
            Spacer(Modifier.width(12.dp))
        }
        Text(label, style = MaterialTheme.typography.bodyLarge, color = Palette.Text)
        Spacer(Modifier.width(16.dp))
        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterEnd) {
            if (valueContent != null) {
                valueContent()
            } else if (value != null) {
                Text(value, style = MaterialTheme.typography.bodyMedium, color = valueColor, textAlign = TextAlign.End, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
        }
        if (onClick != null) {
            Spacer(Modifier.width(6.dp))
            Icon(AppIcons.ChevronRight, contentDescription = null, tint = Palette.LineStrong, modifier = Modifier.size(18.dp))
        }
    }
}

// ---------------------------------------------------------------- Large-title screen

private val BarHeight = 52.dp

/**
 * iOS-style screen: a large Fraunces title that scrolls away under a compact translucent bar,
 * which then fades in the small title and a hairline. Edge to edge: content scrolls under the
 * status bar and the floating tab bar. Pull to refresh when [onRefresh] is set.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LargeTitleScreen(
    title: String,
    modifier: Modifier = Modifier,
    listState: LazyListState = rememberLazyListState(),
    compactTitle: AnnotatedString? = AnnotatedString(title),
    navigation: (@Composable () -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
    header: (@Composable () -> Unit)? = null,
    subtitle: (@Composable () -> Unit)? = null,
    refreshing: Boolean = false,
    onRefresh: (() -> Unit)? = null,
    snackbar: SnackbarHostState? = null,
    listTag: String? = null,
    bottomBar: (@Composable () -> Unit)? = null,
    content: LazyListScope.() -> Unit,
) {
    val density = LocalDensity.current
    val topInset = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val navInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    var bottomBarHeight by remember { mutableStateOf(0.dp) }
    val chrome = LocalBottomChrome.current ?: navInset
    // Forget the dock's height once it's gone (e.g. after the last action was used).
    val bottomSpace = max(chrome, if (bottomBar != null) bottomBarHeight else 0.dp)

    val thresholdPx = with(density) { 36.dp.toPx() }
    val collapsed by remember(listState) {
        derivedStateOf { listState.firstVisibleItemIndex > 0 || listState.firstVisibleItemScrollOffset > thresholdPx }
    }
    val barAlpha by animateFloatAsState(if (collapsed) 1f else 0f, tween(Motion.QUICK + 40), label = "bar")

    Box(modifier.fillMaxSize().background(Palette.Paper)) {
        val list: @Composable BoxScope.() -> Unit = {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize().then(if (listTag != null) Modifier.testTag(listTag) else Modifier),
                contentPadding = PaddingValues(top = topInset + BarHeight, bottom = bottomSpace + 28.dp),
            ) {
                item(key = "large-title", contentType = "title") {
                    if (header != null) {
                        header()
                    } else {
                        Column(Modifier.fillMaxWidth().padding(start = TitleInset, end = TitleInset, bottom = 18.dp)) {
                            Text(
                                title,
                                style = MaterialTheme.typography.displayLarge,
                                color = Palette.Text,
                                modifier = Modifier.semantics { heading() },
                            )
                            if (subtitle != null) {
                                Spacer(Modifier.height(6.dp))
                                subtitle()
                            }
                        }
                    }
                }
                content()
            }
        }
        if (onRefresh != null) {
            val pullState = rememberPullToRefreshState()
            PullToRefreshBox(
                isRefreshing = refreshing,
                onRefresh = onRefresh,
                state = pullState,
                modifier = Modifier.fillMaxSize(),
                indicator = {
                    PullToRefreshDefaults.Indicator(
                        state = pullState,
                        isRefreshing = refreshing,
                        modifier = Modifier.align(Alignment.TopCenter).padding(top = topInset + BarHeight - 8.dp),
                        containerColor = Palette.Surface,
                        color = Palette.Ink8,
                    )
                },
                content = list,
            )
        } else {
            Box(Modifier.fillMaxSize(), content = list)
        }

        // Compact bar: transparent over the large title, translucent paper once it has scrolled away.
        Column(Modifier.fillMaxWidth().align(Alignment.TopCenter)) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .background(Palette.Paper.copy(alpha = barAlpha))
                    .padding(top = topInset)
                    .height(BarHeight),
            ) {
                if (compactTitle != null) {
                    Text(
                        compactTitle,
                        style = MaterialTheme.typography.titleMedium,
                        color = Palette.Text,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(horizontal = 96.dp)
                            .graphicsLayer { alpha = barAlpha },
                    )
                }
                Row(
                    Modifier.fillMaxSize().padding(horizontal = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    navigation?.invoke()
                    Spacer(Modifier.weight(1f))
                    actions()
                }
            }
            Hairline(Modifier.graphicsLayer { alpha = barAlpha })
        }

        if (bottomBar != null) {
            Box(
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .onSizeChanged { bottomBarHeight = with(density) { it.height.toDp() } },
            ) { bottomBar() }
        }
        if (snackbar != null) {
            AppSnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = bottomSpace + 12.dp))
        }
    }
}

/** Large-title block that isn't a plain string (used by headers that add a subtitle row). */
@Composable
fun LargeTitleText(text: String, modifier: Modifier = Modifier) {
    Text(text, modifier.semantics { heading() }, style = MaterialTheme.typography.displayLarge, color = Palette.Text)
}

/** Bottom bar area for a screen's actions: translucent paper, hairline, sits above the keyboard and nav bar. */
@Composable
fun ActionDock(modifier: Modifier = Modifier, content: @Composable RowScope.() -> Unit) {
    Column(modifier.fillMaxWidth().background(Palette.Paper)) {
        Hairline()
        Row(
            Modifier
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.navigationBars.union(WindowInsets.ime))
                .padding(horizontal = ScreenPadding, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            content = content,
        )
    }
}

// ---------------------------------------------------------------- Bar buttons

/** iOS-style back: chevron and where it goes ("‹ Invoices"). 48dp tall. */
@Composable
fun BackButton(onBack: () -> Unit, label: String? = null) {
    val source = remember { MutableInteractionSource() }
    Row(
        Modifier
            .heightIn(min = 48.dp)
            .clip(RoundedCornerShape(24.dp))
            .focusRing(source, corner = 24.dp, outset = 0.dp)
            .clickable(interactionSource = source, indication = LocalIndication.current, role = Role.Button, onClick = onBack)
            .padding(start = 4.dp, end = if (label != null) 12.dp else 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(AppIcons.ChevronLeft, contentDescription = "Back", tint = Palette.Ink8, modifier = Modifier.size(26.dp))
        if (label != null) {
            Text(label, style = MaterialTheme.typography.bodyLarge, color = Palette.Ink8)
        }
    }
}

/** Round 40dp icon button (48dp touch target) for bar actions. */
@Composable
fun BarIconButton(icon: ImageVector, description: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val source = remember { MutableInteractionSource() }
    Box(
        modifier
            .size(48.dp)
            .focusRing(source, corner = 24.dp, outset = (-4).dp)
            .clickable(interactionSource = source, indication = null, role = Role.Button, onClick = onClick)
            .pressScale(source, 0.9f),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .size(38.dp)
                .clip(CircleShape)
                .background(Palette.Surface.copy(alpha = 0.9f))
                .border(1.dp, Palette.Line, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = description, tint = Palette.Ink8, modifier = Modifier.size(19.dp))
        }
    }
}

// ---------------------------------------------------------------- Sheets

/** Bottom sheet with Subscribby styling: white, 28dp top corners, slim handle, padded content. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppSheet(
    onDismiss: () -> Unit,
    sheetState: SheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    content: @Composable ColumnScope.() -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = RoundedCornerShape(topStart = Radii.sheet, topEnd = Radii.sheet),
        containerColor = Palette.Surface,
        scrimColor = Palette.Ink9.copy(alpha = 0.36f),
        dragHandle = {
            Box(Modifier.padding(top = 10.dp, bottom = 6.dp).size(width = 36.dp, height = 5.dp).clip(CircleShape).background(Palette.LineStrong))
        },
    ) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(top = 8.dp, bottom = 16.dp),
            content = content,
        )
    }
}

/** Runs [after] once the sheet has slid away, so the action never fights the exit animation. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun rememberSheetCloser(state: SheetState): (after: () -> Unit) -> Unit {
    val scope = rememberCoroutineScope()
    return { after -> scope.launch { state.hide() }.invokeOnCompletion { after() } }
}

/**
 * Confirmation as a bottom sheet: title, what will happen, optional summary rows, a full-width
 * confirm button and a quiet way out. Haptic tick on confirm.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConfirmSheet(
    title: String,
    message: String,
    confirmLabel: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    destructive: Boolean = false,
    dismissLabel: String = "Cancel",
    details: (@Composable ColumnScope.() -> Unit)? = null,
) {
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val close = rememberSheetCloser(state)
    val haptics = LocalHapticFeedback.current
    AppSheet(onDismiss = onDismiss, sheetState = state) {
        Text(withDocNumbers(title), style = MaterialTheme.typography.headlineMedium, color = Palette.Text, modifier = Modifier.semantics { heading() })
        Spacer(Modifier.height(8.dp))
        Text(message, style = MaterialTheme.typography.bodyMedium, color = Palette.TextMuted)
        if (details != null) {
            Spacer(Modifier.height(20.dp))
            Column(Modifier.fillMaxWidth().clip(GroupShape).background(Palette.Paper), content = details)
        }
        Spacer(Modifier.height(24.dp))
        PrimaryButton(
            confirmLabel,
            onClick = {
                haptics.performHapticFeedback(if (destructive) HapticFeedbackType.Reject else HapticFeedbackType.Confirm)
                close { onConfirm() }
            },
            destructive = destructive,
            modifier = Modifier.testTag("sheet-confirm"),
        )
        Spacer(Modifier.height(4.dp))
        TertiaryButton(dismissLabel, onClick = { close(onDismiss) }, modifier = Modifier.fillMaxWidth())
    }
}

/** Label / value line inside a [ConfirmSheet] summary. */
@Composable
fun SheetDetailRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = Palette.TextMuted, modifier = Modifier.weight(1f))
        Text(value, style = MaterialTheme.typography.bodyMedium, color = Palette.Text, textAlign = TextAlign.End)
    }
}

// ---------------------------------------------------------------- Snackbar

/** Snackbar content plus whether it reports a success (check icon) or a problem (alert icon). */
data class AppSnack(override val message: String, val success: Boolean = true) : SnackbarVisuals {
    override val actionLabel: String? = null
    override val withDismissAction: Boolean = false
    override val duration: SnackbarDuration = SnackbarDuration.Short
}

/** Floating ink toast with an icon; sits above the tab bar or action dock. */
@Composable
fun AppSnackbarHost(state: SnackbarHostState, modifier: Modifier = Modifier) {
    SnackbarHost(state, modifier) { data ->
        val success = (data.visuals as? AppSnack)?.success ?: true
        Row(
            Modifier
                .padding(horizontal = ScreenPadding)
                .fillMaxWidth()
                .paperCard(RoundedCornerShape(16.dp), elevation = 10.dp, color = Palette.Ink9)
                .padding(horizontal = 16.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                if (success) AppIcons.CircleCheck else AppIcons.AlertCircle,
                contentDescription = null,
                tint = if (success) com.subscribby.mobile.ui.theme.StatusColors.activeOnInk else com.subscribby.mobile.ui.theme.StatusColors.overdueOnInk,
                modifier = Modifier.size(20.dp),
            )
            Text(data.visuals.message, style = MaterialTheme.typography.bodyMedium, color = Palette.OnInk)
        }
    }
}

/** Small coloured dot used by status text and notices. */
@Composable
fun Dot(color: Color, modifier: Modifier = Modifier, size: Dp = 7.dp) {
    Spacer(modifier.size(size).clip(CircleShape).background(color))
}
