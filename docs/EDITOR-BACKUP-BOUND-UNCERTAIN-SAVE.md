# Stage 6 — safe interpretation of an uncertain GitHub Save

**7 November 2026 — private, read-only integration only. No live Save or remote write.**

The development editor now has independently tested pieces for: a real browser-generated combined review ZIP; exact original page/resource hashes; an entire 415-resource source candidate; byte-exact tracked-site preservation and rollback; and an actual **temporary, double-restored** Git-history backup bound to the same reviewed local commit.

The next safety gate is **what not to do after an uncertain Save**. A network timeout, acknowledgement or matching observed Git head cannot independently prove a website update succeeded, and a subsequent blind retry could overwrite other work.

The new pure module `editor/tools/review-backup-bound-save-outcome.cjs` connects the previous backup-bound proof to the existing `plan-exact-head-save-guard.cjs` and `plan-uncertain-save-outcome.cjs`. It returns a metadata-only **blocked decision**, never an executable request.

## Decisions exercised

| Observation after a hypothetical Save | Safe decision |
| --- | --- |
| Timeout, disconnected connection or acknowledgement, with no verified Git head | **Unresolved.** Retain draft; manual investigation; no retry |
| Git branch still has the previous commit | **Recheck required.** Do not treat that observation as permission to replay a possibly sent request |
| Git branch now points to another commit | **Stale/conflicting branch.** Refuse to update and preserve both sides |
| Git branch points to the proposed candidate, but changed paths/source have not been authenticated | **Candidate unverified.** Do not claim saved or published |
| Git branch and reported candidate metadata agree | **Authentication still required.** Metadata agreement alone is not proof of authorised Save, source provenance or release readiness |

All results explicitly require an independently authorised **server-enforced expected-old-head condition** at a future real GitHub update boundary. GitHub documents the GraphQL `updateRefs` mutation's `RefUpdate.beforeOid`, `afterOid` and `force` fields, and says updates are atomic. The existing code requires `force:false`. See https://docs.github.com/en/graphql/reference/git .

## Verification

`editor/tests/backup-bound-save-outcome.test.cjs` covers unknown, timeout, rejected, acknowledged, stale head, matching head, malformed identity, forged backup report and forged candidate metadata. The existing **full-history** `editor/qa/backup-bound-browser-review.test.cjs` additionally passes an actual successful private browser-ZIP/restore-tested-bundle report into the new decision checker, so the report and outcome logic are exercised together. Its observations and proposed next Git commit remain deliberately *fictional*. It cannot mutate GitHub.

## Explicit release blockers

- The real source storage layout (415-file transitional overlay versus 418-file full tree) is **not selected**.
- The temporary backup is **deleted after testing** and is not a durable copy retained by CosmicCuddle.
- There is no authenticated administrator Save endpoint, server-side credential gate, owner-approved GitHub commit writer or remote GraphQL ref update test.
- The decision checker cannot establish GitHub authorship, real remote Save success, publishing readiness or permission for an automatic retry.
- An actual owner-approved Save/Restore, full independent backup with restore test, original Admin feature parity, visual/keyboard testing, and controlled release remain required.

The original website, resources, images, scripts, navigation and live `main` remain untouched.
