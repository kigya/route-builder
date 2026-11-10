# Review record

Independent task reviews checked specification compliance and code quality after each implementation step. Confirmed Important findings were fixed and re-reviewed before the next dependent task.

| Task | Review outcome / correction |
| --- | --- |
| 1, Android foundation | CI SDK package and JavaScript/native Screens mismatch fixed in `5fa0c3a`; scoped re-review approved. Exact foundation CI `42701336646` passed `quality` and `android-build`. This is not final-head CI. |
| 2, API | Invalid numeric photo hosts were accepted. IPv4 authority validation fixed in `3b86809`, with red/green decoder cases; scoped re-review approved. |
| 3, durable draft | Reset/restore overlap lost edits. Shared recovery lock fixed in `1e22991`; scoped re-review approved. Caller-mutation coverage deferred from Task 2 was supplied by Task 3's real-API/delayed-marker test. |
| 4, Stops | Approved at `6d5cc87`, no Critical/Important findings. Native layout checks assigned to Task 6. Report's Router version typo corrected to installed 56.2.22. |
| 5, Instructions | Approved at `acfcea1`, no Critical/Important findings. Native keyboard/swipe/layout acceptance assigned to Task 6. |
| 6, verified corrections | Physical keyboard overlap and GitHub Codex discussion `4519002117` retry-uncertainty defect corrected in `54b2f04`; full check passes 226 tests. Independent Task 6 and whole-branch reviews remain controller gates. |

Two Minor findings remain explicitly assigned to final review: a cached terminal submission result can resurrect a resolved storage error after Retry saving, and the photo-removal test's name claims surviving text is preserved without asserting a surviving card. Neither is silently treated as resolved. The dependency advisory and toolchain dispositions in [verification](verification.md) also require final review.

Remote reviews of documentation/foundation heads reported no major issues; they did not cover the final application. The later remote P1 finding was accepted and corrected, not dismissed because earlier reviews were clean. The controller must obtain final reviewed-head CI, finish local whole-branch and GitHub review, merge that exact head, verify main CI, and then publish/verify the assets. No merge or release is claimed by this record.

Further Task 6 device findings were corrected in `97ae980`: Android transport replayed a POST after a dropped response; the native policy now disables connection retries and marks POST bodies one-shot. Sticky section headers reported offset zero, so index jumps now target the first row. Search keyboard avoidance now includes the whole shell. Generator/index regressions and native assembly/lint passed; the full check increased to 229 tests. Physical F/A/F and late Z jumps passed. The 24-record mock fits the native render window after settling, so the unmeasured fallback is covered by the focused simulated failure callback, not claimed as a physical unmeasured-row result.

The fresh GitHub Codex review of `97ae980` reported no major issues ([receipt](https://github.com/kigya/route-builder/pull/1#issuecomment-6754199175)). The earlier P1 conversation remains open until independent Task 6 review. CI at the previous `acfcea1` head passed both jobs; current-head and final-documentation-head required checks remain controller gates.

The frozen production source is `0199f78`. It keeps unexpected POST 3xx uncertain, exposes original POST redirects instead of following them, and corrects hidden/expanded keyboard geometry without remounting inputs or adding a dependency. Generator, transport, provider, and keyboard regressions passed; the final full check is 18 suites / 237 tests and native assembly/lint both succeeded. Final physical 303/307, GET redirect, lost-response/rejected-retry restoration, expanded-panel/cycle/font checks, and the original 87.285-second core video passed. The video produced exactly one confirmed draft POST with the removed stop absent. These results prepare the change for independent review; they do not close the controller's review or publication gates.
