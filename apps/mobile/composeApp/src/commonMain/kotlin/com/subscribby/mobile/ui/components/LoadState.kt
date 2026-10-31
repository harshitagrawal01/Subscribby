package com.subscribby.mobile.ui.components

/** What a screen is showing. [Success.refreshing] = new data is loading behind the current data. */
sealed interface LoadState<out T> {
    data object Loading : LoadState<Nothing>
    data class Error(val message: String) : LoadState<Nothing>
    data class Success<T>(val data: T, val refreshing: Boolean = false) : LoadState<T>
}

val <T> LoadState<T>.dataOrNull: T? get() = (this as? LoadState.Success<T>)?.data
