package com.subscribby.mobile.platform

import android.content.Context

internal actual val platformDefaultApiBaseUrl: String = "http://10.0.2.2:4000/api/v1"

internal actual fun platformApiBaseUrlOverride(): String? = null

class AndroidKeyValueStore(context: Context) : KeyValueStore {
    private val prefs = context.applicationContext.getSharedPreferences("subscribby", Context.MODE_PRIVATE)
    override fun getString(key: String): String? = prefs.getString(key, null)
    override fun putString(key: String, value: String?) {
        prefs.edit().apply { if (value == null) remove(key) else putString(key, value) }.apply()
    }
}
