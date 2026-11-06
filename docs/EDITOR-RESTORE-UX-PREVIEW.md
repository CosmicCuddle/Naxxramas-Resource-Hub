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

## Important limitations

A metadata match **does not prove a draft is trustworthy or safe to save**. The current manifest is an unapproved test structure; its checksums are not authenticated, and this page does **not** reconstruct or verify the actual 31 MB website. **Only a later independently verified source-bound builder** could authorize even a temporary file update, and a real publication needs explicit owner approval.

The installed `editor/index.html` remains unchanged. Its real Save/Load buttons still use the original page/navigation v3 and resource v2 draft formats bound to the original website checksum. These formats are **not automatically compatible** with the experimental versioned draft envelope.

Before integrating any actual version-aware Save/Restore workflow: decide and approve the canonical resource-file layout, design safe upgrade of old draft formats, establish durable cross-process conflict detection/crash recovery, independently verify full HTML reconstruction, test real administrator editing and keyboard flow, restore a retained complete backup, and obtain CosmicCuddle's approval for any merge or deployment.
