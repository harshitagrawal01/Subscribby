# Subscribby mobile (Kotlin Multiplatform + Compose Multiplatform)

The **customer** app for Subscribby: customers log in, see their subscriptions and invoices, and accept quotations.
Staff and admin features are web-only and are not in this app (a staff login is refused with "Wrong email or password.").

One shared Compose UI runs on **Android**, **iOS** (arm64 device + Apple Silicon simulator) and **Desktop (JVM)**.
It talks to the same API as the web app (`/api/v1`).

## Requirements

| Tool | Version |
| --- | --- |
| JDK | 17 or newer (Android Studio's bundled JBR 21 works: `/Applications/Android Studio.app/Contents/jbr/Contents/Home`) |
| Android Studio | Panda 2 (2025.3.2) or newer — needed for AGP 9.1 |
| Android SDK | Platform **android-37** (compileSdk), build-tools 36+ |
| Xcode | 26.x (only for iOS) |
| Node 20+ | to run the mock API |

No global Gradle is needed; use `./gradlew`. Create `local.properties` (gitignored) if Android Studio didn't:

```properties
sdk.dir=/Users/<you>/Library/Android/sdk
```

## Start the API first

```bash
cd apps/web && npm install && npm run mock   # http://localhost:4000/api/v1
```

Test customers: `asha@kite.test` / `Customer@2026!` (Kite Stores — has a pending quotation to accept) and
`billing@acme.test` / `Customer@2026!`. `POST http://localhost:4000/api/v1/__mock/reset` re-seeds the data.

## Run it

All commands from `apps/mobile/` (quote the path — the repo path has spaces).

### Android (emulator)

Open `apps/mobile` in Android Studio, wait for the Gradle sync, pick the **androidApp** run configuration and an emulator, press Run. Or:

```bash
./gradlew :androidApp:assembleDebug            # APK → androidApp/build/outputs/apk/debug/androidApp-debug.apk
./gradlew :androidApp:installDebug             # install on the running emulator/device
# ./gradlew :composeApp:assembleDebug is kept as an alias of :androidApp:assembleDebug
```

The emulator reaches your Mac's `localhost` as `10.0.2.2`, which is the Android default base URL.

### iOS (simulator)

```bash
open iosApp/iosApp.xcodeproj
```

Pick an iPhone simulator and Run. The Xcode build phase calls `./gradlew :composeApp:embedAndSignAppleFrameworkForXcode`
(it falls back to Android Studio's JDK if `JAVA_HOME` isn't set). For a real iPhone set `TEAM_ID` in
`iosApp/Configuration/Config.xcconfig`. Command-line build:

```bash
cd iosApp && xcodebuild -project iosApp.xcodeproj -scheme iosApp -configuration Debug \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

You can also run it from Android Studio / IntelliJ with the Kotlin Multiplatform plugin (iOS run configuration).

### Desktop

```bash
./gradlew :composeApp:run
SUBSCRIBBY_API_URL=http://192.168.1.20:4000/api/v1 ./gradlew :composeApp:run   # other API, no code change
```

## Changing the API base URL

Everything goes through **one place**: [`composeApp/src/commonMain/kotlin/com/subscribby/mobile/AppConfig.kt`](composeApp/src/commonMain/kotlin/com/subscribby/mobile/AppConfig.kt).

| Platform | Default |
| --- | --- |
| Android emulator | `http://10.0.2.2:4000/api/v1` |
| iOS simulator | `http://localhost:4000/api/v1` |
| Desktop | `http://localhost:4000/api/v1` (or `-Dsubscribby.apiUrl=…` / `SUBSCRIBBY_API_URL`) |

Set `AppConfig.API_BASE_URL_OVERRIDE` to force a URL on every platform, e.g. the deployed API (`https://…/api/v1`).

**Real phone on your Wi-Fi:** find your Mac's LAN IP (`ipconfig getifaddr en0`, e.g. `192.168.1.20`), make sure the
API listens on all interfaces, then set `API_BASE_URL_OVERRIDE = "http://192.168.1.20:4000/api/v1"`.

- Android blocks plain HTTP except for the hosts in
  [`androidApp/src/main/res/xml/network_security_config.xml`](androidApp/src/main/res/xml/network_security_config.xml)
  (`10.0.2.2`, `localhost`, `127.0.0.1`). Add your LAN IP there as another `<domain>`. Alternative without code changes:
  `adb reverse tcp:4000 tcp:4000` and use `http://localhost:4000/api/v1`.
- iOS: ATS stays on, with an exception for `localhost` and `NSAllowsLocalNetworking` (LAN IPs / `.local`) in
  [`iosApp/iosApp/Info.plist`](iosApp/iosApp/Info.plist). HTTPS URLs need nothing.

## Tests

```bash
./gradlew :composeApp:jvmTest      # needs the mock API running for the integration + UI tests
```

- `commonTest/FormattingTest` — money (`12814800 → ₹1,28,148.00`, `295000 → ₹2,950.00`, `0 → ₹0.00`), dates, password rules
  (including "no space at the start or end" for new passwords), trimmed email check.
- `jvmTest/ApiIntegrationTest` — logs in as `asha@kite.test`, decodes `/auth/me`, `/portal/summary`, `/portal/subscriptions`,
  every subscription and invoice detail into the Kotlin models; accept flow, INVALID_CREDENTIALS (incl. a staff account),
  EMAIL_TAKEN / field details, forgot-password, stale token → logout.
- `jvmTest/UiFlowTest` — headless Compose test of the real UI: log in → home → open quotation → Accept → confirm →
  status changes → invoices + filter → invoice detail → profile → log out; staff login refused.

Integration/UI tests are **skipped** (not failed) when the mock API isn't reachable; they reset the mock before and after.

## Project structure

```
apps/mobile
├── androidApp/                     Android entry (MainActivity, Application, manifest, network security config)
├── composeApp/                     Shared KMP module (Android library + iOS framework "ComposeApp" + desktop app)
│   └── src
│       ├── commonMain/kotlin/com/subscribby/mobile
│       │   ├── AppConfig.kt        API base URL (the one place to change it)
│       │   ├── data/api/           ApiClient (Ktor, bearer token, envelopes, ApiException with code/details, 401 → logout)
│       │   ├── data/model/         @Serializable DTOs mirroring the API (ported from apps/web/src/lib/api/types.ts)
│       │   ├── data/repo/          SessionStore, AuthRepository, PortalRepository
│       │   ├── data/AppContainer   manual DI container
│       │   ├── platform/           KeyValueStore + expect platform defaults
│       │   ├── ui/                 App + navigation, theme (ink on paper), components, auth/, subscriptions/, invoices/, profile/
│       │   └── util/               Money.kt (paise → ₹ with Indian grouping), Dates.kt ("31 Oct 2026"), Validation, Labels
│       ├── commonMain/composeResources/  fonts (IBM Plex Sans/Mono, Fraunces heading instance) + files/licenses
│       ├── androidMain/            SharedPreferences store, OkHttp engine, 10.0.2.2 default
│       ├── iosMain/                MainViewController(), NSUserDefaults store, Darwin engine
│       ├── jvmMain/                desktop main(), java.util.prefs store, OkHttp engine
│       ├── commonTest/, jvmTest/
├── iosApp/                         Xcode project; SwiftUI hosts the Compose MainViewController
└── gradle/libs.versions.toml       version catalog
```

## Design

The UI follows the shared design reference in [`apps/web/docs/design.md`](../web/docs/design.md): ink #223A5E on warm
paper #F7F5F1, white panels with warm-grey borders and no shadows, IBM Plex Sans with tabular figures for text and money,
IBM Plex Mono only for document numbers, Fraunces for screen titles and the wordmark, status as a coloured dot plus text.
Tokens live in `ui/theme/Theme.kt`; shared pieces (buttons, panels, status, ledger, skeletons) in `ui/components/`.
Text inputs are trimmed before they are checked or sent; passwords are never trimmed, and a new password may not start or
end with a space. Font and icon licences are in `composeResources/files/licenses/`.

Rules the app follows (from the spec): money is integer paise and is only formatted, never calculated; action buttons come
only from the server's `allowedActions`; a 401 `UNAUTHENTICATED` logs the user out; `forgot-password` always shows the same
"If an account exists…" message (the reset itself happens through the web link).

## Versions

Checked against Maven Central, plugins.gradle.org and Google's Maven repo on 2026-10-31.

| Component | Version | Note |
| --- | --- | --- |
| Gradle (wrapper) | 9.7.1 | Kotlin 2.4.21 supports Gradle ≤ 9.7 |
| Kotlin | 2.4.21 | latest stable |
| Android Gradle Plugin | 9.1.1 | newest AGP the installed Android Studio Panda 2 opens (Kotlin 2.4.21 supports up to 9.3.1) |
| Compose Multiplatform | 1.12.2 | latest stable |
| Compose Material3 (JetBrains) | 1.9.0 | latest stable (CMP 1.12.2 itself pairs with 1.12.0-alpha03) |
| material-icons-core | 1.7.3 | |
| Lifecycle (ViewModel/runtime-compose) | 2.11.0 | |
| Navigation Compose | 2.10.0 | type-safe routes |
| Ktor | 3.6.1 | OkHttp (Android, desktop), Darwin (iOS) |
| kotlinx-coroutines | 1.11.0 | |
| kotlinx-serialization | 1.12.0 | |
| activity-compose | 1.13.0 | |
| Android SDK | compileSdk 37, targetSdk 36, minSdk 26 | Compose 1.12 / OkHttp 5.5 require compileSdk 37 |
| iOS deployment target | 16.0 | |

**AGP 9 layout:** with AGP 9 the Kotlin Multiplatform plugin can no longer be combined with `com.android.application`
in one module, so the Android app entry lives in `androidApp/` and `composeApp/` uses the Android-KMP library plugin
(`com.android.kotlin.multiplatform.library`). This is the layout JetBrains now recommends.
