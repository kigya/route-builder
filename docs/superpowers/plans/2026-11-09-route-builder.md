# Route Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved two-screen Android Route Builder, public repository, passing CI-gated PR, Codex review, standalone test APK, physical Xiaomi verification/video, and submission documents.

**Architecture:** Expo Router owns two routes; feature components compose actual React Native Reusables primitives. A defensive API adapter and a pure route-draft model feed a small React provider; persistent draft/submission state is independent from ephemeral search and photo requests. No service changes.

**Tech Stack:** TypeScript strict mode, Expo/React Native, React Native Reusables official starter and its supported styling backend, React Context/reducer, AsyncStorage, Jest/Jest Expo, React Native Testing Library, GitHub Actions, Android Gradle wrapper.

**Spec:** `docs/superpowers/specs/2026-11-09-route-builder-design.md` (approved 2026-11-09).

## Global Constraints

- English, LTR, portrait phones only. Android-only delivery; application ID `com.kigya.routebuilder`.
- Use the official React Native Reusables initialization path as the first implementation step; preserve local skills/configuration.
- Instructions allow up to **200 UTF-16 code units**. Whitespace-only text is invalid. Never introduce a dangling surrogate at the boundary.
- Unknown package maximum uses the documented client guard of **99**; valid server maxima are authoritative.
- Preserve the supplied mock unchanged; SHA-256 `d213029e846a69065ff847e71875acbb6024122b1aa829851cf0351ae1a96abb`.
- USB base URL `http://127.0.0.1:4000`, configured through `EXPO_PUBLIC_API_BASE_URL`; observed ADB server port **5038**.
- Maximum page size **50**; terminate enumeration on an empty/no-new-ID page, never trust pagination metadata.
- No automatic POST retries. Persist the attempt marker before sending; keep uncertain outcomes explicit.
- Primary `#0D6E76`, text `#16232E`, muted `#6B7C8A`, background `#EEF1F3`, border `#DFE5E9`, white cards.
- App work belongs to a short-lived branch in a managed worktree; no product code on main before successful required PR jobs and reviewed fixes.
- Self-contained, debug-signed Android test APK must launch with Metro stopped. Plain HTTP belongs to the testing variant.
- No notify, camera, manual addresses, auth, maps, settings, iOS/web delivery, or monetization.
- Agent-executed local Gradle operations go through Gradle MCP. GitHub Actions uses the wrapper normally.
- Preserve the SDD ledger in `docs/ai/` before skill cleanup. Do not fabricate user interventions, model names, checks, or mistakes.
- Apply the user's requested `clarity` and `humanize` skills to `README.md`, `DECISIONS.md`, and `AI_PROCESS.md`. Preserve verified facts, commands, links, qualifications, and the one-page limit for each of the latter two documents.

## Review Focus

1. Search completes out of order while selected stops contain edits: old results cannot replace the current query or discard the draft (Task 4 hook test).
2. App exits after route creation but before a response: restored draft must block casual resubmission and disclose uncertainty (Task 3 coordinator test).
3. Keyboard, long names, large font, and the last card: fields, validation, and Finish remain reachable (Task 5 component checks and Task 6 device checks).
4. Storage fails or completes writes out of order: latest draft survives, sending waits for durable attempt state (Task 3 persistence tests).
5. Slow/broken photos and API cooldown while editing: text remains editable, failures are isolated, removed cards do not trigger new requests (Task 5 photo lifecycle tests).

## File structure and shared contracts

- `app/_layout.tsx`, `app/index.tsx`, `app/instructions.tsx`: provider and the two screens; remove template demo routes.
- `src/components/ui/*`, `src/lib/utils.ts`, `src/theme/*`: imported Reusables primitives, utility, and reference tokens. Configure aliases consistently.
- `src/api/{types,decode,transport,client}.ts`: wire/domain models, normalization, HTTP policy, endpoint methods.
- `src/features/route/{model,validation,persistence,submission,RouteProvider}.ts[x]`: pure transitions, durable draft, submission lock, UI adapter.
- `src/features/stops/{useStopSearch,StopsScreen,StopRow,QuantityDialog,SelectedStops,AlphabetIndex}.ts[x]`.
- `src/features/instructions/{InstructionsScreen,InstructionCard,DeliveryPhotos,SubmissionResult}.tsx`.
- `config-plugins/withAndroidTesting.js`: reproducible standalone test variant/debug signing/variant-only HTTP configuration.
- `mock/{server.js,API.md}`, `tests/{api,route,stops,instructions}/*`, `scripts/*`, `.github/workflows/ci.yml`.
- `README.md`, `DECISIONS.md`, `AI_PROCESS.md`, `docs/ai/*`: verified submission evidence; release hosts large APK/video files.

