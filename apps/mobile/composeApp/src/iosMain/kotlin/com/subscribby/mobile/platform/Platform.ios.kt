package com.subscribby.mobile.platform

import platform.Foundation.NSUserDefaults

internal actual val platformDefaultApiBaseUrl: String = "http://localhost:4000/api/v1"

internal actual fun platformApiBaseUrlOverride(): String? = null

class IosKeyValueStore : KeyValueStore {
    private val defaults = NSUserDefaults.standardUserDefaults
    override fun getString(key: String): String? = defaults.stringForKey(key)
    override fun putString(key: String, value: String?) {
        if (value == null) defaults.removeObjectForKey(key) else defaults.setObject(value, forKey = key)
    }
}
