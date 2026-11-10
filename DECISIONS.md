# Decisions

The app uses the official React Native Reusables minimal starter (CLI 0.7.1), NativeWind 4, Expo 56, and React Native 0.85.3. Generated Android projects stay out of Git; the config plugin reproduces the standalone testing variant. The test APK runs without Metro. Android system sans replaces the reference's unbundled Heebo font.

The running service is authoritative when its API document disagrees. Stop enumeration requests 50 items and ends on an empty page or a page with no new IDs; pagination metadata is unreliable. GETs have bounded retries, cancellation, and a shared rate-limit cooldown. Search preserves case because the service's name/street matching is case-sensitive; phone matching requires three digits. Numeric package maxima are normalized; missing or invalid limits use the documented client guard of 99.

Instructions allow 200 UTF-16 units and reject whitespace-only text. The API document says 250, but the mock truncates at 200 and can split an emoji. The client limits text without leaving an incomplete surrogate pair. Clear all applies to one card, matching its placement in the reference.

Draft edits and submission markers share serialized persistence. The app records an attempt before POST. A native one-shot-body policy prevents transport replays; JavaScript never retries POST automatically. A lost or malformed response remains uncertain across process death. Retrying requires a checked duplicate-risk acknowledgment. If that retry is definitively rejected, the earlier uncertain request still may have succeeded, so the warning and edit lock remain. A confirmed result displays the returned route ID and its draft status.

The PM challenge is the distinction between saving instructions and dispatching a route. Finish creates a backend draft; it cannot promise that a driver received anything. Notifications are outside the approved scope, so the result states only what the API confirms.

Delivery is Android-only, English, LTR, portrait. Maps, manual addresses, authentication, camera, notifications, settings, iOS/web delivery, and monetization are excluded. Manual addresses lack an API contract, notifications are a separate workflow, and camera capture adds permission outside the core flow. Focus uses scale/opacity with reduced-motion support; blur is omitted. Photos cannot block editing or creation. Physical keyboard checks exposed footer overlap and stale geometry. Screen-level avoidance, visibility handling, and a small Android height observer correct these cases; details are in verification.

Dependency advisories and upstream template/Gradle warnings remain documented release risks in [verification](docs/ai/verification.md); no forced audit fix, cross-major override, or unreviewed SDK migration was made.
