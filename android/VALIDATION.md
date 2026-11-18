# Android validation — 2026-11-05

2026-11-06 packaging update: removed hardcoded development IP from both apps; the user enters the backend URL. Rebuilt both `assembleDebug` targets successfully in 38 seconds. SHA256 values below refer to these final download artifacts. Earlier emulator and lint results remain attributed to their recorded builds; the only subsequent Android source change was the default URL field.

Toolchain: isolated Temurin JDK 17.0.21+9 (downloaded through Adoptium latest17 endpoint), Gradle wrapper 8.11.1, AGP 8.9.1, Kotlin 2.1.20, SDK/build-tools 35. JDK lives under `C:/Users/huy/.gradle/family-care-jdk17`; no global Java configuration changed. The installed Studio JBR 25 failed Kotlin DSL JavaVersion parsing; switching Gradle runtime to JDK17 fixed that root cause.

Commands executed successfully:

```powershell
./gradlew.bat :app:assembleDebug :parent:assembleDebug :app:lintDebug :parent:lintDebug --console=plain
./test-core.ps1
```

Latest combined build/lint: `BUILD SUCCESSFUL in 42s`, 92 tasks. Pure Java safety tests: 16 assertions passed. Red phase: missing PolicyRules / dailyLimit methods caused compilation failures before implementation; green verified afterward. These are focused safety-core checks, not a full Android instrumentation suite.

Lint: zero errors; 7 child warnings and 8 parent warnings. Warnings include target SDK35 versus installed API36, Vietnamese UI literals, WebView JavaScript required by real dashboard, older Android backup attribute compatibility, and ImplicitSamInstance on Intent-based stopService (Intent service matching does not depend on object identity). PACKAGE_USAGE_STATS has one targeted ProtectedPermissions suppression: official UsageStatsManager documentation requires its manifest declaration plus user grant through Settings.ACTION_USAGE_ACCESS_SETTINGS. No blanket baseline or disabling lint errors.

APK SHA256:

- `app/build/outputs/apk/debug/app-debug.apk`: `F193A5A3CD9E0893E0BF884AE3E565A9A8B88BB966989ECFF0DEB521031299B7`
- `parent/build/outputs/apk/debug/parent-debug.apk`: `D43AA97344219CB25AF4C6E775F7D4B30CE9CA743A478125A45909163DB68CA9`

Smoke: existing Pixel_8 API36 AVD launched read-only, no window, no snapshot save; no wipe or persistent AVD modification. Latest APKs both `adb install -r`: Success. Both `am start` activities launch. UI hierarchy dumps saved under ignored `test-build/`. Crash-buffer read after initial launch contained no entries. No physical device attached.

Not verified by this build/smoke: physical OS permissions/OEM background limits, managed enrollment/setPackagesSuspended, emergency calling, real call-log source, GPS accuracy/geofence, authenticated parent WebView session flow. Those need the explicit acceptance scenarios in README on a consenting test device/backend. No generated demo telemetry was submitted.


Additional live-backend smoke completed: native UI consumed a real one-time pairing code at emulator host `http://10.0.2.2:5173`; device model `sdk_gphone64_x86_64`. Backend confirmed 26 installed apps; usage supported, app_block unsupported; calls/location/lock permission_required. Policy v1 received and expected MANAGED_DEVICE_REQUIRED reported for ordinary emulator. DUMPSYS confirmed isForeground=true with persistent notification and stop action. No crash-buffer entries.

First real Settings usage cycle exposed JSON optDouble missing-key NaN during first package ledger insert. Added a regression check for unseen app usage accumulation and explicit zero semantics, rebuilt and reinstalled. Backend then confirmed three actual UsageEvents segments for com.android.settings: 0.5128333333, 0.5353833333, 0.0043333333 minutes. Child UI showed matching local total 1.05255 minutes. These were actual emulator Settings interactions, not injected/mock usage. No location or call events were fabricated.

Read-only emulator was shut down with `adb emu kill` after smoke, stopping its foreground service with the emulator. Direct adb stopservice could not access the intentionally non-exported service; UI/notification stop is the supported route. Root task is responsible for deleting the temporary integration household/account and its telemetry.

Automatic approval review rejected the optional parent WebView URL-entry/navigation smoke command, returning only 'blocked by policy'; parent APK install/launch is verified, but authenticated parent dashboard flow remains unverified here.

Independent-review corrections: stopped sharing now selects policy-only manual refresh. Collectors, event delivery, installed-app/battery payloads and requested location require active explicit sharing. Missing consent defaults to denied. Existing queues remain on device while stopped. Policy and explicit device-admin control can still be refreshed without telemetry. UI displays sharing state and persisted coverage-loss counters/reasons.

Queue liveness: drain valid backlog before collection; expired (>30 days), malformed and future (>5 minutes) records are removed with visible coverage-loss accounting. Capacity exhaustion no longer throws before drain: new dropped records are counted, cursor and local quota ledger progress atomically. HTTP400/413/422 batches split to isolate rejected single records; accepted siblings continue and only explicit receipt IDs are removed. Auth/transient/5xx failures retain data. Delivery bounded to five batches of 20 per flush.

New test-first phase failed because TelemetryRules was absent, then passed 16 pure assertions for consent, retention, future timestamps, capacity, permanent-vs-transient responses and earlier policy/usage behaviors. Latest build/lint commands above passed in 42 seconds with unchanged zero-error lint counts. Latest child APK is 907209 bytes with SHA256 shown above; parent APK unchanged. No new emulator or parent WebView navigation performed for this correction; the live enrollment/usage evidence above applies to the earlier build, while these corrections have pure safety tests, compilation and lint verification only.
