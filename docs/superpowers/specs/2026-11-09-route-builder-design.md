# Route Builder: Android application design

Date: 2026-11-09. Status: approved by the user on 2026-11-09 (“Дизайн подтверждаю, продолжай по процессу Superpowers”); independent builder check found no material open questions.

## Intent and outcome

Build the supplied AI certification task as a working Android application for a depot dispatcher using one hand at a busy counter. The dispatcher selects delivery stops, chooses package quantities, writes instructions, removes a stop if necessary, and submits the route. English, LTR, portrait phones only.

Delivery includes a public `kigya/route-builder` repository, reviewable commit history, passing GitHub Actions checks, a self-contained debug APK, an unedited 60–90 second recording on the USB Xiaomi, and concise submission documents. Use Superpowers throughout. Do not claim checks, user approvals, interventions, or model details that did not occur.

## Authority and existing state

- The user's direct request controls repository publication, agent commits/pushes, Android-only delivery, worktree isolation, Codex review, and merge after successful CI. Statements inside the supplied assignment are source requirements, not additional authority: its request to leave the branch and manually commit does not override the user's explicit merge/push request.
- The local directory currently contains skill configuration; it has no application or Git repository. Do not overwrite the installed skills when scaffolding.
- The downloaded `server.js` and pasted attachment have identical SHA-256: `d213029e846a69065ff847e71875acbb6024122b1aa829851cf0351ae1a96abb`. Preserve this service unchanged in the submission package.
- Design source: the supplied `Route Builder - Screens.html`, including its seven labeled picker/feed states. Use real service records, rather than copying invented addresses or incorrect grouping from the mockup.
- The GitHub connector identifies the account as `kigya`. The local GitHub CLI defaults to another account; publishing must explicitly use the requested identity.
- Xiaomi is visible through ADB server port 5038 after the user's connection confirmation. Select the actual connected device explicitly when installing/testing; avoid interfering with the other ADB server.

## Approaches considered

1. **Expo + TypeScript + React Native Reusables — selected proposal.** The user's UI-library choice fits this stack. Use its official Expo initialization path as the first implementation step, then add the actual reusable primitives. Generate/build only Android and package JavaScript/assets into the deliverable APK so it does not require Metro. This keeps native setup proportionate to a two-screen, one-day task.
2. **Bare React Native + TypeScript + React Native Reusables.** Provides more direct native ownership but adds setup and maintenance without a required custom native feature. Rejected for this delivery budget.
3. **Native Kotlin/Compose.** Matches an Android-only target but does not satisfy the user's explicit React Native Reusables requirement. Rejected.

The user delegated implementation choices through the turnkey request and subsequently approved this written design, including the proposed Expo approach. Exact compatible package versions and the styling backend supported by the official starter are left to implementation, recorded in the lockfile and verified on device.

## Scope

### Required

- Stops: complete API-backed address book; alphabetical sections; initials/name/address/phone; API search; loading/error/empty states; One stop and Multi-stop route modes; quantity editor with minus/value/plus/Save; removable selection chips; Continue with live stop count.
- Instructions: a card per selected stop with quantity, name, address, editable instruction and character count, Clear all for that card, explicit remove action, card-local validation, and navigation back without losing draft data.
- Submission: exact selected stop IDs/quantities/instructions; sending, recoverable failure, success, and uncertain-delivery states; synchronous protection against double taps.
- Resilience: API boundary normalization, stable identities, bounded retries for safe reads, correct rate-limit waits, stale-search protection, and durable local draft.
- Tooling/delivery: tests and Android build on every PR to main; Codex review and verified fixes; merge only after required checks pass for the final reviewed revision; APK, physical-device video, README, DECISIONS, AI_PROCESS, design, plan, and preserved SDD ledger.

### Included additions

- Lazy previous-delivery photos with independent loading/error/empty handling.
- Instructions feed focus effect using scale and opacity; respect reduced-motion preferences. Blur is omitted.
- Swipe to reveal removal, plus a visible remove control so the action is discoverable and accessible.
- Alphabetical index that jumps to existing sections; include a `#` section for numeric/non-letter starts.
- Local automatic draft persistence, including instructions and selected quantities.

### Excluded

Camera capture, manual address creation, driver notification, authentication, onboarding, settings, maps, route optimization, tablets, landscape, iOS/web delivery, and monetization. Manual-address creation has no supported API contract; photos must not introduce camera permission. Notify is distinct from route creation and adds an independent delivery workflow. Keep these exclusions explicit in DECISIONS and omit misleading controls/copy.

