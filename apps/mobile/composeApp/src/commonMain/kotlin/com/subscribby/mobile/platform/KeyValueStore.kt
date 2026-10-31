package com.subscribby.mobile.platform

/**
 * Tiny persistent string store for the session token (and the cached user).
 * Android: SharedPreferences · iOS: NSUserDefaults · Desktop: java.util.prefs.
 */
interface KeyValueStore {
    fun getString(key: String): String?
    fun putString(key: String, value: String?)
}

/** Non-persistent store, used by tests. */
class InMemoryKeyValueStore : KeyValueStore {
    private val map = mutableMapOf<String, String>()
    override fun getString(key: String): String? = map[key]
    override fun putString(key: String, value: String?) {
        if (value == null) map.remove(key) else map[key] = value
    }
}
