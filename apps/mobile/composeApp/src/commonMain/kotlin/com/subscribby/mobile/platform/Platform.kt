package com.subscribby.mobile.platform

/**
 * Where the API lives when nothing overrides it:
 * Android emulator → http://10.0.2.2:4000/api/v1 (the host machine),
 * iOS simulator and desktop → http://localhost:4000/api/v1.
 */
internal expect val platformDefaultApiBaseUrl: String

/** Desktop reads `-Dsubscribby.apiUrl=` / `SUBSCRIBBY_API_URL`; other platforms return null. */
internal expect fun platformApiBaseUrlOverride(): String?
