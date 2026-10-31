package com.subscribby.mobile.ui.components

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp

/** Outline icons at stroke 1.5 (2 for a selected tab). Paths from Tabler Icons (MIT licence). */
object AppIcons {
    private val HOME = arrayOf(
        "M5 12l-2 0l9 -9l9 9l-2 0",
        "M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7",
        "M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6",
    )
    private val INVOICE = arrayOf(
        "M14 3v4a1 1 0 0 0 1 1h4",
        "M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z",
        "M9 7l1 0",
        "M9 13l6 0",
        "M13 17l2 0",
    )
    private val USER = arrayOf(
        "M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0",
        "M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2",
    )

    val Home = tabler("home", 1.5f, *HOME)
    val HomeSelected = tabler("home-selected", 2f, *HOME)
    val Invoice = tabler("file-invoice", 1.5f, *INVOICE)
    val InvoiceSelected = tabler("file-invoice-selected", 2f, *INVOICE)
    val User = tabler("user", 1.5f, *USER)
    val UserSelected = tabler("user-selected", 2f, *USER)

    val ArrowLeft = tabler("arrow-left", 1.75f, "M5 12l14 0", "M5 12l6 6", "M5 12l6 -6")
    val ArrowRight = tabler("arrow-right", 1.75f, "M5 12l14 0", "M13 18l6 -6", "M13 6l6 6")
    val ChevronLeft = tabler("chevron-left", 2f, "M15 6l-6 6l6 6")
    val ChevronRight = tabler("chevron-right", 1.75f, "M9 6l6 6l-6 6")
    val Refresh = tabler(
        "refresh",
        1.75f,
        "M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4",
        "M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4",
    )
    val Check = tabler("check", 2f, "M5 12l5 5l10 -10")
    val Close = tabler("x", 1.75f, "M18 6l-12 12", "M6 6l12 12")
    val Eye = tabler(
        "eye",
        1.5f,
        "M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0",
        "M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6",
    )
    val EyeOff = tabler(
        "eye-off",
        1.5f,
        "M10.585 10.587a2 2 0 0 0 2.829 2.828",
        "M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87",
        "M3 3l18 18",
    )
    val Mail = tabler(
        "mail",
        1.5f,
        "M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z",
        "M3 7l9 6l9 -6",
    )
    val Lock = tabler(
        "lock",
        1.5f,
        "M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z",
        "M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0",
        "M8 11v-4a4 4 0 1 1 8 0v4",
    )
    val Receipt = tabler(
        "receipt",
        1.5f,
        "M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2",
        "M9 8h6",
        "M9 12h6",
        "M13 16h2",
    )
    val Repeat = tabler(
        "repeat",
        1.5f,
        "M4 12v-3a3 3 0 0 1 3 -3h13m-3 -3l3 3l-3 3",
        "M20 12v3a3 3 0 0 1 -3 3h-13m3 3l-3 -3l3 -3",
    )
    val Calendar = tabler(
        "calendar",
        1.5f,
        "M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z",
        "M16 3v4",
        "M8 3v4",
        "M4 11h16",
    )
    val Clock = tabler("clock", 1.75f, "M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0", "M12 7v5l3 3")
    val Building = tabler(
        "building",
        1.5f,
        "M3 21l18 0",
        "M9 8l1 0",
        "M9 12l1 0",
        "M9 16l1 0",
        "M14 8l1 0",
        "M14 12l1 0",
        "M14 16l1 0",
        "M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16",
    )
    val Phone = tabler(
        "phone",
        1.5f,
        "M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2",
    )
    val MapPin = tabler(
        "map-pin",
        1.5f,
        "M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0",
        "M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z",
    )
    val Id = tabler(
        "id",
        1.5f,
        "M3 7a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v10a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z",
        "M7 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
        "M15 8l2 0",
        "M15 12l2 0",
        "M7 16l10 0",
    )
    val Logout = tabler(
        "logout",
        1.5f,
        "M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2",
        "M9 12h12l-3 -3",
        "M18 15l3 -3",
    )
    val AlertCircle = tabler("alert-circle", 1.75f, "M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0", "M12 8v4", "M12 16h.01")
    val CircleCheck = tabler("circle-check", 1.75f, "M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0", "M9 12l2 2l4 -4")
    val Pencil = tabler("pencil", 1.5f, "M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4", "M13.5 6.5l4 4")
    val Card = tabler(
        "credit-card",
        1.5f,
        "M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z",
        "M3 10l18 0",
        "M7 15l.01 0",
        "M11 15l2 0",
    )
}

private fun tabler(name: String, stroke: Float, vararg paths: String): ImageVector =
    ImageVector.Builder(name = name, defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f)
        .apply {
            paths.forEach { d ->
                addPath(
                    pathData = addPathNodes(d),
                    fill = null,
                    stroke = SolidColor(Color.Black),
                    strokeLineWidth = stroke,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                )
            }
        }
        .build()
