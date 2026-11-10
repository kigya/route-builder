# Route Builder

Android app for selecting delivery stops, setting package quantities, writing delivery instructions, and creating a draft route through the supplied API. Built with TypeScript, Expo Router, and [React Native Reusables](https://reactnativereusables.com).

## Run from a fresh clone

Use Node **22.23.2** (`.nvmrc` / `.node-version`) and npm. Native builds require JDK **17**, Android SDK Platform **36**, Build Tools **36.0.0**, NDK **27.1.12297006**, and CMake **3.22.1**. Set `JAVA_HOME` and `ANDROID_HOME` to those installations, and put Android platform-tools on `PATH`.

```sh
git clone https://github.com/kigya/route-builder.git
cd route-builder
# Until PR #1 is merged:
git switch codex/route-builder
npm ci
node mock/server.js 4000
```

Leave the mock running. It needs no dependencies; [mock/API.md](mock/API.md) is the supplied API reference. The service source is unchanged. Its intentional failures and documentation differences are recorded in [discovery](docs/ai/2026-11-09-discovery.md).

In another terminal, build the standalone testing APK:

```sh
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:4000 npm run prebuild
cd android
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:4000 ./gradlew :app:assembleStandaloneDebug :app:lintStandaloneDebug
cd ..
```

`EXPO_PUBLIC_API_BASE_URL` is embedded when JavaScript is bundled. USB testing uses **http://127.0.0.1:4000**. Rebuild after changing it. Agents executing local Gradle tasks must use Gradle MCP; the wrapper above is for human use and CI.

Select the authorized phone from the device list, replacing `YOUR_SERIAL`:

```sh
adb -P 5038 devices -l
adb -P 5038 -s YOUR_SERIAL reverse tcp:4000 tcp:4000
adb -P 5038 -s YOUR_SERIAL install -r android/app/build/outputs/apk/standaloneDebug/app-standaloneDebug.apk
adb -P 5038 -s YOUR_SERIAL shell am start -n com.kigya.routebuilder/.MainActivity
```

Port **5038** is the ADB server used for the supplied Xiaomi. Stop Metro before testing the standalone APK. The APK bundles JavaScript/assets, disables native developer support, and uses the Android development signing key. Only `standaloneDebug` permits plain HTTP. This key and HTTP configuration are for evaluation, not store distribution.

## Use the app

Choose One stop or Multi-stop route, select stops, and tap a quantity pill to edit packages. Quantity changes apply on Save. Continue opens Instructions; each stop needs nonblank instructions of at most **200 UTF-16 units**. Clear all affects its own card. Remove is available directly and through a left swipe on the card header.

The app saves the draft on this device. Finish creates a **draft** route and shows its confirmed ID; it does not notify a driver. If a POST outcome cannot be confirmed, editing stays locked and another attempt needs explicit acknowledgment that it may create a duplicate. Start new route requires confirmation before clearing the local draft.

Search follows the service's case-sensitive name/street behavior. Phone search needs at least three digits. Unknown package maxima use a client guard of **99**; valid server limits take precedence. Photos load independently and show fallbacks on failure.

## Checks and evidence

```sh
npm run check
```

This runs ESLint, strict TypeScript, and Jest. CI jobs `quality` and `android-build` run on pull requests and pushes to `main`; the Android job also uploads a standalone APK.

Supported configuration: Android **8.0 / API 26** or later, English, LTR, portrait phones. Physical acceptance uses a Xiaomi **25028PC03G**, Android **15**, **360 dp** width. Other Android versions have not been tested physically. Android system sans is the documented fallback for the reference's Heebo font.

See [verification](docs/ai/verification.md) for the tested revision, APK checksum, physical results, video status, and unresolved dependency/toolchain risks. Publication links will be added only after the controller completes the final review, CI, merge, and release gates. [Decisions](DECISIONS.md), [AI process](AI_PROCESS.md), and [review history](docs/ai/review.md) explain the implementation and remaining gates.
