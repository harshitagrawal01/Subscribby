package com.subscribby.mobile

import com.subscribby.mobile.platform.platformApiBaseUrlOverride
import com.subscribby.mobile.platform.platformDefaultApiBaseUrl

/**
 * The one place to change which API the app talks to.
 *
 * - Leave [API_BASE_URL_OVERRIDE] null to use the per-platform default
 *   (Android emulator `http://10.0.2.2:4000/api/v1`, iOS simulator / desktop `http://localhost:4000/api/v1`).
 * - Set it to e.g. `"http://192.168.1.20:4000/api/v1"` to test on a real phone on your LAN,
 *   or to the deployed URL. (For plain-HTTP LAN IPs also allow the host in
 *   androidApp/src/main/res/xml/network_security_config.xml; iOS already allows local networking.)
 * - Desktop can also be pointed elsewhere without editing code:
 *   `SUBSCRIBBY_API_URL=http://host:4000/api/v1 ./gradlew :composeApp:run`.
 */
object AppConfig {
    /** Live backend on Elastic Beanstalk. Set to null to use the local API on port 4000. */
    val API_BASE_URL_OVERRIDE: String? = "http://subscribby-api-env.eba-xyim8qvr.ap-south-1.elasticbeanstalk.com/api/v1"

    val apiBaseUrl: String
        get() = (API_BASE_URL_OVERRIDE ?: platformApiBaseUrlOverride() ?: platformDefaultApiBaseUrl).trimEnd('/')

    /** Logs every request/response line in debug output. */
    const val HTTP_LOGGING = true
}
