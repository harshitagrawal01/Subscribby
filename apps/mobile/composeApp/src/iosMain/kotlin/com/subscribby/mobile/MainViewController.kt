package com.subscribby.mobile

import androidx.compose.ui.window.ComposeUIViewController
import com.subscribby.mobile.data.AppContainer
import com.subscribby.mobile.platform.IosKeyValueStore
import com.subscribby.mobile.ui.App
import platform.UIKit.UIViewController

private val container: AppContainer by lazy { AppContainer(store = IosKeyValueStore()) }

/** Called from SwiftUI (iosApp/iosApp/ContentView.swift). */
fun MainViewController(): UIViewController = ComposeUIViewController { App(container) }