Shared types: `Stop = { id: string; name: string; address: string; phone: string; packagesMax: number | null }`; `DeliveryPhoto = { id: string; url: string; tag: string }`; `RouteItem = { stop_id: string; packages: number; instructions: string }`; `CreatedRoute = { id: string; status: 'draft'; stops: RouteItem[] }`; `DraftStop = { stop: Stop; packages: number; instructions: string }`.

`RouteDraft = { version: 1; mode: 'single' | 'multi'; stops: DraftStop[]; submission: SubmissionMarker }`. Marker variants: idle; attempting with attempt ID and exact submitted items; uncertain with the same attempt; succeeded with the confirmed route. Marker transitions and draft restoration are validated at the storage boundary. A restored attempting marker becomes uncertain. Keep route creation data immutable while sending.

### Task 1: Runnable Android foundation and PR build pipeline

**Files:** official starter files; `package.json`, lockfile, `.node-version`, `.nvmrc`, TypeScript/Jest/lint config, `app/*`, `src/components/ui/*`, `src/theme/*`, `config-plugins/withAndroidTesting.js`, `mock/*`, `.github/workflows/ci.yml`, `tests/foundation.test.tsx`.

**Interfaces:** consumes approved design and bootstrap repository. Produces working `npm run {start,lint,typecheck,test,check}`, Expo application ID above, two placeholder routes, and Android `standaloneDebug` variant. Subsequent tasks import UI through `@/components/ui/*` mapped to `src/`.

- [ ] **Step 1:** Initialize through official Reusables CLI in a temporary staging directory if necessary to avoid overwriting the existing checkout; transfer only project files into the feature worktree. Inspect the starter's actual dependency requirements, select/install a supported Node runtime (not the current incompatible Node 20), record the exact version, and add Button, Text, Input, Textarea, Dialog, Card, Tabs/selection primitives actually used. Pin dependencies with a lockfile.
- [ ] **Step 2:** Write `foundation.test.tsx`: render the app shell, assert visible Stops and Instructions labels, and assert the empty Continue action is disabled. Run `npm test -- --runInBand tests/foundation.test.tsx`; confirm a behavior assertion fails before adding the shell.
- [ ] **Step 3:** Implement the two-route shell, safe areas, light reference tokens, English LTR behavior, and accessibility labels. Remove all template demo screens. Add unchanged `mock/server.js` and API reference; verify the server hash.
- [ ] **Step 4:** Implement `withAndroidTesting(config): ExpoConfig` so prebuild generates a release-based `standaloneDebug` testing variant, signed with the standard development key, bundling JS/assets, with native dev support off and HTTP enabled only for that variant. Keep production cleartext disabled; do not ship signing secrets. Use the supported Android minimum (at least API 26), documenting the actual floor.
- [ ] **Step 5:** Add PR-to-main and main-push CI jobs named `quality` and `android-build`: pinned Node, lockfile install, lint/typecheck/Jest; Android runner with the supported JDK, prebuild, `:app:assembleStandaloneDebug`, `:app:lintStandaloneDebug`, and uploaded APK. Use timeouts, cache, concurrency cancellation, and read-only permissions. Include a reproducible standalone build command in docs; local Gradle invocation uses MCP.
- [ ] **Step 6:** Run `npm run check`; prebuild Android; build the standalone testing variant through Gradle MCP. Expect checks/build success and an APK containing its JS bundle. Install/launch on Xiaomi with Metro stopped for the foundation smoke check; no claim of full flow completion yet. Commit `chore: initialize Android app and PR checks`; task review gates the next task.

### Task 2: Defensive API client and unchanged-service integration tests

**Files:** `src/api/{types,decode,transport,client}.ts`; `tests/api/{decode,transport,client,integration}.test.ts`; `tests/helpers/mockServer.ts`.

