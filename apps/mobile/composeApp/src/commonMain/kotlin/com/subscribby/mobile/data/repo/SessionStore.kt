package com.subscribby.mobile.data.repo

import com.subscribby.mobile.data.api.ApiJson
import com.subscribby.mobile.data.model.AuthUser
import com.subscribby.mobile.data.model.Session
import com.subscribby.mobile.platform.KeyValueStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed interface SessionState {
    data object LoggedOut : SessionState
    data class LoggedIn(val user: AuthUser) : SessionState
}

/**
 * Persists the bearer token and the last known user, and exposes the login state to the UI.
 * The token is valid for 7 days and there is no refresh token: a 401 simply means "log in again".
 */
class SessionStore(private val store: KeyValueStore) {

    private val _state = MutableStateFlow(restore())
    val state: StateFlow<SessionState> = _state.asStateFlow()

    /** Shown once on the login screen after a forced logout (e.g. expired token). */
    private val _notice = MutableStateFlow<String?>(null)
    val notice: StateFlow<String?> = _notice.asStateFlow()

    val token: String? get() = store.getString(KEY_TOKEN)

    val currentUser: AuthUser? get() = (state.value as? SessionState.LoggedIn)?.user

    fun save(session: Session) {
        store.putString(KEY_TOKEN, session.token)
        updateUser(session.user)
        _notice.value = null
    }

    fun updateUser(user: AuthUser) {
        store.putString(KEY_USER, ApiJson.encodeToString(AuthUser.serializer(), user))
        _state.value = SessionState.LoggedIn(user)
    }

    /** Forgets the session. [notice] is shown on the login screen (null for a normal log out). */
    fun clear(notice: String? = null) {
        store.putString(KEY_TOKEN, null)
        store.putString(KEY_USER, null)
        _notice.value = notice
        _state.value = SessionState.LoggedOut
    }

    fun consumeNotice() {
        _notice.value = null
    }

    private fun restore(): SessionState {
        val token = store.getString(KEY_TOKEN) ?: return SessionState.LoggedOut
        val user = store.getString(KEY_USER)?.let {
            runCatching { ApiJson.decodeFromString(AuthUser.serializer(), it) }.getOrNull()
        }
        return if (token.isNotBlank() && user != null) SessionState.LoggedIn(user) else SessionState.LoggedOut
    }

    private companion object {
        const val KEY_TOKEN = "auth.token"
        const val KEY_USER = "auth.user"
    }
}
