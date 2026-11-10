# Verification

The implementation/device portion is ready for controller review. Final whole-branch review, reviewed-head CI, merge, main CI, and release publication remain separate gates.

## Final candidate

Production source: `0199f780f5befa1383795ab1c47b12328973c12b`. Later documentation commits do not change the APK's production source. The [artifact manifest](artifact-manifest.json) records byte counts and checksums.

| Asset | SHA-256 |
| --- | --- |
| `route-builder-standalone-debug.apk` | `b6317104bd6ba07ce35908345250339b7427b9a56d1748e4fac2d3f70fcdc638` |
| `route-builder-demo.mp4` | `5d048be7e62c5ba925bf0d1a89cfdfa8c4b747dfcb645af7b260c861ccdfd4b7` |

The APK is bundled and debug-signed, min API 26, target API 36, with arm64-v8a, armeabi-v7a, x86, and x86_64 libraries. Physical testing used the authorized Xiaomi 25028PC03G, Android 15, 720×1640 pixels, density 320, logical width 360 dp. No emulator was substituted; API 26 support is a build/manifest claim, not a physical test result.

`npm run check` passed ESLint, strict TypeScript, and **18 suites / 237 tests** after the final code changes. Repeated `npm run prebuild` passed. Final local Gradle MCP `:app:assembleStandaloneDebug :app:lintStandaloneDebug --max-workers=4` passed in 28 seconds, with both task outcomes SUCCESS. Metro was absent during standalone launches. The unchanged mock ran at `http://127.0.0.1:4000`; its SHA-256 remained `d213029e846a69065ff847e71875acbb6024122b1aa829851cf0351ae1a96abb`.

## Physical checks

Acceptance used incremental candidates. Confirmed defects were corrected, rebuilt, and their affected native flows rerun. The final APK reran keyboard, redirect/lost-response, receipt restoration, search race, and the recorded core flow. Earlier selection and persistence checks exercised feature logic unchanged by those final corrections.

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
| Double tap and successful creation | Two Finish touches produced exactly one observed POST and confirmed `rt_2004`, status `draft`. |
| Lost POST response | A committed 201 was dropped. Exactly one POST remained through warning inspection and force-stop/relaunch. Only checked acknowledgment sent a second attempt about 30 seconds later. |
| Rejected acknowledged retry | Injected 429 left the older uncertainty and edit lock intact, including after another relaunch; fresh acknowledgment was required. |
| Unexpected POST redirects | Final 303 and 307 probes each produced one POST, no follow-up GET, and uncertain UI. A 503 with `Retry-After: 0` also produced one POST. Normal GET 302 redirect still loaded stops. |
| New route and receipt | Acknowledged reset was durable; Cancel retained the draft. The final confirmed `rt_2004` receipt restored after force-stop without another POST. Search query, selected chip, and totals survived navigation round trips. |
| Crash inspection | Selected-app log contained no fatal/uncaught-JS lines; the crash buffer since acceptance contained no crash process header for this package. |

Storage corruption/full-disk and forced unmeasured-row failures are automated coverage. The mock's 24 records fit the native render window after settling, so no physical unmeasured-row claim is made. Reduced-motion behavior is tested automatically; the phone's motion preference was not changed. Only Android 15 and font scale up to 1.3 were exercised physically.

## Original recording and payload

The selected original MP4 is **87.284956 seconds**, H.264, 720×1640, 2,876,585 bytes. Android `screenrecord` was requested for 80 seconds; the measured original duration is within the required 60–90 seconds. It was pulled without editing or transcoding. Its local SHA-256 matches the original device file. Full ffmpeg decoding succeeded; sampled playback frames show the app and keyboard without unrelated opened content.

The continuous take includes selecting stops, saving quantity 2, entering instructions, revealing/removing the other stop by swipe, and creating a route. The displayed ID `rt_2004` matches the proxy-observed 201 response. The sole POST body was:

```json
{"stops":[{"stop_id":"stp_1020","packages":2,"instructions":"Leave at reception"}]}
```

An earlier recording attempt failed its driver because the accessible header is an Android View, not the assumed TextView. That incomplete original is retained locally and is not the release video. The selected video is one unedited take.