**Interfaces:** exports shared models above and `createApi(options): RouteApi`, with `listStops(q: string, signal?: AbortSignal): Promise<Stop[]>`, `getPhotos(id: string, signal?: AbortSignal): Promise<DeliveryPhoto[]>`, `createRoute(items: RouteItem[]): Promise<CreatedRoute>`. Options include baseURL, fetch implementation, clock, and cancellable sleep for deterministic tests. One provider-shared instance owns the rate-limit cooldown.

- [ ] **Step 1:** Write failing decoder assertions: numeric/string/null package limits normalize to expected positive integer/null values; invalid required ID/name/address are rejected; null list items means empty; invalid photo URLs are omitted; unexpected route payload shape is rejected. Run the targeted API decoder test and confirm failure.
- [ ] **Step 2:** Implement decoders accepting `unknown`, returning the exact shared models. Define typed API errors distinguishing definitive validation/rate-limit failures from uncertain transport/invalid-response outcomes. No unsafe casts from raw JSON.
- [ ] **Step 3:** Write failing transport/client tests: 503 then 200 retries safely after Retry-After; 429 shares its cooldown; 500 exhausts at three total GET attempts; cancellation stops delayed retries; network POST makes exactly one fetch call; empty/no-new-ID pages terminate; duplicate IDs occur once; a page failure never becomes successful empty results. Confirm failures, then implement bounded reads (three attempts, 15s request timeout, 100-page safety guard), `page_size=50`, and shared cooldown. A reached safety cap is a visible error, not silent partial success.
- [ ] **Step 4:** Add integration tests starting isolated unchanged mock processes: expect exactly 24 distinct IDs including stp_1019; a no-match query returns empty; `North` and `north` preserve different server results; valid 200-unit route submission round-trips unchanged; a raw oversized request demonstrates the server's 200-unit truncation without modifying it. Drive the deterministic 500/503 paths and confirm recovery/bounds. Keep each process below its rate-limit budget except the explicit rate-limit test.
- [ ] **Step 5:** Run `npm test -- --runInBand tests/api` and `npm run typecheck`; expect all tests passing. Commit `feat: normalize staging API and handle transient failures`; task review gates the next task.

### Task 3: Durable route draft and safe submission coordinator

**Files:** `src/features/route/{model,validation,persistence,submission,RouteProvider}.ts[x]`; `tests/route/{model,validation,persistence,submission}.test.ts`.

**Interfaces:** consumes `RouteApi` and shared Stop/RouteItem types. Exports `initialDraft`, `draftReducer(state, action): RouteDraft`, `validateDraft(draft): Record<string,string>`, `limitInstruction(text: string): string`, `createDraftStore(storage): DraftStore` (`load`, serialized `save`, `flush`), and `createSubmitter(api, store): Submitter` (`submit`, explicit uncertain retry). `useRouteDraft()` exposes ready/saving/storage-error status, draft, dispatch, validation, submit, result, and reset. Provider restores before enabling actions.

- [ ] **Step 1:** Write failing model/validation tests: single selection replacement; multi-stop insertion order/no duplicates; destructive mode switch requires a UI-confirmed action; quantity limits 1/server-max/99; removing the last stop; Clear all clears one card; quantity changes preserve text; whitespace fails; 200 ASCII units pass and 201 fail; astral characters never leave a dangling surrogate. Run to confirm failures, then implement pure transitions and validation.
- [ ] **Step 2:** Write failing persistence tests with deliberately reversed/delayed writes: the latest text remains stored, storage rejection is surfaced, invalid/version-mismatched drafts are handled explicitly without silently overwriting salvageable content, restored over-limit text is preserved and flagged, and restored attempting becomes uncertain. Implement serialized storage and validated restoration.
- [ ] **Step 3:** Write failing submission tests: two synchronous submits issue one POST; failed attempt-marker persistence issues zero POSTs; pending saves flush before send; blank/over-limit draft issues zero POSTs; network failure preserves all entries and becomes uncertain; uncertain retry requires explicit acknowledgment; response mismatch retains draft; confirmed success persists the route ID and does not POST on relaunch. Implement coordinator; freeze editing during the actual request and do not retry automatically.
- [ ] **Step 4:** Connect provider to app layout using one API instance and AsyncStorage. Do not clear saved text on screen navigation, search, HTTP failures, or success before the user starts a new route.
- [ ] **Step 5:** Run `npm test -- --runInBand tests/route` and `npm run check`; expect passing behavior checks. Commit `feat: persist route drafts and prevent duplicate submissions`; task review gates the next task.

