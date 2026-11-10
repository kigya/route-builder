# Review record

Independent task reviews checked specification compliance and code quality after each implementation step. Confirmed Important findings were fixed and re-reviewed before the next dependent task.

| Task | Review outcome / correction |
| --- | --- |
| 1, Android foundation | CI SDK package and JavaScript/native Screens mismatch fixed in `5fa0c3a`; scoped re-review approved. Exact foundation CI `42701336646` passed `quality` and `android-build`. This is not final-head CI. |
| 2, API | Invalid numeric photo hosts were accepted. IPv4 authority validation fixed in `3b86809`, with red/green decoder cases; scoped re-review approved. |
| 3, durable draft | Reset/restore overlap lost edits. Shared recovery lock fixed in `1e22991`; scoped re-review approved. Caller-mutation coverage deferred from Task 2 was supplied by Task 3's real-API/delayed-marker test. |
| 4, Stops | Approved at `6d5cc87`, no Critical/Important findings. Native layout checks assigned to Task 6. Report's Router version typo corrected to installed 56.2.22. |
| 5, Instructions | Approved at `acfcea1`, no Critical/Important findings. Native keyboard/swipe/layout acceptance assigned to Task 6. |
| 6, verified corrections | Physical keyboard overlap and GitHub Codex discussion `4519002117` retry-uncertainty defect corrected in `54b2f04`; full check passes 226 tests. Independent Task 6 and whole-branch reviews were completed later; see the final review below. |

The final whole-branch review found no Critical or confirmed Important defect. It accepted the implementation subject to controller gates and recorded three Minors: current storage-error resurrection, insufficient surviving-card assertions, and incomplete public timing evidence. The combined final fix wave addresses these below.

Remote reviews of documentation/foundation heads reported no major issues; they did not cover the final application. The later remote P1 finding was accepted and corrected, not dismissed because earlier reviews were clean. The controller must obtain final reviewed-head CI, finish scoped final-wave and GitHub review, merge that exact head, verify main CI, and then publish/verify the assets. No merge or release is claimed by this record.

Further Task 6 device findings were corrected in `97ae980`: Android transport replayed a POST after a dropped response; the native policy now disables connection retries and marks POST bodies one-shot. Sticky section headers reported offset zero, so index jumps now target the first row. Search keyboard avoidance now includes the whole shell. Generator/index regressions and native assembly/lint passed; the full check increased to 229 tests. Physical F/A/F and late Z jumps passed. The 24-record mock fits the native render window after settling, so the unmeasured fallback is covered by the focused simulated failure callback, not claimed as a physical unmeasured-row result.

The fresh GitHub Codex review of `97ae980` reported no major issues ([receipt](https://github.com/kigya/route-builder/pull/1#issuecomment-6754199175)). At that review head, the earlier P1 conversation remained open pending independent Task 6 review. CI at the previous `acfcea1` head passed both jobs; current-head and final-documentation-head required checks remain controller gates.

The Task 6 production source before the final fix wave was `0199f78`. It keeps unexpected POST 3xx uncertain, exposes original POST redirects instead of following them, and corrects hidden/expanded keyboard geometry without remounting inputs or adding a dependency. Generator, transport, provider, and keyboard regressions passed; its full check was 18 suites / 237 tests and native assembly/lint both succeeded. Final physical 303/307, GET redirect, lost-response/rejected-retry restoration, expanded-panel/cycle/font checks, and the original 87.285-second core video passed. The video produced exactly one confirmed draft POST with the removed stop absent. These results were supplied to the independent Task 6 and whole-branch reviews; they did not close controller publication gates.

## Final whole-branch review and combined fix wave

The independent review covered base `ad585af` through `238e083`, including all handwritten application/API/provider/UI sources, native generation, tests, service boundaries, configuration and evidence. No Critical or Important defect was confirmed. The installed vulnerable decoder benchmark was initially suspicious, but tracing rejected the proposed app ingress path: Expo Router supplies its forked `getStateFromPath`, whose query parser uses URL/URLSearchParams. The inspected query-string reverse path uses stringify. No reachable vulnerable decoder use was found in this app's actual flow and no app exploit was established. This is not a universal proof for future library use.

The review accepted the 33 affected audit-package entries for this bounded evaluation, with exposure qualifications and compatible toolchain upgrades as follow-up. Zod consumers are CLI/lint tooling; deepmerge/glob/minimatch paths lead to build/development tooling. Trusted checkout inputs, private development services and bounded read-only CI limit that exposure. Advisory records, Expo template metadata, Gradle deprecations and the RNR Theme diagnostic remain open maintenance risks; a passing build is not security clearance. See [verification](verification.md) for the disposition.

Production fix `1bdfa18` preserves current provider storage durability when a suppressed submit returns a historical result. RED tests reproduced both a repaired error coming back and an older error replacing a new failure; GREEN tests verify current state and exactly one POST. The photo-removal test now removes one of two selected stops during a pending request and checks the surviving field plus persisted draft after rejection. The public photo trace now includes the actual later 23:33 request start/edit/release sequence in chronological order. All three are Minor corrections; no extra POST or lost data was demonstrated by the cached-error issue.

The final fix check passed lint, strict TypeScript and 18 suites / 239 tests; local Gradle MCP assemble/lint both succeeded. Fresh source-bound device/core/video evidence is recorded in [verification](verification.md). Controller-owned scoped re-review of this wave, final GitHub review/conversation handling, exact-final-head required checks, guarded merge, main CI and release/download verification remain pending. None is inferred from this worker handoff.

## Final local gate

The independent whole-branch review approved source readiness with no confirmed Critical/Important defect. Its three Minors were corrected in `1bdfa18` / `4be1a6b`. The [scoped re-review](final-fix-review.md) confirms all three addressed and no new breakage. The prior GitHub P1 discussion was resolved after source, regression and physical verification. Exact-final-head remote review/required CI and the merge/main-CI/release steps remain controller gates at this source snapshot. Final repository-operation evidence is published with the release.