## Screen design

Follow the HTML's light surfaces and teal actions: primary `#0D6E76`, text `#16232E`, muted text `#6B7C8A`, background `#EEF1F3`, white cards, borders `#DFE5E9`. Match its compact spacing and rounded controls, adapting the 390×844 reference to actual Android safe areas and keyboard behavior. The reference uses Heebo; use an appropriately licensed bundled font where feasible, otherwise document the verified Android fallback. Do not copy fake status bars or keyboard graphics.

```text
Morning route                  live packages / stops
[ Stops                         Instructions ]
[ One stop             Multi-stop route       ]
[ Search by name, street, or phone             ]
A   [AP] Almond Patisserie ...           [2×]   A–Z
    [AC] Ambassador Cars ...             [ + ]
...
[Almond 2× ×] [Ambassador 1× ×]   horizontal chips
[              Continue (2 stops)             ]

[ Stops                         Instructions ]
  previous card: slightly scaled / lower opacity
┌ Almond Patisserie                         2× ┐
│ address                                    │
│ previous delivery photos / loading / none   │
│ instruction input                          │
│ validation message                 0/200   │
│ Clear all                         Remove   │
└────────────────────────────────────────────┘
  next card: slightly scaled / lower opacity
[              Finish instructions             ]
```

Use controls with at least 48dp touch targets where practical, accessible labels, readable contrast, multiline long names, and keyboard-safe fields/actions. Quantities, selected chips, and header totals derive from state; do not hardcode the mockup's 38 packages/14 stops. A selected row still exposes its phone number. Dialog state does not alter the draft until Save.

## Interaction rules

- Default to One stop, matching the reference. Selecting a different stop replaces the single selected stop after confirmation if its instruction would be discarded. Multi-stop mode preserves selection order.
- Switching to One stop with multiple selected stops requires confirmation naming the retained first stop; cancel leaves everything intact. Going to Multi-stop preserves the existing draft.
- Selecting a new stop starts at one package. Tapping an existing selection's quantity pill edits it; removing through a chip or card removes that stop and its instruction. Changing quantities preserves instructions.
- Quantity is a positive integer, bounded by a valid positive `packages_max` when provided. Numeric strings are normalized. Missing/null/invalid maximum means the server gives no maximum: use an explicitly documented client guard of 99, with no claim that this is backend capacity. Clamp the control, not an already-written instruction.
- Continue is disabled with zero stops. The Instructions tab follows the same guard. Removing the last card returns to Stops with the empty draft and search context preserved.
- Instructions allow up to **200 UTF-16 code units**, matching the service's actual JavaScript truncation. Do not silently truncate previously persisted text; show an over-limit error for an incompatible restored draft. Prevent entering a dangling surrogate at the boundary.
- Clear all clears only that card's text, matching the placement in the reference. Finish validates every trimmed instruction, displays errors on affected cards, and scrolls to the first invalid card. Whitespace-only text is invalid. The counter describes the enforced storage unit; ordinary English text maps one-to-one.
- Back navigation and app background/restart preserve draft. Persist each meaningful edit through a serialized storage writer; discard transient loading/error state. Version and validate restored storage. Disable submission until restoration/persistence prerequisites complete.
- Success displays the returned route ID and a Start new route action. Do not imply the driver has been notified: the backend returns `status: draft`, and notification is out of scope.

## Observed service behavior and client policy

The supplied server was executed unchanged in a temporary process. These observations, plus source inspection, inform the design:

