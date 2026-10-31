package com.subscribby.mobile.platform

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import platform.UIKit.UIAccessibilityIsReduceMotionEnabled

@Composable
actual fun rememberReduceMotion(): Boolean = remember { UIAccessibilityIsReduceMotionEnabled() }
