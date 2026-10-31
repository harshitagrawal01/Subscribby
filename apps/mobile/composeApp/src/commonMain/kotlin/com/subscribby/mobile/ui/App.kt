package com.subscribby.mobile.ui

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.lifecycle.compose.collectAsStateWithLifecycle
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
import com.subscribby.mobile.ui.auth.ForgotPasswordScreen
import com.subscribby.mobile.ui.auth.LoginScreen
import com.subscribby.mobile.ui.auth.SignupScreen
import com.subscribby.mobile.ui.invoices.InvoiceDetailScreen
import com.subscribby.mobile.ui.invoices.InvoicesScreen
import com.subscribby.mobile.ui.profile.ChangePasswordScreen
import com.subscribby.mobile.ui.profile.ProfileScreen
import com.subscribby.mobile.ui.subscriptions.SubscriptionDetailScreen
import com.subscribby.mobile.ui.subscriptions.SubscriptionsScreen
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

private data class Tab(val route: Any, val routeClass: KClass<*>, val label: String, val icon: ImageVector)

private val TABS = listOf(
    Tab(SubscriptionsRoute, SubscriptionsRoute::class, "Subscriptions", Icons.Default.Home),
    Tab(InvoicesRoute, InvoicesRoute::class, "Invoices", Icons.AutoMirrored.Filled.List),
    Tab(ProfileRoute, ProfileRoute::class, "Profile", Icons.Default.Person),
)

/** Shared root composable for Android, iOS and desktop. */
@Composable
fun App(container: AppContainer) {
    CompositionLocalProvider(LocalAppContainer provides container) {
        SubscribbyTheme {
            val session by container.session.state.collectAsStateWithLifecycle()
            when (val s = session) {
                SessionState.LoggedOut -> AuthNavHost()
                is SessionState.LoggedIn -> {
                    // Refresh the cached user once per login (also detects a revoked token → logout).
                    LaunchedEffect(s.user.id) { runCatching { container.auth.me() } }
                    if (s.user.mustChangePassword) {
                        ChangePasswordScreen(onDone = {}, forced = true)
                    } else {
                        MainScaffold()
                    }
                }
            }
        }
    }
}

@Composable
private fun AuthNavHost() {
    val nav = rememberNavController()
    NavHost(nav, startDestination = LoginRoute) {
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
    val onTopLevel = destination == null || TABS.any { destination.hasRoute(it.routeClass) }

    Scaffold(
        contentWindowInsets = WindowInsets(0), // inner screens handle their own insets
        bottomBar = {
            if (onTopLevel) {
                NavigationBar(Modifier.testTag("bottom-nav")) {
                    TABS.forEach { tab ->
                        NavigationBarItem(
                            selected = destination?.hasRoute(tab.routeClass) == true,
                            onClick = { nav.switchTab(tab.route) },
                            icon = { Icon(tab.icon, contentDescription = null) },
                            label = { Text(tab.label) },
                            modifier = Modifier.testTag("tab-${tab.label}"),
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = SubscriptionsRoute,
            modifier = Modifier.padding(padding).consumeWindowInsets(padding),
        ) {
            composable<SubscriptionsRoute> {
                SubscriptionsScreen(onOpenSubscription = { nav.navigate(SubscriptionDetailRoute(it)) })
            }
            composable<InvoicesRoute> {
                InvoicesScreen(onOpenInvoice = { nav.navigate(InvoiceDetailRoute(it)) })
            }
            composable<ProfileRoute> {
                ProfileScreen(onChangePassword = { nav.navigate(ChangePasswordRoute) })
            }
            composable<SubscriptionDetailRoute> { entry ->
                SubscriptionDetailScreen(id = entry.toRoute<SubscriptionDetailRoute>().id, onBack = { nav.popBackStack() })
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
    }
}

private fun NavHostController.switchTab(route: Any) {
    navigate(route) {
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}
