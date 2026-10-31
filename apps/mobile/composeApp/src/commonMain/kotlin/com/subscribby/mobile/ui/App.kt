package com.subscribby.mobile.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavDestination
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.subscribby.mobile.data.AppContainer
import com.subscribby.mobile.data.repo.SessionState
import com.subscribby.mobile.platform.rememberReduceMotion
import com.subscribby.mobile.ui.auth.ForgotPasswordScreen
import com.subscribby.mobile.ui.auth.LoginScreen
import com.subscribby.mobile.ui.auth.SignupScreen
import com.subscribby.mobile.ui.components.AppIcons
import com.subscribby.mobile.ui.components.LocalBottomChrome
import com.subscribby.mobile.ui.components.LocalReduceMotion
import com.subscribby.mobile.ui.components.Motion
import com.subscribby.mobile.ui.components.focusRing
import com.subscribby.mobile.ui.components.paperCard
import com.subscribby.mobile.ui.invoices.InvoiceDetailScreen
import com.subscribby.mobile.ui.invoices.InvoicesScreen
import com.subscribby.mobile.ui.profile.ChangePasswordScreen
import com.subscribby.mobile.ui.profile.ProfileScreen
import com.subscribby.mobile.ui.subscriptions.SubscriptionDetailScreen
import com.subscribby.mobile.ui.subscriptions.SubscriptionsScreen
import com.subscribby.mobile.ui.theme.Palette
import com.subscribby.mobile.ui.theme.SubscribbyTheme
import kotlin.reflect.KClass
import kotlinx.serialization.Serializable

val LocalAppContainer = staticCompositionLocalOf<AppContainer> { error("AppContainer not provided") }

// ---------- Routes (type-safe navigation) ----------

@Serializable data object LoginRoute
@Serializable data object SignupRoute
@Serializable data object ForgotPasswordRoute

@Serializable data object SubscriptionsRoute
@Serializable data object InvoicesRoute
@Serializable data object ProfileRoute
@Serializable data class SubscriptionDetailRoute(val id: String)
@Serializable data class InvoiceDetailRoute(val id: String)
@Serializable data object ChangePasswordRoute

private data class Tab(
    val route: Any,
    val routeClass: KClass<*>,
    val label: String,
    val icon: ImageVector,
    val selectedIcon: ImageVector,
)

private val TABS = listOf(
    Tab(SubscriptionsRoute, SubscriptionsRoute::class, "Home", AppIcons.Home, AppIcons.HomeSelected),
    Tab(InvoicesRoute, InvoicesRoute::class, "Invoices", AppIcons.Invoice, AppIcons.InvoiceSelected),
    Tab(ProfileRoute, ProfileRoute::class, "Profile", AppIcons.User, AppIcons.UserSelected),
)

private val TabBarHeight = 64.dp
private val TabBarMargin = 10.dp

/** Shared root composable for Android, iOS and desktop. */
@Composable
fun App(container: AppContainer) {
    CompositionLocalProvider(LocalAppContainer provides container, LocalReduceMotion provides rememberReduceMotion()) {
        SubscribbyTheme {
            val session by container.session.state.collectAsStateWithLifecycle()
            val s = session
            if (s is SessionState.LoggedIn) {
                // Refresh the cached user once per login (also detects a revoked token → logout).
                LaunchedEffect(s.user.id) { runCatching { container.auth.me() } }
            }
            val stage = when {
                s !is SessionState.LoggedIn -> 0
                s.user.mustChangePassword -> 1
                else -> 2
            }
            // Logging in or out cross-fades the whole app instead of snapping.
            AnimatedContent(
                targetState = stage,
                transitionSpec = {
                    (fadeIn(tween(Motion.ENTER)) + scaleIn(tween(Motion.ENTER, easing = Motion.EaseOut), initialScale = 0.98f)) togetherWith
                        fadeOut(tween(Motion.EXIT))
                },
                modifier = Modifier.fillMaxSize().background(Palette.Paper),
                label = "session",
            ) { current ->
                when (current) {
                    0 -> AuthNavHost()
                    1 -> ChangePasswordScreen(onDone = {}, forced = true)
                    else -> MainScaffold()
                }
            }
        }
    }
}

// ---------- Transitions: push/pop slide (shared X axis), tabs fade through ----------

private fun NavDestination?.isTopLevel() = this != null && TABS.any { hasRoute(it.routeClass) }

