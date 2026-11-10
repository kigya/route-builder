# Verification

The combined final fix wave is ready for scoped controller review. The whole-branch review found no Critical or confirmed Important defect; its three Minors were corrected. Scoped re-review, exact-final-head CI, merge, main CI and release publication remain separate gates.

## Final candidate

Production source: `1bdfa18657d1fbb604861fd657692fefcd5b0b99`. Later documentation commits do not change the APK's production source. The [artifact manifest](artifact-manifest.json) records byte counts and checksums.

| Asset | SHA-256 |
| --- | --- |
| `route-builder-standalone-debug.apk` | `d1522259e0a22d591eacce20954d7562b8ad4383b7c647e1b7314f5081603e01` |
| `route-builder-demo.mp4` | `49dd89345153de9b5b31001197410ce0de7a8f07199f97c852f24cddcc78a0dc` |

The APK is bundled and debug-signed, min API 26, target API 36, with arm64-v8a, armeabi-v7a, x86, and x86_64 libraries. Physical testing used the authorized Xiaomi 25028PC03G, Android 15, 720×1640 pixels, density 320, logical width 360 dp. No emulator was substituted; API 26 support is a build/manifest claim, not a physical test result.

`npm run check` passed ESLint, strict TypeScript, and **18 suites / 239 tests** after the final code changes. Repeated `npm run prebuild` passed. Final local Gradle MCP `:app:assembleStandaloneDebug :app:lintStandaloneDebug --max-workers=4` passed in 25 seconds, with both task outcomes SUCCESS. Metro was absent during standalone launches. The unchanged mock ran at `http://127.0.0.1:4000`; its SHA-256 remained `d213029e846a69065ff847e71875acbb6024122b1aa829851cf0351ae1a96abb`.

## Physical checks

Acceptance used incremental candidates. Confirmed defects were corrected, rebuilt, and their affected native flows rerun. The final fix APK reran bundled cold launch, existing receipt restoration, reset, the recorded core flow and confirmed receipt restoration without another POST. Keyboard, protocol fault, search-race and broader matrix checks below used the preceding production candidate; the final fix changes only provider handling of historical cached storage errors. Those unchanged paths were not needlessly repeated.

| Scenario | Observed result |
| --- | --- |
| Cold bundled launch with Metro stopped | Passed; API-backed picker loaded. |
| Search case, phone, no match | `almond` had no match, `Almond` and phone digits found the expected record; selection survived no-match results. |
| Overlapping search | Controlled delayed `Al` response arrived as 503 after `Roma` completed. Roma remained visible; the late error did not replace it. Successful obsolete-response behavior is additionally covered by automated tests. |
| Alphabet index | One F tap revealed Fleur Boutique; A/F repeated taps and a scrolled-index Z tap reached the expected records. |
| Selection and quantity | Single blank-stop replacement, multi-select chips/totals, authoritative maximum 8, Cancel without save, and saved quantity changes passed. The video also shows the unknown-maximum app-limit display and quantity 2. |
| Destructive selection changes | Replacement and Multi-stop-to-One-stop dialogs preserved data on Cancel and changed selection only after confirmation. |
| Instructions and validation | Finish targeted the second blank card after the first had text. Per-card Clear all preserved the other card's text. |
| Length and emoji | 201 ASCII units clamped to 200. A real keyboard emoji after 199 ASCII units was rejected whole; after 198 units it reached exactly 200 with an intact `😜` code point. |
| Removal | Explicit and chip removal returned to Stops after the last stop; native header swipe revealed Remove. The video removes the second stop and excludes it from POST. |
| Keyboard and font | Normal typing, three show/hide cycles, expanded Gboard emoji panel, and picker-keyboard navigation passed after corrections. The long name wrapped at 360 dp and font scale 1.3; exact original 1.0 was restored. |
| Draft restoration | Background, Back, and force-stop/relaunch preserved a stable saved quantity 2 and its instructions. |
| Offline GET | Failure showed Retry and retained the selected chip; restoring USB forwarding and Retry recovered. |
| Slow/broken photos | Broken remote images showed fallback. A card was removed while its photo request was pending; a late injected 500 did not restore it or alter surviving text. A further edit during delayed photos persisted. |
| Double tap and successful creation | Two Finish touches produced exactly one observed POST and confirmed `rt_2005`, status `draft`. |
| Lost POST response | A committed 201 was dropped. Exactly one POST remained through warning inspection and force-stop/relaunch. Only checked acknowledgment sent a second attempt about 30 seconds later. |
| Rejected acknowledged retry | Injected 429 left the older uncertainty and edit lock intact, including after another relaunch; fresh acknowledgment was required. |
| Unexpected POST redirects | Final 303 and 307 probes each produced one POST, no follow-up GET, and uncertain UI. A 503 with `Retry-After: 0` also produced one POST. Normal GET 302 redirect still loaded stops. |
| New route and receipt | Acknowledged reset was durable; Cancel retained the draft. The final confirmed `rt_2005` receipt restored after force-stop without another POST. Search query, selected chip, and totals survived navigation round trips. |
| Crash inspection | Selected-app log contained no fatal/uncaught-JS lines; the crash buffer since acceptance contained no crash process header for this package. |

