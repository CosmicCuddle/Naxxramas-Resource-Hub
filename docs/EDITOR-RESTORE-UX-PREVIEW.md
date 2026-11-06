# Local editor — Save / Restore conflict preview (design trial)

**Status: PROPOSED, TEST ONLY.** Created on the protected development branch for [draft PR #56](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/pull/56). **Not an actual editor Save/Restore implementation and not approved for publication.**

The website's original `index.html`, 31 MB `site-content.html`, 414 resources, independent 29-item collection, custom scripts, site navigation and administrator controls are untouched. Nothing is merged or deployed.

## Open the demonstration

Inside a disposable/extracted copy of the development branch, open `editor/restore-preflight-preview.html` in Edge or Chrome. This file deliberately has no input for your real website, no draft-import button, no Save button and no network access. The four examples use **fictional checksums and fictional edits**, not original resource names or content. It works without an account or server connection.

The examples illustrate these four situations:

| Example | Displayed outcome | Next step in a future approved editor |
| --- | --- | --- |
| Draft matches the source revision and expected resource checksums | **Version metadata matches**; no save is performed | Continue to independent, complete-source verification and an explicit review of changes |
| Draft is from an older revision (even when editing an unrelated resource) | **Draft is from an older version**; blocked | Keep the draft intact; reopen the current website source, then review/reapply intended changes manually |
| Draft's expected resource checksum conflicts with the claimed current revision | **Resource version conflict**; blocked | Investigate source integrity, do not overwrite or automatically merge |
| Draft is malformed, missing required fields or contains unsafe values | **Draft cannot be reviewed**; blocked | Keep current edits untouched and obtain a valid draft |

**No automatic merging** is offered, even when a stale draft targets different resources from those recently edited. This conservative rule prevents silent overwrites.

## What the prototype really checks

- `editor/restore-preflight-core.js` is a **pure, read-only metadata assessor**. It validates a complete 414-entry test manifest, resource positions/paths/checksums, draft envelope fields, text limits and source revision/hash agreement. It never reads, writes or evaluates website HTML and never exposes draft content in its response.
- The fictional preview uses ordinary buttons, a polite screen-reader status region, strong keyboard focus styles and a responsive layout. All user-visible dynamic values are assigned with `textContent` rather than HTML injection.
- The preview has a restrictive local Content Security Policy that forbids remote connections, forms, embedded frames and images.
- `editor/tests/restore-preflight.test.cjs` tests malformed drafts, stale different-resource changes, mismatched hashes, safe text, original resource paths, forbidden UI actions and result metadata.
- The existing isolated Chrome complete-site smoke now additionally visits this standalone preview at desktop **1440px** and mobile **390px**, activates all four examples and checks their visible decisions, responsive overflow, screen-reader status and absence of input/save/publish actions. Browser activity is loopback-only and test copies are deleted.

## New standalone local JSON file check — read-only (6 November 2026)

An additional **private trial**, `editor/restore-file-check.html`, can now open **two JSON files chosen locally by the owner**, without running original website scripts or contacting a server. It **does not modify** the fictional demo at `editor/restore-preflight-preview.html` or the existing working editor at `editor/index.html`.

1. In a **disposable copy of the development branch**, open `editor/restore-file-check.html` in Edge or Chrome.
2. Choose an **experimental versioned resource manifest** JSON file (maximum **256 KiB**) and an **experimental versioned resource draft** JSON file (maximum **16 MiB**).
3. Press **Check versions (read only)**. The page reads the two files locally and displays only the classification (`review-only`, `stale`, `record-conflict`, `invalid-draft`, `invalid-source`, size/read failure), revision and aggregate resource counts.
4. Press **Clear selected files** to clear both selections and the result.

**No file is uploaded, rewritten, merged, exported or published.** Resource title/content strings are never displayed or logged. A match is **metadata only**, not a verified safe update. The manifest/draft checksums are unauthenticated, and the full 414 actual fragment files and original compatibility HTML are **not** loaded or independently rehashed. The page must never be used to approve a release.

**Compatibility warning:** This tool accepts only the **test-only** `naxx-private-versioned-resource-overlay-v1` and `naxx-private-versioned-resource-draft-v1` JSON contracts from the private two-session rehearsal. The current editor's `naxx-local-resource-draft-v2`, previous v1 title drafts, and page/navigation v3 drafts are **not** compatible. They are safely rejected, never rewritten or silently upgraded.

Files are read only on explicit user interaction. There is no file or browser storage persistence, no remote requests, no forms, no deployment action, and no automatic merge. Each file is size-checked before being read. Changes to the file selection clear any old result. The standalone screen is keyboard accessible with labels, controls, a polite status region and a restrictive local Content Security Policy.

The new pure `editor/restore-file-check-core.js` is covered by independent malformed-input, size-limit, stale/conflict, no-write and actual two-session manifest-format tests. The isolated browser workflow also selects **synthetic** JSON files via Chrome's local File API at **1440px and 390px** and checks the rendered outcomes, private-text non-disclosure and absence of network/form/publish actions. It never selects or exports real user content.

## Independent physical source-file verification (test-only)

To move beyond merely trusting JSON metadata, the protected branch now includes `editor/tools/verify-physical-resource-sources.cjs` and `editor/tests/verify-physical-resource-sources.test.cjs`.

This **read-only Node.js tool** checks a **disposable local source folder** from the existing two-session rehearsal. It is not yet connected to the standalone browser JSON picker or to the working editor.

Before considering a versioned draft, it:

- Verifies the **exact original 30,976,969-byte website HTML checksum** and its known 414-record structure. The original remains the single source of the non-resource HTML, scripts, media and separators.
- Refuses missing/extra paths, symlinks, unsafe file types, excessive file sizes and malformed manifests.
- Reads **all 414 individual resource fragments** from disk and checks each file's actual SHA-256 against the verified manifest. No record is silently skipped, swapped or reordered.
- Rebuilds the **complete HTML in memory**, checks the exact length and final SHA-256 against the manifest, and ensures revision zero matches the original complete website exactly.
- Only **after** all those checks, compares the draft's expected source revision and edited-fragment checksums. Any stale or conflicting draft remains blocked.
- Prints **aggregate test results only**: no content values, resource filenames, individual hashes, credentials or screenshots. It writes no files and cannot apply, merge, publish or deploy anything.

Automated tests deliberately corrupt resource fragments, swap records, remove/add files, forge the manifest, supply the wrong website baseline and create a symlink, verifying that every case fails closed. They also exercise two separately saved revisions and the conservative stale-draft rule.

**Scope boundary:** This is **not** a cryptographic signature or independent trust anchor for arbitrary user-provided manifests. It proves that local files match their stated hashes, not that the claimed newer revision was authorised by the owner. It is a local test-only physical source checker, not a persistent browser save/recovery flow.

The browser page `editor/restore-file-check.html` **remains metadata-only** and should not claim to have verified actual files. A user-friendly folder picker and complete browser-side source validation would require another separately reviewed development change. No change to the current working editor is approved.

## Important limitations

A metadata match **does not prove a draft is trustworthy or safe to save**. The current manifest is an unapproved test structure; its checksums are not authenticated, and this page does **not** reconstruct or verify the actual 31 MB website. **Only a later independently verified source-bound builder** could authorize even a temporary file update, and a real publication needs explicit owner approval.

The installed `editor/index.html` remains unchanged. Its real Save/Load buttons still use the original page/navigation v3 and resource v2 draft formats bound to the original website checksum. These formats are **not automatically compatible** with the experimental versioned draft envelope.

Before integrating any actual version-aware Save/Restore workflow: decide and approve the canonical resource-file layout, design safe upgrade of old draft formats, establish durable cross-process conflict detection/crash recovery, independently verify full HTML reconstruction, test real administrator editing and keyboard flow, restore a retained complete backup, and obtain CosmicCuddle's approval for any merge or deployment.