private fun AnimatedContentTransitionScope<NavBackStackEntry>.isTabSwitch() =
    initialState.destination.isTopLevel() && targetState.destination.isTopLevel()

private fun AnimatedContentTransitionScope<NavBackStackEntry>.pushEnter(): EnterTransition =
    if (isTabSwitch()) fadeIn(tween(Motion.ENTER - 80, delayMillis = 60))
    else slideInHorizontally(tween(Motion.ENTER + 40, easing = Motion.EaseOut)) { it / 3 } + fadeIn(tween(Motion.ENTER - 60))

private fun AnimatedContentTransitionScope<NavBackStackEntry>.pushExit(): ExitTransition =
    if (isTabSwitch()) fadeOut(tween(Motion.QUICK - 40))
    else slideOutHorizontally(tween(Motion.ENTER + 40, easing = Motion.EaseOut)) { -it / 8 } + fadeOut(tween(Motion.ENTER))

private fun AnimatedContentTransitionScope<NavBackStackEntry>.popEnter(): EnterTransition =
    slideInHorizontally(tween(Motion.ENTER, easing = Motion.EaseOut)) { -it / 8 } + fadeIn(tween(Motion.ENTER - 60))

private fun AnimatedContentTransitionScope<NavBackStackEntry>.popExit(): ExitTransition =
    slideOutHorizontally(tween(Motion.EXIT + 40, easing = Motion.EaseIn)) { it / 3 } + fadeOut(tween(Motion.EXIT))

@Composable
private fun AuthNavHost() {
    val nav = rememberNavController()
    NavHost(
        nav,
        startDestination = LoginRoute,
        modifier = Modifier.background(Palette.AuthPaper),
        enterTransition = { pushEnter() },
        exitTransition = { pushExit() },
        popEnterTransition = { popEnter() },
        popExitTransition = { popExit() },
    ) {
        composable<LoginRoute> {
            LoginScreen(
                onSignup = { nav.navigate(SignupRoute) },
                onForgotPassword = { nav.navigate(ForgotPasswordRoute) },
            )
        }
        composable<SignupRoute> {
            SignupScreen(onLogin = { if (!nav.popBackStack()) nav.navigate(LoginRoute) })
        }
        composable<ForgotPasswordRoute> {
            ForgotPasswordScreen(onBackToLogin = { if (!nav.popBackStack()) nav.navigate(LoginRoute) })
        }
    }
}

@Composable
private fun MainScaffold() {
    val nav = rememberNavController()
    val backStackEntry by nav.currentBackStackEntryAsState()
    val destination = backStackEntry?.destination
    val onTopLevel = destination == null || destination.isTopLevel()
    val navInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    // Space the floating tab bar takes at the bottom; tab screens pad their lists by this much.
    val tabSpace: Dp = navInset + TabBarHeight + TabBarMargin * 2

    Box(Modifier.fillMaxSize().background(Palette.Paper)) {
        NavHost(
            navController = nav,
            startDestination = SubscriptionsRoute,
            modifier = Modifier.fillMaxSize(),
            enterTransition = { pushEnter() },
            exitTransition = { pushExit() },
            popEnterTransition = { popEnter() },
            popExitTransition = { popExit() },
        ) {
            composable<SubscriptionsRoute> {
                CompositionLocalProvider(LocalBottomChrome provides tabSpace) {
                    SubscriptionsScreen(
                        onOpenSubscription = { nav.navigate(SubscriptionDetailRoute(it)) },
                        onOpenInvoices = { nav.switchTab(InvoicesRoute) },
                    )
                }
            }
            composable<InvoicesRoute> {
                CompositionLocalProvider(LocalBottomChrome provides tabSpace) {
                    InvoicesScreen(onOpenInvoice = { nav.navigate(InvoiceDetailRoute(it)) })
                }
            }
            composable<ProfileRoute> {
                CompositionLocalProvider(LocalBottomChrome provides tabSpace) {
                    ProfileScreen(onChangePassword = { nav.navigate(ChangePasswordRoute) })
                }
            }
            composable<SubscriptionDetailRoute> { entry ->
                val fromInvoice = nav.previousBackStackEntry?.destination?.hasRoute(InvoiceDetailRoute::class) == true
                SubscriptionDetailScreen(
                    id = entry.toRoute<SubscriptionDetailRoute>().id,
                    onBack = { nav.popBackStack() },
                    backLabel = if (fromInvoice) "Invoice" else "Home",
                )
            }
            composable<InvoiceDetailRoute> { entry ->
                InvoiceDetailScreen(
                    id = entry.toRoute<InvoiceDetailRoute>().id,
                    onBack = { nav.popBackStack() },
                    onOpenSubscription = { nav.navigate(SubscriptionDetailRoute(it)) },
                )
            }
            composable<ChangePasswordRoute> {
                ChangePasswordScreen(onDone = { nav.popBackStack() })
            }
        }

        AnimatedVisibility(
            visible = onTopLevel,
            modifier = Modifier.align(Alignment.BottomCenter),
            enter = slideInVertically(tween(Motion.ENTER, easing = Motion.EaseOut)) { it } + fadeIn(tween(Motion.ENTER)),
            exit = slideOutVertically(tween(Motion.EXIT, easing = Motion.EaseIn)) { it } + fadeOut(tween(Motion.EXIT)),
        ) {
            val selectedIndex = TABS.indexOfFirst { destination?.hasRoute(it.routeClass) == true }.coerceAtLeast(0)
            Box {
                // Paper fade so list content softly disappears behind the floating bar instead of
                // showing through the gap under it (no blur available on every platform).
                Box(
                    Modifier
                        .matchParentSize()
                        .background(Brush.verticalGradient(0f to Palette.Paper.copy(alpha = 0f), 0.3f to Palette.Paper.copy(alpha = 0.94f), 0.5f to Palette.Paper)),
                )
                FloatingTabBar(selectedIndex = selectedIndex, onSelect = { nav.switchTab(TABS[it].route) })
            }
        }
    }
}