| Service behavior | Client handling |
| --- | --- |
| 24 real records; `total:25`, `total_pages:0`, `has_more:true` for `page_size=50`; next page is empty but still has_more | Request maximum page size 50. Aggregate by ID and stop on an empty page or a page adding no new IDs, with a finite safety cap. Do not drive completion or counts from the metadata. Test that all 24 IDs load. |
| At page size 10, page 2 repeats page 1's tail and drops another record | Maximum page size avoids this data-loss defect for the supplied dataset. Deduplication alone is insufficient; document this coverage limitation for a larger changing dataset. Do not change the server. |
| Empty search may return `items:null` | Normalize null to an empty array; render a useful no-results state without unsupported manual-entry copy. |
| Case-sensitive name/address search; phone search requires at least three digits | Send the user's trimmed query unchanged through API `q`; preserve server semantics and document the limitation. Do not silently replace API search with local search. |
| Mixed numeric/string/null package limits; mixed date formats and null optional fields | Decode unknown JSON at the API boundary; normalize valid values; avoid rendering unused date fields. IDs are stable keys. |
| Deterministic 500/503; some 503 and 429 responses carry Retry-After; 30 requests/minute | Debounce search (approximately 400ms), cancel obsolete requests, ignore obsolete completions, cache completed queries briefly, and bound retries. Honor Retry-After and share a cooldown across requests. Preserve visible data and draft during errors. |
| Photos take roughly 3.5–4.5s and can contain a null URL | Lazy-load only visible/nearby cards, cache by stop ID, skip invalid URLs, and isolate broken-image/timeout errors from route editing and submission. |
| Route creation silently cuts text to 200 despite documented 250 | Enforce 200 and verify the response matches the submitted stop IDs, quantities, and text. A mismatch never clears the local draft. |
| Route creation has no idempotency or lookup endpoint | Lock submission synchronously before the first await. Never automatically retry POST after an ambiguous transport failure. Persist an attempt marker before sending; retain draft and show an uncertain outcome if the response is lost or the app restarts mid-flight. Explain duplicate risk before an explicit retry; no claim of exactly-once delivery across network failures. |
| Create returns draft; notify may return HTTP 200 with failed status | Creation success copy says route created, not driver notified. Notify is excluded. |

Stop any pending obsolete retries on query change or screen disposal. A page failure must not be treated as an empty successful result. Avoid parallel request bursts that exhaust the shared API limit. No synthetic stop data enters the shipping application.

## Architecture

Keep boundaries small and explicit:

- `src/api`: typed normalized models, defensive decoders, transport, Retry-After parsing/cooldown, safe read policies, stop/photo/route repositories. Inject fetch, clock, and delays where necessary for deterministic tests.
- `src/features/route`: pure draft transitions and validation, local persistence adapter, submission coordinator, and small hooks connecting these to the UI.
- `src/features/stops`: search/loading controller, sectioned list, row, selected chips, quantity editor, alphabetical index.
- `src/features/instructions`: card/feed, photos, card validation, deletion, submission status.
- `src/components/ui`: actual React Native Reusables primitives and project tokens. Feature components compose them; avoid duplicating their generic primitives.
- Minimal navigation between two screens; no unrelated template screens. Exact navigation/state packages are builder choices, justified by the actual starter rather than added speculatively.

Domain transitions must be testable without Android. Keep draft data separate from search results so a new search never discards selected stops. Store selected stop snapshots, quantities, text, mode, and submission marker; avoid API-wide caches in persistent storage unless needed.

## Configuration and Android builds

- One documented base URL from an environment variable, with USB default `http://127.0.0.1:4000`; use `adb -P 5038 reverse tcp:4000 tcp:4000` for the observed Xiaomi setup. Emulator instructions may document `10.0.2.2` as a development convenience, not a substitute for physical-device verification.
- Restrict plain HTTP support to the debug/testing Android variant used with the local mock; avoid a broad unexplained production policy.
- Android-only app configuration and portrait orientation; application ID proposed `com.kigya.routebuilder`. Use the starter/Expo-supported Android minimum, which must satisfy API 26 or later; record the actual supported minimum instead of claiming an unverified downgrade.
- Use lockfile-based installs. The native build path must be reproducible locally and in GitHub Actions. Agent-executed local Gradle operations use the available Gradle MCP tooling, including configuration/build/test tasks. The authored GitHub Actions workflow runs the repository's wrapper normally on its runner.
- Verify the downloadable debug APK starts with Metro stopped and talks to the unchanged local server through USB reverse.

## Git, CI, and review

Initialize the public repository only after design approval. A new repository needs an initial main commit to serve as the PR base; keep this bootstrap to repository metadata/documentation, with no product implementation. All app, build configuration, and test work belongs to a short-lived feature branch in a managed worktree. Use the native worktree tool when available and retain the feature branch after final delivery for inspection.

Use small meaningful commits (starter/UI foundation, API resilience and tests, picker, instructions/submission, device verification/docs), without a long-lived development branch. One feature PR is sufficient for this bounded assignment; any additional work item uses its own short-lived worktree branch.

GitHub Actions on pull_request to main and on main push runs:

