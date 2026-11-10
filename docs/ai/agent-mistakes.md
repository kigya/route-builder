# Agent mistakes and corrections

These are observed implementation/process errors, not hypothetical risks or user discoveries. Commit IDs identify their corrections; the preserved [ledger](superpowers-progress.md) records the task gates.

| Error and evidence | Correction / validation |
| --- | --- |
| The proposed API test assumed an empty query returns no stops. The supplied service returns the address book. Controller preflight caught the wrong expectation before implementation. | Plan correction `58fdb54`: use a no-match query. API tests exercise both browse and no-match behavior. |
| The initial standalone variant linked Debug CMake objects against release React Native libraries. Native builds failed on missing debug symbols. | Configure Release CMake only for `standaloneDebug`; the rebuilt variant passed assembly/lint and cold launch. Foundation implementation `c641b38`. |
| The first CMake correction skipped an already-generated block, repeating the linker failure. | Replace/update the plugin's managed block; transformation regressions verify clean and repeated prebuild behavior, included in `c641b38`. |
| Review found different JavaScript and native Screens versions and a CI setup step requesting the removed Android `tools` package. | `5fa0c3a` pins Screens 4.26.2 consistently and supplies current SDK package IDs. Dependency-resolution regression and local native build passed; foundation CI `42701336646` passed both jobs. |
| Task 3 review reproduced overlapping reset/restore operations replacing a new edit and disabling its save. | `1e22991` gives recovery operations one lock. The deferred-storage regression verifies edits cannot be lost through that overlap. |
| Physical testing at 360 dp showed the keyboard covering Finish. The nested keyboard wrapper measured its frame below the shell while keyboard metrics used screen coordinates. | `54b2f04` wraps the whole screen. Regression guard plus rebuilt-device [before](screenshots/keyboard-validation.png) / [after](screenshots/keyboard-fixed.png) screenshots verify the correction. |
| GitHub Codex review found that a definitive rejection of an acknowledged retry cleared an older uncertain request, falsely permitting ordinary creation again. PR #1 discussion `4519002117`. | `54b2f04` preserves the earlier uncertainty after a retry receives HTTP 400/422/429. Transaction tests verify durable restoration and suppressed normal submit; UI regression verifies locked edits and fresh acknowledgment. First-attempt definitive rejection remains editable. |

Task 6 also corrected a test-harness ordering issue: restoring an Expo accessibility spy left the mocked method returning `undefined` for a later test. Explicit setup restores its promised Boolean before each submission test. This was a test failure, not an observed application crash.

Two further physical defects were corrected in `97ae980`:

- The JavaScript-only no-retry assumption missed Android OkHttp's connection replay. Dropping a committed 201 response produced a second POST 12 ms later. A generated network factory now disables connection retries and marks POST bodies one-shot, also covering 503/307/308 body-preserving follow-ups. After the correction, the response-loss trace contained one POST until explicit acknowledgment 28 seconds later.
- Index jumps targeted a sticky header whose native measured offset was zero. Diagnostic metrics showed F header index 18 at zero and its first row index 19 at 896 dp. Targeting the first row fixed single/repeated and late-section jumps. The same keyboard-boundary defect was also present on Stops and was corrected there.

Temporary diagnostic logs were removed from production source before the final APK build.

Controller review also rejected a misleading physical 307-test expectation: adopting the implementation's definitive rejection as expected behavior would have encoded the defect. The corrected policy keeps unexpected POST redirects uncertain and exposes the original response instead of following it. Tests first reproduced the unsafe state.

Later keyboard checks exposed an 82 dp hidden-IME spacer and missing expanded-panel height updates in RN 0.85.3. Actual hide coordinates and screenshots established both causes. Visibility handling and a guarded activity observer corrected them; no new keyboard library or input remount was introduced.