/**
 * Floating capsule tab bar: white, soft shadow, hairline edge; the selected tab sits on an ink-0
 * pill that slides between tabs, with ink icon (heavier stroke) and label. Haptic tick on change.
 */
@Composable
private fun FloatingTabBar(selectedIndex: Int, onSelect: (Int) -> Unit) {
    val haptics = LocalHapticFeedback.current
    val shape = RoundedCornerShape(32.dp)
    Box(
        Modifier
            .fillMaxWidth()
            .padding(bottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding())
            .padding(horizontal = 24.dp, vertical = TabBarMargin),
        contentAlignment = Alignment.Center,
    ) {
        BoxWithConstraints(
            Modifier
                .widthIn(max = 400.dp)
                .fillMaxWidth()
                .height(TabBarHeight)
                .paperCard(shape, elevation = 16.dp)
                .border(1.dp, Palette.Line.copy(alpha = 0.7f), shape)
                .padding(6.dp)
                .selectableGroup()
                .testTag("bottom-nav"),
        ) {
            val tabWidth = maxWidth / TABS.size
            val indicatorOffset by animateDpAsState(
                tabWidth * selectedIndex,
                spring(dampingRatio = 0.82f, stiffness = Spring.StiffnessMediumLow),
                label = "tab-indicator",
            )
            Box(
                Modifier
                    .offset(x = indicatorOffset)
                    .width(tabWidth)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(26.dp))
                    .background(Palette.Ink0),
            )
            Row(Modifier.fillMaxSize()) {
                TABS.forEachIndexed { index, tab ->
                    val isSelected = index == selectedIndex
                    val color by animateColorAsState(if (isSelected) Palette.Ink8 else Palette.TextMuted, tween(Motion.QUICK), label = "tab-color")
                    val source = remember { MutableInteractionSource() }
                    Column(
                        Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(26.dp))
                            .focusRing(source, corner = 26.dp, outset = (-2).dp)
                            .selectable(
                                selected = isSelected,
                                onClick = {
                                    if (!isSelected) haptics.performHapticFeedback(HapticFeedbackType.SegmentTick)
                                    onSelect(index)
                                },
                                role = Role.Tab,
                                interactionSource = source,
                                indication = null,
                            )
                            .testTag("tab-${tab.label}"),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
                    ) {
                        Icon(if (isSelected) tab.selectedIcon else tab.icon, contentDescription = null, tint = color, modifier = Modifier.size(22.dp))
                        Text(
                            tab.label,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                            color = color,
                            maxLines = 1,
                        )
                    }
                }
            }
        }
    }
}

private fun NavHostController.switchTab(route: Any) {
    navigate(route) {
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}