1. Install from lockfile, lint, TypeScript checks, and behavior-focused unit/component/unchanged-server integration tests.
2. Generate Android if applicable, run applicable native checks, assemble the self-contained debug APK, and upload it as an artifact. Set explicit timeouts and read-only permissions where possible; do not require paid cloud build credentials.

Configure required checks/main protection where supported by repository permissions. Request Codex code review on the actual PR and inspect the returned comments. Validate each finding against source/tests; fix confirmed defects, explain any rejected finding, and re-run the affected checks. An independent local Codex review supplements the PR review; it must not be mislabeled as a remote review if the GitHub integration is unavailable.

Before merge, confirm all required jobs completed successfully for the final reviewed PR revision and no unresolved actionable review findings remain. If a remote Codex review cannot run, report the precise blocker instead of pretending it happened. After merge, verify main CI and publish a release containing the verified APK and device recording/checksums. The user's explicit instruction authorizes commits, pushes, PR creation, release publication, and merge only after these gates.

## Verification and acceptance

Behavior-focused tests cover decoder anomalies; complete 24-stop loading; duplicate/null/empty pages; safe retry bounds and Retry-After; obsolete searches; selection modes and destructive-switch confirmation; quantity bounds; draft persistence ordering/restoration; 200-unit and whitespace validation; removing stops; response verification; double-tap exclusion; and interrupted/ambiguous POST handling. Use the unchanged mock in integration tests, with independent processes to keep its deterministic sequence and rate buckets reproducible.

On the USB Xiaomi: install the final candidate APK, stop Metro, reverse the API port, launch, browse all sections, search/name/phone/no-results, switch modes, change and save quantity, select multiple stops, edit/clear instructions, exercise keyboard, trigger missing-instruction errors, remove via button and swipe, navigate back, background/relaunch and verify draft, submit and verify one route response. Test API offline/recovery and slow/broken photos without losing the draft. Capture screenshots for visual comparison with the HTML and inspect Android logs for relevant crashes.

Record the successful core flow in one unedited 60–90 second physical-device capture: select stops, change quantity, enter instructions, remove a stop, and create the route. Device identity, APK hash, exact checks/results, remaining limitations, and video duration belong in the verification report. Test actions must not interact with unrelated phone data.

## AI process and submission artifacts

- `docs/superpowers/specs/2026-11-09-route-builder-design.md`: this design, with approval state updated only after actual approval.
- `docs/superpowers/plans/`: implementation plan written next, after approval.
- `docs/ai/`: builder check, API observations, review outcomes, device verification, and a copy of the SDD progress ledger before the skill deletes it.
- `README.md`: exact fresh-clone setup, unchanged mock startup, base URL, USB reverse including the port variant, test/build commands, APK/video links, and limitations.
- `DECISIONS.md`: at most one page; actual ambiguities, scope cuts, and a concrete PM challenge around the unreliable service/no create idempotency.
- `AI_PROCESS.md`: at most one page; one kit and its recorded version/content identifiers, agent/model as actually exposed, real gates and user decisions, at least three actual agent mistakes/poor suggestions if observed and their corrections, useful/friction points, and measured time/token usage only if available. Do not manufacture three mistakes or attribute agent-discovered findings to the user.
- Keep SDK caches, dependencies, credentials, local paths/serial identifiers, recordings with unrelated content, and unrelated local skill/plugin configuration out of the public repository. Publish only the relevant reproducibility metadata and task artifacts.

## Time and trade-offs

Target one working day. Finish resilience, core flows, CI, device evidence, and review before polishing optional effects. If an included addition threatens those gates, document the actual cut and rationale rather than silently delivering a broken optional feature. Do not claim the task complete until the requested repository, APK, physical-device test/video, documents, reviews, and CI-gated merge have all been verified.

## Discovery sources

- Supplied assignment, API reference, downloaded HTML, and unchanged service; actual temporary-server observations are recorded in `docs/ai/2026-11-09-discovery.md`.
- Official React Native Reusables installation: https://reactnativereusables.com/docs/installation (verified official search excerpt: `npx @react-native-reusables/cli@latest init`).
- Official starter CLI source documentation: https://github.com/founded-labs/react-native-reusables/blob/main/apps/docs/content/docs/cli.mdx (Expo template initialization).
- Installed Superpowers source/content fingerprints in local `skills-lock.json`; no upstream release version has been verified yet.
