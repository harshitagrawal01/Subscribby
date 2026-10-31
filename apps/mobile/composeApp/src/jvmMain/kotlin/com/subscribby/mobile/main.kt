package com.subscribby.mobile

import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState
import com.subscribby.mobile.data.AppContainer
import com.subscribby.mobile.platform.DesktopKeyValueStore
import com.subscribby.mobile.ui.App

fun main() {
    val container = AppContainer(store = DesktopKeyValueStore())
    println("Subscribby desktop → API ${container.api.baseUrl}")
    application {
        Window(
            onCloseRequest = ::exitApplication,
            title = "Subscribby",
            state = rememberWindowState(width = 420.dp, height = 860.dp),
        ) {
            App(container)
        }
    }
}