Storage corruption/full-disk and forced unmeasured-row failures are automated coverage. The mock's 24 records fit the native render window after settling, so no physical unmeasured-row claim is made. Reduced-motion behavior is tested automatically; the phone's motion preference was not changed. Only Android 15 and font scale up to 1.3 were exercised physically.

## Original recording and payload

The selected original MP4 is **85.711356 seconds**, H.264, 720×1640, 3,632,219 bytes. Android `screenrecord` was requested for 80 seconds; the measured original duration is within the required 60–90 seconds. It was pulled without editing or transcoding. Its local SHA-256 matches the original device file. Full ffmpeg decoding succeeded; sampled playback frames show the app and keyboard without unrelated opened content.

The continuous take includes selecting stops, saving quantity 2, entering instructions, revealing/removing the other stop by swipe, and creating a route. The displayed ID `rt_2005` matches the proxy-observed 201 response. The sole POST body was:

```json
{"stops":[{"stop_id":"stp_1020","packages":2,"instructions":"Leave at reception"}]}
```

An earlier recording attempt failed its driver because the accessible header is an Android View, not the assumed TextView. That incomplete original is retained locally and is not the release video. The selected video is one unedited take. The previous valid 0199f78 APK/video/checksum candidates are retained under ignored output/release/pre-final-fix/; the release-named files now belong to 1bdfa18.

[Stops](screenshots/stops-final.png) and [Instructions](screenshots/instructions-final.png) are frames from that recording. [Receipt](screenshots/created-final.png), [large font](screenshots/long-name-large-font.png), [keyboard](screenshots/keyboard-large-font.png), and [expanded emoji](screenshots/keyboard-emoji-fixed.png) are native screenshots. They were compared with the supplied HTML's light surfaces, teal actions, white cards, wrapping text, quantity labels, and fixed footer. The app adapts its 390 dp reference to the actual 360 dp phone, uses real records and system sans, and omits the approved camera/notification/blur scope.

## Native corrections

Response-loss testing exposed an automatic Android replay beneath JavaScript: a second POST followed a committed/dropped 201 by 12 ms. The generated `MainApplication` now installs an `OkHttpClientProvider` factory before `loadReactNative`, preserving RN's builder/cache/cookies, disabling connection retries, and marking POST bodies one-shot at the application-interceptor boundary after RN's progress-body wrapping.

