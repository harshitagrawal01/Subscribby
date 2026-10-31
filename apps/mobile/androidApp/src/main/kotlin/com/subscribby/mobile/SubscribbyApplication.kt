package com.subscribby.mobile

import android.app.Application
import com.subscribby.mobile.data.AppContainer
import com.subscribby.mobile.platform.AndroidKeyValueStore

/** Holds the single app-wide [AppContainer] so it survives activity recreation. */
class SubscribbyApplication : Application() {
    val container: AppContainer by lazy {
        AppContainer(store = AndroidKeyValueStore(this))
    }
}
