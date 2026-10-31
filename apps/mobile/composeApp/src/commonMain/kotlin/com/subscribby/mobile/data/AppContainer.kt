package com.subscribby.mobile.data

import com.subscribby.mobile.AppConfig
import com.subscribby.mobile.data.api.ApiClient
import com.subscribby.mobile.data.repo.AuthRepository
import com.subscribby.mobile.data.repo.PortalRepository
import com.subscribby.mobile.data.repo.SessionStore
import com.subscribby.mobile.platform.KeyValueStore
import io.ktor.client.HttpClient

/** Manual dependency container: one per app process, created by each platform entry point. */
class AppContainer(
    store: KeyValueStore,
    baseUrl: String = AppConfig.apiBaseUrl,
    httpClient: HttpClient? = null,
    logging: Boolean = AppConfig.HTTP_LOGGING,
) {
    val session = SessionStore(store)

    val api = ApiClient(
        baseUrl = baseUrl,
        tokenProvider = { session.token },
        onUnauthenticated = { session.clear("Your session has ended. Please log in again.") },
        httpClient = httpClient,
        logging = logging,
    )

    val auth = AuthRepository(api, session)
    val portal = PortalRepository(api)
}