### Task 4: Complete Stops picker

**Files:** `src/features/stops/*`, `app/index.tsx`; `tests/stops/{search,picker,quantity}.test.tsx`.

**Interfaces:** consumes `RouteApi.listStops` and `useRouteDraft()`. Exports `StopsScreen`, `useStopSearch(api, query)` returning data/loading/error/retry, and `groupStops(stops)` for deterministic name sorting and A–Z/# sections. Uses Reusables dialog/input/button primitives from Task 1.

- [ ] **Step 1:** Write failing hook tests: debounce 400ms; send trimmed API q; obsolete request completion ignored even if abort is ineffective; new query cancels retry; successful query reused for 30s; page/search error keeps draft untouched. Confirm failures, then implement query lifecycle and bounded caching.
- [ ] **Step 2:** Write failing picker tests: name/address/phone/initials visible; numeric name in #; multi-select chips and live Continue count; One stop replacement; destructive mode-switch confirmation cancel/confirm; no-results copy has no manual-entry action. Implement sectioned scrollable list, mode controls, index jumps, retry/loading/empty states, and bottom selection area.
- [ ] **Step 3:** Write failing quantity tests: initial value is current quantity; minus cannot cross 1; plus cannot exceed normalized max/99; Cancel preserves original; Save changes quantity without clearing instruction; selected row still shows phone. Implement the quantity dialog and chip removal with accessible labels.
- [ ] **Step 4:** Verify Continue and Instructions tab both reject zero stops and preserve search/draft on round-trip navigation. Run `npm test -- --runInBand tests/stops` and `npm run check`; expect pass. Commit `feat: add searchable stop selection and package editor`; task review gates the next task.

### Task 5: Instructions feed and route creation UI

**Files:** `src/features/instructions/*`, `app/instructions.tsx`; `tests/instructions/{feed,photos,submission}.test.tsx`.

**Interfaces:** consumes provider validation/submission/draft actions and `RouteApi.getPhotos`. Exports `InstructionsScreen`, focused `InstructionCard`, `DeliveryPhotos`, and route result presentation. Visible and near-visible cards share photo results by stop ID; submission never waits for photos.

- [ ] **Step 1:** Write failing feed tests: cards show selected data; typing persists/counts; card Clear all affects only itself; Finish reveals each invalid card's error and targets the first one; 200-unit input boundary handles pasted emoji; removing a card drops it from the payload; last removal returns to Stops. Confirm failures, then implement cards and keyboard-safe validation/navigation.
- [ ] **Step 2:** Write failing photo lifecycle tests: null URLs never render; a slow request does not disable text or Finish; retry failure stays in the photo region; an unmounted/removed card cannot update live UI or schedule a new fetch; unrelated draft text remains unchanged. Implement lazy photos with abort/cache, image load fallback, and independent retry.
- [ ] **Step 3:** Add scale/opacity focus behavior, reduced-motion support, swipe-to-reveal Remove, and an explicit remove button. Use stable IDs and accessible controls; avoid gestures capturing normal scrolling/text editing. Component tests verify explicit removal and reduced-motion configuration; actual gesture/keyboard geometry is verified in Task 6.
- [ ] **Step 4:** Test and implement sending lock UI, definitive error/retry, uncertain outcome warning with deliberate acknowledgment, success with route ID, and Start new route. Copy must say route created, never driver notified. A 200 response with mismatched contents is not success.
- [ ] **Step 5:** Run `npm test -- --runInBand tests/instructions` and `npm run check`; expect pass. Commit `feat: add instruction feed and safe route creation`; task review gates the next task.

### Task 6: Device acceptance, Codex PR review, and release handoff

**Files:** `README.md`, `DECISIONS.md`, `AI_PROCESS.md`, `docs/ai/{verification,review,agent-mistakes,superpowers-progress}.md`; build/CI fixes only when verified defects require them. APK/video are release assets; relevant screenshots may live under `docs/ai/screenshots/`.

