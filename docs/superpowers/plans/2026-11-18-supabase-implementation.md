# Supabase shared database implementation plan

Goal: preserve existing parent/device APIs while allowing the same backend to use the supplied Supabase project over HTTPS. No credentials in source or mobile apps; existing D1 development remains available explicitly. Project URL: https://ybrqqcxpzkogurvhbzlx.supabase.co.

User authorized implementation in place. Existing untracked reports remain untouched. No Supabase account connection or secret has been supplied yet, so live database changes and online deployment remain pending; complete local implementation and PostgreSQL verification first.

Architecture: private PostgreSQL schema and a service-role-only transactional RPC. A server-only D1-compatible adapter compiles the finite SQL dialect used by this repository to PostgreSQL and sends bound parameters as a single JSON array, consumed by EXECUTE ... USING. This uses HTTPS supported by the existing Worker runtime and keeps credentials out of clients. Each mutating RPC takes a transaction advisory lock to preserve the single-writer assumptions of the existing SQLite workflow; acceptable for a small project, not a claim of large-scale throughput. RLS and revoked grants keep application tables outside direct client access. No migration of Supabase Auth or new native iOS app in this task.

1. RED: PostgreSQL integration tests for atomic batches, rollback, pairing once, policy CAS, telemetry encryption/dedup, isolation, grants, import/report/delete, and credential revocation. Test HTTP auth/error handling and dialect parameter safety.
2. GREEN: migration in supabase/migrations; SQL compiler and HTTP adapter under lib/server; runtime selection shared by API and scheduled maintenance. Fail closed for incomplete Supabase config. Report provider health only after probing database.
3. Add setup/check commands, ignored local environment and tracked templates, GitHub CI and contribution/API/setup documentation. Existing local D1 data is preserved; switching provider creates a separate store, not an implicit data transfer.
4. Verify existing unit tests plus actual PostgreSQL (PGlite) integration, typecheck, focused lint and web build. Inspect diff and security boundaries; record what remains unverified on live Supabase.

Review focus: SQL injection through content/JSON paths; PostgreSQL JSON numeric and text semantics; all-or-nothing mutation batches; concurrent/replayed pairing and revocation; secret leakage and accidentally exposing the SQL RPC to anon/authenticated roles.

Execution ledger: baseline from earlier audit is 32 passing tests and successful typecheck; whole-project lint has 54 pre-existing errors and four warnings. PGlite added as dev-only dependency for fresh PostgreSQL tests. Use no user data in test fixtures.

Verification ledger: 38 tests now pass, including PostgreSQL role permissions, initial/rerun migration with non-superuser CREATEROLE owner, geofence and the full device workflow. Typecheck and focused lint pass; web build passes. Independent reviewer found ownership transfer requires explicit SET ROLE membership on PostgreSQL 16+; reproduced RED, added owner membership with SET/INHERIT and verified GREEN. Live supabase:check still fails closed because no server secret/account connection has been supplied. No live Supabase data changed. GitHub target supplied by user: https://github.com/hysoul2k/FamilyCare; remote main is an unrelated initial README-only commit, so prepare a new snapshot branch parented to remote main instead of overwriting main or publishing unrelated local history.
