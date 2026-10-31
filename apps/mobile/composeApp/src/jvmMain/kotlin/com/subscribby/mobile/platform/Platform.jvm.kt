package com.subscribby.mobile.platform

import java.util.prefs.Preferences

internal actual val platformDefaultApiBaseUrl: String = "http://localhost:4000/api/v1"

internal actual fun platformApiBaseUrlOverride(): String? =
    System.getProperty("subscribby.apiUrl")?.takeIf { it.isNotBlank() }
        ?: System.getenv("SUBSCRIBBY_API_URL")?.takeIf { it.isNotBlank() }

class DesktopKeyValueStore(node: String = "com/subscribby/mobile") : KeyValueStore {
    private val prefs = Preferences.userRoot().node(node)
    override fun getString(key: String): String? = prefs.get(key, null)
    override fun putString(key: String, value: String?) {
        if (value == null) prefs.remove(key) else prefs.put(key, value)
        prefs.flush()
    }
}