**Interfaces:** consumes complete Tasks 1–5 and the SDD task-review evidence. Produces verified PR head, local Codex whole-branch review, GitHub Codex review result, passing required checks, merged main, and release artifacts. Controller owns PR/review/merge/publication; a task implementer may prepare evidence and fix defects but must not bypass those gates.

- [ ] **Step 1:** Run complete `npm run check`, prebuild and build/lint standaloneDebug via Gradle MCP. Install that APK on the explicitly selected Xiaomi through ADB 5038, reverse port 4000, stop Metro, and launch against unchanged mock. Record APK SHA-256 and actual supported OS/minimum; never substitute an emulator without disclosure.
- [ ] **Step 2:** Exercise all required picker/instruction/submission behavior plus keyboard, long name, increased font, back/background/force-stop restoration, empty instructions, search races, swipe/button deletion, API offline/recovery, slow/broken photos, and double taps. Compare screenshots against the supplied HTML. Verify successful payload through the displayed confirmed route result/known mock responses; inspect relevant logcat crash output. Correct confirmed defects with regression tests and reviewed commits.
- [ ] **Step 3:** Record one unedited 60–90 second physical-device core-flow video: select stops, quantity, instructions, remove one, create route. Verify duration and playback; keep unrelated notifications/content out. Keep the final APK matched to the tested source revision.
- [ ] **Step 4:** Assemble factual drafts of README, DECISIONS, and AI_PROCESS from the verified implementation and evidence. README must contain exact fresh-clone instructions and base URL; DECISIONS and AI_PROCESS must each fit one page. Populate at least three real agent mistakes/corrections from the ledger/reviews if observed; never manufacture them or claim user discoveries. Record kit source/content fingerprints, actual exposed model information, approximate elapsed time and token limits honestly. Link actual APK/video assets after release exists. Before committing these three documents, read and apply the installed `clarity` skill in rewrite mode (`references/edit.md` and documentation guidance in `references/medium.md`), then `humanize` with the matching language rules in `references/rules.md`. Preserve code blocks, exact commands, URLs, figures, qualifiers, and attribution. Compare the finished prose against the factual drafts and review evidence; remove stock phrasing without adding personal experience or unsupported claims. Include this documentation check in the task report.
- [ ] **Step 5:** Copy the SDD progress ledger into `docs/ai/superpowers-progress.md` before cleanup. Commit `docs: record physical-device verification and AI process`. Controller runs the required task review and final whole-branch Codex review, routing confirmed fixes through the implementer and scoped re-review.
- [ ] **Step 6:** Controller pushes the feature branch, opens/updates PR, requests GitHub Codex review, validates comments, fixes confirmed issues, and sets required `quality`/`android-build` checks where permissions allow. Confirm both jobs succeeded for the final reviewed head and no actionable review findings remain. Use merge guarded by that exact head SHA. Retain feature branch/worktree history for inspection.
- [ ] **Step 7:** After main CI succeeds, publish a GitHub release with the verified standalone debug-signed APK, unedited video, and checksums. Verify public download links, repository visibility, merged PR state, CI status, and release assets. Final response links repository, PR, release, and the verified testing result; disclose any actual limitation instead of claiming full completion.

## Plan self-review

Coverage: Task 1 owns platform/UI initialization/CI/APK; Task 2 owns real-service anomalies; Task 3 owns draft/data safety; Task 4 owns Stops; Task 5 owns Instructions/photos/focus/swipe; Task 6 owns physical evidence/review/merge/submission. All five Review Focus cases have explicit owning tests/checks. Shared model and endpoint names are consistent across tasks. Optional exclusions match the approved design. Native version floors and official starter compatibility are verified choices, not guessed pinned versions. SDD execution method comes from the requested Superpowers sequence; no additional method choice is needed.

User amendment, 2026-11-09: use clarity and humanize for README, DECISIONS, and AI_PROCESS. Incorporated into Global Constraints and Task 6; the implementation scope is unchanged.

Status: approved by the user on 2026-11-09 (“План подтверждаю, приступай к реализации далее по процессу Superpowers”); execution in progress through subagent-driven-development.
