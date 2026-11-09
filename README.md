# Route Builder

Android delivery-route app built with TypeScript, Expo Router, and [React Native Reusables](https://reactnativereusables.com). The current foundation has two placeholder screens. Stop selection, persistence, API integration, and submission are added in the subsequent implementation tasks.

## Run locally

Use Node **22.23.2** (`.nvmrc` / `.node-version`) and npm. Android builds need JDK **17**, Android SDK Platform **36**, Build Tools **36.0.0**, and NDK **27.1.12297006**. The app supports Android **8.0 / API 26** and later, portrait phones, English, and LTR layout.

```sh
npm ci
node mock/server.js 4000
```

In another terminal:

```sh
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:4000 npm start
```

The API base URL is configured with `EXPO_PUBLIC_API_BASE_URL`; USB testing uses `http://127.0.0.1:4000`. The unchanged mock has no npm dependencies. Its [API reference](mock/API.md) describes the supplied service. The foundation does not call it yet.

## Check and build

```sh
npm run check
npm run prebuild
cd android
./gradlew :app:assembleStandaloneDebug :app:lintStandaloneDebug
```

`npm run check` runs ESLint, strict TypeScript, and Jest. CI runs the same checks on pull requests to `main` and pushes to `main`, then uploads `android/app/build/outputs/apk/standaloneDebug/app-standaloneDebug.apk`.

`standaloneDebug` inherits release configuration, bundles JavaScript and assets, disables native developer support, and uses the standard Android development signing key. It launches without Metro. Only this testing variant permits HTTP for the local mock; production cleartext traffic is disabled. Generated native projects stay out of Git and are recreated through the Expo config plugin. Agents executing local Gradle tasks must use Gradle MCP; the wrapper command above is for human use and CI.

For the authorized USB phone, select the serial shown by `adb devices`:

```sh
adb -P 5038 devices -l
adb -P 5038 -s YOUR_SERIAL reverse tcp:4000 tcp:4000
adb -P 5038 -s YOUR_SERIAL install -r android/app/build/outputs/apk/standaloneDebug/app-standaloneDebug.apk
adb -P 5038 -s YOUR_SERIAL shell am start -n com.kigya.routebuilder/.MainActivity
```

Port `5038` is the observed ADB server for the supplied Xiaomi. Stop Metro before checking the standalone APK. Do not use the development signing key for a store release.

## Foundation provenance

Initialized with the official `@react-native-reusables/cli@0.7.1 init --template minimal` in a staging directory, then transferred into the feature worktree. Button, Text, Input, Textarea, Dialog, Card, and Tabs come from the official starter/registry. NativeWind 4 remains the starter's supported styling backend. Project imports use `@/*` for `src/*`; `package-lock.json` fixes the installed dependency graph. Android uses the system sans font at this stage; the reference Heebo font has not been bundled.

The [approved design](docs/superpowers/specs/2026-11-09-route-builder-design.md), [implementation plan](docs/superpowers/plans/2026-11-09-route-builder.md), and [discovery record](docs/ai/2026-11-09-discovery.md) define the remaining work. APK/video publication and complete physical-device acceptance belong to the final handoff.
