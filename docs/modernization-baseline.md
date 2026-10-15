# Modernization baseline

This document is the safety gate for the modernization roadmap. It records what must remain
true while security, loading, storage, and game code are migrated.

## Existing work is protected

The roadmap began with a large pre-existing working tree. Modernization commits must stage
only their own files. They must not discard, reformat, or silently absorb unrelated modified
game files. Before a roadmap ticket touches an already-modified file, review its current diff
and preserve the existing behavior in a separate commit or explicit compatibility change.

## Required checks

Run these before publishing a roadmap ticket:

```text
npm run check
npm run format:check
npm test
npm run test:smoke
```

The browser smoke tests deliberately block external requests. They must never write test
players, presence, scores, chat, or admin state to production services.

## Persisted state contract

`storage-manifest.json` inventories statically discoverable local-storage keys and dynamic key
patterns. Generate it with `npm run inventory:storage`, then review every changed entry:

- `account`: follows a player between devices and accounts.
- `device`: remains a preference or cache for one browser/device.
- `transient-device`: may be discarded without losing durable progress.
- `max`: merge monotonically, such as a high score.
- `domain`: requires game-specific merge/migration logic.
- `latest`: newest valid value wins.

Unresolved calls are counted per file so a new dynamic storage access cannot enter unnoticed.
The count is a guardrail, not proof that those calls are correctly classified.

## Release and rollback contract

Until isolated staging and automated releases exist:

1. Keep each ticket independently revertible.
2. Do not combine database policy changes, save migrations, mass deletion, and gameplay edits.
3. Tag or otherwise record the commit deployed to production.
4. Preserve N and N-1 client/schema compatibility during migrations.
5. Export affected remote data before any destructive migration.
6. Verify the deployed hub and representative games after pushing.

## Initial performance evidence

- The hub currently loads roughly 45 scripts and about 3.2 MB of uncompressed JavaScript.
- A production audit observed a 7.85-second hub load because scripts are loaded serially.
- Paper Claim has per-frame full-grid territory scans and full-layer blur/compositing.
- Game pages currently use inconsistent service-worker/build versions.

## Current measurements after the first performance slices

- Hub scripts load in dependency-aware parallel phases and use one stable service-worker URL.
- The games-grid critical path is capped by CI at 12 scripts and under 1 MB of decoded
  JavaScript; social, chat/calls, leaderboard, coins, Help, admin, and Fishing helpers load
  after the shell becomes interactive.
- The games-grid route loads no Guessword dictionaries. Opening Guessword loads one active
  language/length pack (168,142 bytes for English 5-letter) instead of all 18 word/dictionary
  files (2,264,199 bytes), saving the full 2,264,199 uncompressed bytes on the hub route. Other
  packs load on demand and are retained for the page session.
- The isolated local hub smoke test reaches its interactive shell in about 2–3 seconds.
- The headless Paper Claim smoke test sustains at least 25 FPS while recording video. This is a
  CI regression guard, not proof of the roadmap's 55 FPS real-device target.

Future performance tickets must continue comparing cold/warm load, long-task, FPS,
request-rate, and payload measurements rather than relying only on visual impressions.
