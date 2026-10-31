package com.subscribby.mobile.platform

import androidx.compose.runtime.Composable

/**
 * True when the person asked the system for less motion (Android: animations off in developer/
 * accessibility settings; iOS: Reduce Motion). Decorative motion (count-up, stagger, shimmer) is
 * skipped and the final state is shown straight away.
 */
@Composable
expect fun rememberReduceMotion(): Boolean
