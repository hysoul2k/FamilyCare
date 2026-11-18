# Manager web, Android and iPhone PWA implementation plan

User has delegated implementation choices and now explicitly targets management only; child clients belong to teammate. Shared web dashboard/API remains the source of truth. Preserve child code and telemetry contracts. Manager includes parent/GV/nanny within granted permissions, plus data import/AI/reporting already present.

Approach: retain responsive web, improve existing Android WebView manager, use Safari Add to Home Screen PWA for iPhone. Rewriting three native dashboards would duplicate policy and AI behavior. Native clients configure the backend root origin, not Supabase URL; keep server keys backend-only. User's live Supabase connection is verified and local backend now uses Supabase; do not migrate/reset user data.

Additional authorized requirement: parent-approved child app removal. Implement server/UI workflow and teammate contract, not covert app persistence. OS protection requires Android device/profile owner or Apple FamilyControls child authorization with guardian approval. Manager app itself does not need device-owner/FamilyControls permissions. Do not promise install-alone blocks uninstall. No reset/enrollment or OS changes on user's phone.

Tasks:
1. Root: add RED API tests for device removal requests, owner-only decisions, unsupported device rejection, expiry, replay, correct-device ACK/results and resulting credential revocation. Run on SQLite then integrate same flow into PostgreSQL test suite.
2. Root: add request/decision/result server workflow with atomic CAS and command guards; heartbeat reports protection status separately from capability. Render manager review UI and explicit pending/applied/unsupported states; no claim device is uninstalled. Keep public API scope intact; add doc for child developer.
3. Android agent (isolated android/parent): validated origin, manager navigation, file selection, session cleanup/retry, pure Java policy tests and parent-only APK build/lint. Child source unchanged.
4. iPhone PWA: management install page, standalone manifest, Apple web app metadata and safe-area viewport/CSS. No native iOS, IPA, signing or macOS CI required by user.
5. Root: manager-only entry/settings and platform install guidance on web, remove confusing child links from management auth/settings while preserving child enrollment/help in device page; don't rebuild child UI.
6. Verify tests/typecheck/focused lint/build, Android result and PWA install contract. Review independent code changes. Publish to existing GitHub review branch/PR with accurate validation. Physical iPhone uses Safari Add to Home Screen; test on a real iPhone with HTTPS, do not claim native IPA.

Interfaces: GET/POST /api/device/removal-requests, POST /api/removal-requests/{id}/decision; command type ALLOW_REMOVAL. Requests are device-scoped and keyed by UUID clientRequestId. Approval is owner-only and creates one expiring command atomically; approved means awaiting device confirmation. Only authenticated matching device can ACK/apply; applied means device reports OS protection released, then credential revoked. Rejection cannot change OS state. Native child must implement enforcement and handle loss of connectivity; currently unchanged child apps must report unknown/unsupported rather than fake protection.

Review focus: unauthorized GV/nanny approval; replay/expiry; wrong-device completion; failed or absent OS support; native origin/child-route navigation and private export handling; iOS code-signing limits; existing child functions remain intact.