[Stops](screenshots/stops-final.png) and [Instructions](screenshots/instructions-final.png) are frames from that recording. [Receipt](screenshots/created-final.png), [large font](screenshots/long-name-large-font.png), [keyboard](screenshots/keyboard-large-font.png), and [expanded emoji](screenshots/keyboard-emoji-fixed.png) are native screenshots. They were compared with the supplied HTML's light surfaces, teal actions, white cards, wrapping text, quantity labels, and fixed footer. The app adapts its 390 dp reference to the actual 360 dp phone, uses real records and system sans, and omits the approved camera/notification/blur scope.

## Native corrections

Response-loss testing exposed an automatic Android replay beneath JavaScript: a second POST followed a committed/dropped 201 by 12 ms. The generated `MainApplication` now installs an `OkHttpClientProvider` factory before `loadReactNative`, preserving RN's builder/cache/cookies, disabling connection retries, and marking POST bodies one-shot at the application-interceptor boundary after RN's progress-body wrapping.

Gradle MCP resolves OkHttp 4.9.2. Its [exact follow-up implementation](https://github.com/square/okhttp/blob/parent-4.9.2/okhttp/src/main/kotlin/okhttp3/internal/http/RetryAndFollowUpInterceptor.kt) explains why connection-retry configuration alone is insufficient for `503 Retry-After: 0`. A POST-only response interceptor also removes Location so a redirect cannot hide the original outcome behind a GET. JavaScript classifies unexpected POST 3xx as uncertain; known 400/422/429 rejections retain their intended behavior. GET redirects remain enabled.

Keyboard measurements found two further RN 0.85.3 issues: hide reported screenY 738/height 0 against an 820 dp window, and API 30+ events omitted height changes while the IME stayed visible. The shared screen wrapper disables avoidance on actual hide without remounting fields. A coexisting generated MainActivity global-layout observer supplements only already-visible height changes, follows RN's coordinate/density semantics, checks the active context, and removes itself on destruction. API 26–29 retain RN's legacy path. The installed Reanimated keyboard hook was considered but is [deprecated](https://docs.swmansion.com/react-native-reanimated/docs/device/useAnimatedKeyboard/); no new dependency or framework migration was introduced. Reassess these workarounds when upgrading RN.

## Dependency and toolchain risks

Task 1 and the fresh Task 6 audit both recorded **33 advisories: 9 low, 19 moderate, 5 high, 0 critical**. They remain open; builds do not resolve them.

- Runtime: Expo Router 56.2.22, query-string 7.1.3, decode-uri-component 0.2.2. GHSA-qr28-fpjm-wq7f is a high-severity malformed-percent-decoding denial of service; GHSA-vcc3-ghjq-m6fr is related/moderate. A patched decoder is outside query-string's declared range. API input does not use that decoder, but Router/deep-link runtime remains affected.
- Build/development: Expo 56.0.24, Expo CLI 56.1.27, zod 3.25.76. GHSA-mrhx-c7xc-m3w5 is high severity; its patched major is outside the CLI's declared range. Other low/moderate dependency effects are not claimed unreachable.
- No force audit fix, cross-major override, or SDK migration was performed. Final review must explicitly disposition these risks for the evaluation release; this is not production security clearance.
- Installed Expo 56 ships template metadata labeled 57/RN 0.86. Prebuild warns, while the approved stack compiled and ran. Gradle 9.3.1 retains upstream deprecations incompatible with Gradle 10; no Gradle 10 compatibility is claimed. Native lint passed with retained upstream warnings.
- Optional RNR doctor exits successfully while reporting a missing conventional Theme file. Physical screens verify actual configured styling; the diagnostic is not described as clean.

## Handoff state

The final phone was left on confirmed `rt_2004`. Font scale is restored to 1.0, USB forwarding is restored to device 4000 → host 4000, the temporary fault proxy is stopped, and the unchanged mock remains running. Original APK/video, checksums, build logs, raw local observations, and fault traces are retained outside SDD scratch under ignored `output/release/`.

Independent Task 6 review, final local whole-branch review, final GitHub review/conversation resolution, required checks on the exact final head, guarded merge, main CI, and publication/download verification belong to the controller. Release links will be added after publication. Two recorded Minor findings remain for explicit final-review triage: cached storage-error resurrection and the missing surviving-card assertion in the photo-removal unit test; physical coverage does not silently close that test gap.
