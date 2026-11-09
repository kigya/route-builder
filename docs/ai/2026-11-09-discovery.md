# Discovery and design review — 2026-11-09

This records observed facts before product implementation. Design approval, repository creation, installation, app testing, CI, and code review are not yet complete.

## Inputs

The supplied downloaded `server.js` and pasted server attachment are byte-identical. SHA-256: `d213029e846a69065ff847e71875acbb6024122b1aa829851cf0351ae1a96abb`.

The HTML bundle was inspected as source and its embedded template extracted temporarily for analysis. Screen labels: Picker default; Picker search inset; Quantity popover; Picker selected; Depth feed at rest; Depth feed keyboard error; Depth feed mid-swipe. No screenshot-based visual verification has occurred yet.

## Service observations

Ran the supplied service unchanged on a temporary free port and terminated the process after the checks. Fresh service request sequence:

1. `/health`: `ok:true`, `requests:1`.
2. `/v1/stops?page_size=50&page=1`: 24 unique IDs, stp_1000 through stp_1023; `total:25`, `total_pages:0`, `has_more:true`.
3. `/v1/stops?page_size=50&page=2`: empty array; same contradictory totals and `has_more:true`.
4. `/v1/stops?q=north&page_size=50`: one result, stp_1016; lowercase matches the lowercase elevator text.
5. `/v1/stops?q=North&page_size=50`: 21 results.
6. `/v1/stops?q=zzzzzzz&page_size=50`: `items:null`, `total:1`, `total_pages:0`, `has_more:false`.

Additional behavior established by source inspection, not yet by integration tests: package limit type anomalies; duplicate/dropped records at page size 10; mixed timestamps; deterministic 500/503; Retry-After/rate limiting; slow photos with null URL; silent 200-unit route instruction truncation; no create idempotency; notify success HTTP code with failed business payload.

## Environment

- Local project directory initially has skills/configuration but no Git repository or application.
- GitHub MCP `get_me` returned `kigya`. CLI has a different active account and a stored kigya account; do not publish under the wrong identity.
- Device discovery initially returned no devices. The user was asked to connect/authorize the Xiaomi and replied “готово”. It then appeared as an authorized USB device through ADB server port 5038. Port 5037 still had no device. No app was installed or tested during discovery.
- Context7 returned monthly quota exceeded. Official React Native Reusables documentation was checked through web search instead. It documents the Expo initialization CLI; package compatibility still requires implementation-time verification.

## Independent builder check

Reviewer: fresh Codex subagent `design_builder_check`, model requested `gpt-6.1-sol`, reasoning `high`, clean context, read-only. Prompt: read the design as a software engineer who must plan implementation without contacting its author; report ranked material unanswered questions, skipping reasonable builder choices.

Result: **“nothing important left”**.

This is a design completeness review, not a product code review or user approval. Preserve that distinction in AI_PROCESS. Next required gate: user approval of the written design, followed by writing-plans.