Gradle MCP resolves OkHttp 4.9.2. Its [exact follow-up implementation](https://github.com/square/okhttp/blob/parent-4.9.2/okhttp/src/main/kotlin/okhttp3/internal/http/RetryAndFollowUpInterceptor.kt) explains why connection-retry configuration alone is insufficient for `503 Retry-After: 0`. A POST-only response interceptor also removes Location so a redirect cannot hide the original outcome behind a GET. JavaScript classifies unexpected POST 3xx as uncertain; known 400/422/429 rejections retain their intended behavior. GET redirects remain enabled.

Keyboard measurements found two further RN 0.85.3 issues: hide reported screenY 738/height 0 against an 820 dp window, and API 30+ events omitted height changes while the IME stayed visible. The shared screen wrapper disables avoidance on actual hide without remounting fields. A coexisting generated MainActivity global-layout observer supplements only already-visible height changes, follows RN's coordinate/density semantics, checks the active context, and removes itself on destruction. API 26–29 retain RN's legacy path. The installed Reanimated keyboard hook was considered but is [deprecated](https://docs.swmansion.com/react-native-reanimated/docs/device/useAnimatedKeyboard/); no new dependency or framework migration was introduced. Reassess these workarounds when upgrading RN.

## Dependency and toolchain risks

Task 1 and the fresh Task 6 audit recorded **33 affected audit-package entries: 9 low, 19 moderate, 5 high, 0 critical**, including transitive consequences of underlying advisories. They remain open; builds do not fix them. The final whole-branch review accepted these residual risks for this bounded debug evaluation with the following qualifications and compatible upgrade follow-up.

- **Runtime decoder:** locked Expo Router 56.2.22 depends on query-string 7.1.3 / decode-uri-component 0.2.2, affected by GHSA-qr28-fpjm-wq7f (quadratic availability) and GHSA-vcc3-ghjq-m6fr (recursive availability). An isolated malformed-query benchmark against the installed decoder is not an app exploit. Review traced ExpoRoot → explicit linking configuration → forked getStateFromPath → URL/URLSearchParams query parsing, including native cold/warm ingress. The reverse path calls query-string stringify; the configured ingress does not fall back to React Navigation's vulnerable default decoder. No reachable decoder use was found in this app's actual flow. The initial reachability suspicion was rejected; future library/linking changes still need review. Keep the audit and upgrade follow-up rather than claim universal unreachability.
- **Zod/tooling:** Zod 3.25.76 consumers are Expo CLI and the React Hooks lint plugin; this app does not use it to validate route/network data. GHSA-mrhx-c7xc-m3w5 concerns hostile collection validation. Keep development services private and the pinned toolchain for this evaluation; a cross-major forced fix is not justified by the observed exposure.
- **Other tooling:** affected deepmerge/glob/minimatch paths lead to Expo configuration/fingerprinting/Metro, Jest, TypeScript and ESLint. They process trusted repository/configuration/filesystem inputs rather than delivery API payloads. Read-only bounded CI limits evaluation exposure; untrusted authored npm scripts remain executable code. These are accepted build/development risks, not fixed packages or zero supply-chain risk.
- No force audit fix, cross-major override, SDK migration or native-intent change was made. Compatible dependency/toolchain upgrades and renewed reachability checks are follow-up work. This bounded evaluation disposition is not production security clearance.
- Installed Expo 56 ships template metadata labeled 57/RN 0.86. Prebuild warns, while the approved stack compiled and ran. Gradle 9.3.1 retains upstream deprecations incompatible with Gradle 10; no Gradle 10 compatibility is claimed. Native lint passed with retained upstream warnings.
- Optional RNR doctor exits successfully while reporting a missing conventional Theme file. Physical screens verify actual configured styling; the diagnostic is not described as clean.

## Handoff state

The final phone was left on confirmed `rt_2005`. Font scale is restored to 1.0, USB forwarding is restored to device 4000 → host 4000, the temporary fault proxy is stopped, and the unchanged mock remains running. Original APK/video, checksums, build logs, raw local observations, and fault traces are retained outside SDD scratch under ignored `output/release/`.

Independent Task 6 and whole-branch reviews approved the implementation with explicit limits. This final wave corrects all three recorded Minors: stale current storage-error state, the missing surviving-card assertion and the later photo request pair omitted from public evidence. The [photo trace](evidence/photo-lifecycle.jsonl) now orders the 23:33:12.717Z request start, 23:33:13.920517Z completed edit and 23:33:22.727Z response release together. Storage failure/repair is automated provider coverage, not physical full-disk injection.

Controller-owned scoped re-review, final GitHub review/conversation handling, required checks on the exact final head, guarded merge, main CI and publication/download verification remain pending. Release links will be added after publication.
