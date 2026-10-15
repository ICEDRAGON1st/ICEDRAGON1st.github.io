# Repository artifact policy

Keep source, durable fixtures, reusable tooling, and reviewed documentation in Git. Keep build
outputs, credentials, reports, and one-off migration helpers out of Git.

## Commit

- Game, hub, desktop, and service-worker source.
- Lockfiles and reviewed configuration needed for reproducible builds.
- Reusable tools such as `tools/release.js` and repository validation scripts.
- Anonymized test fixtures that are required by automated tests.
- Documentation describing releases, storage, rollback, and migrations.

## Do not commit

- `node_modules/`, `desktop/dist/`, installers, archives, Playwright reports, or test results.
- `.env*`, local Discord/Supabase credentials, tokens, account exports, or production backups.
- Timestamped `tools/bump-*.js`, `_tmp-*` scripts, ad hoc repair scripts, or local server config.
- Manual experiment pages such as root `test-*.html`.

Use `npm run release -- --build <id> --note "..."` for cache/build bumps. A reusable migration
must have idempotency checks, tests or verification instructions, and a descriptive name.
Otherwise run it locally, preserve it outside the repository if still needed, and do not stage it.

Existing untracked work is user-owned. Modernization work must not delete, overwrite, stage, or
silently ignore it without explicit review.

## Generated output and releases

Desktop installers are built under ignored `desktop/dist/` and uploaded to a versioned GitHub
release. Record checksums in release notes. Test and coverage reports remain CI artifacts or local
files; they are not source.

Before committing, run `npm run check`. CI rejects known temporary, generated, or sensitive paths
if they become tracked.
