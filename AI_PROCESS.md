# AI process

The user supplied the assignment, HTML reference, unchanged mock, Android-only scope, React Native Reusables requirement, repository/testing requirements, and review-gated delivery conditions. They approved the written design and implementation plan, then requested clarity and humanize for these documents. Expo, resilience policies, the 99-package fallback, and uncertain-POST handling were agent proposals approved with that design.

Superpowers guided discovery, design approval, planning, tests-first implementation, and independent task reviews. One implementation worker ran at a time. Reviews caught data-loss and native-resolution defects. Handoffs and ledger preservation added coordination overhead; component tests still needed physical measurements for keyboard geometry. The controller owns the whole-branch review, GitHub review, final CI, merge, and release. The [progress ledger](docs/ai/superpowers-progress.md) and [review record](docs/ai/review.md) distinguish completed checks from those gates.

The kit source is [obra/superpowers](https://github.com/obra/superpowers). Its installed metadata has no semantic release version; [kit-provenance.json](docs/ai/kit-provenance.json) records the actual instruction fingerprints. The exposed Codex CLI version was **0.167.0-alpha.3.2**. Requested worker/reviewer models were **gpt-6.1-sol** and **gpt-6-astra** with high reasoning; the controller's exact preset was not exposed. Token usage and a total token budget were not exposed. Work began with the approved-plan commit on November 9 and continued into November 10, about three and a half hours through the physical handoff, including builds and waits, not measured human effort.

Real corrections included:

- The initial standalone variant mixed Debug CMake objects with release React Native libraries. Linker failures led to a variant-local Release CMake setting.
- The first correction skipped an existing generated block. A repeated failure led to replaceable managed blocks and a regression test.
- Review found different JavaScript/native Screens versions. Pinning and a dependency-resolution regression aligned both at 4.26.2.
- Review reproduced overlapping reset/restore operations losing edits. A shared recovery lock fixed that race.
- Physical tests found keyboard overlap, a hidden-IME spacer, and missing expanded-panel updates. Screen-level visibility and native height handling restored access.
- Physical fault injection exposed an automatic Android POST replay beneath JavaScript. A native one-shot-body policy now prevents that replay.
- GitHub Codex review found that a rejected retry erased an earlier uncertain POST. New transaction/UI regressions drove preservation of that uncertainty across restore.

These were agent implementation/review discoveries, not user-reported defects. [Mistake details](docs/ai/agent-mistakes.md) preserve evidence and corrections. Documentation received a factual draft, the clarity rewrite/documentation pass, then two English humanize passes. Commands, limits, qualifications, and attribution were checked against source and evidence afterward.
