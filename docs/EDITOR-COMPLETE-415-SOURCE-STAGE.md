# Stage 6 — complete physical resource-source migration package rehearsal

**Status: DEVELOPMENT TEST ONLY (6 November 2026). Not approved, not a GitHub Save, not a production migration.**

The earlier editor checks can convert a real combined private review ZIP into a read-only change plan. The existing versioned overlay test can also build a small candidate with one edited resource fragment, the source manifest and the full compatibility HTML.

**A vital missing step for the very first migration:** The Git repository currently does not track the 415 proposed resource-overlay files. A package containing *only changed fragments* cannot establish the rest of the resources as individually editable sources. The first migration must include **all 414 resource fragments plus the manifest**, even when only one or two resources were edited.

The new private tool `editor/tools/rehearse-browser-zip-complete-source.cjs` tests that exact situation using the actual editor-saved combined ZIP and a clean Git checkout pinned to a specific commit.

## What is staged inside disposable folders

- A **complete 415-file** proposed versioned resource overlay: the manifest and all 414 individually checksummed fragments, including **all unchanged fragments**.
- The regenerated complete **`site-content.html`**, reconstructed from the verified original non-resource shell and those actual 414 proposed resource fragments.
- Only the changed, existing page HTML and navigation JSON paths, taken from the separately source-verified page draft.

The full package occupies **415 + 1 + N files**, where N is the number of changed tracked page/navigation files (at most five). For example, one changed page and navigation gives **418 staged paths**. It does **not** duplicate all other website files or promise to be a complete repository backup.

## Verification gates

The tool:

1. Verifies the actual browser ZIP's restricted file inventory, payload checksums, manifest and supported page/resource draft formats.
2. Requires the exact selected commit and checks the original Git checkout is clean before and after.
3. Confirms the original full website matches its pinned 30,976,969-byte source and SHA-256.
4. Converts the original resource-v2 draft into a first-revision, checksum-bound overlay draft in an **OS-private** directory, using the existing resource parser.
5. Independently generates the changed resource fragments, manifest and rebuilt compatibility HTML using the existing reviewed resource package writer.
6. Stages **the full first-generation source tree** by including every unchanged physical resource alongside the changed resources and manifest, then verifies the 415 source files.
7. Cross-checks the entire staged path inventory and the **actual byte contents** of every resource, manifest, changed page/navigation path and regenerated compatibility file.
8. Deletes all temporary staging directories, preserving the original checkout. Corrupted runtime HTML, source fragments, manifest, page contents and extra files all cause rejection.

Tests: `editor/tests/browser-zip-complete-source.test.cjs` uses ZIPs from the actual browser export code and tests a real mixed page/navigation plus two-resource edit. It injects corruption and tests the retained original site and cleanup.

## Important remaining limitations

This is a **full candidate source-file staging proof**, but not a deployable GitHub package. Specifically, it does not write to Git, use the real administrator interface, prepare a durable full repository backup or prove a remote atomic branch update. The migration strategy and repeated revision strategy still require CosmicCuddle's decision, additional engineering and acceptance.

The 418-file full-source-tree alternative remains unapproved but available for comparison. **The 415-file overlay was used here only to demonstrate its initial full-source staging, not to select it.**

The compatibility runtime is still generated from the **pinned original HTML shell**. Future independent shell changes, original administrator fields and versioned production updates require their own source-of-truth and restore design. It is not safe to promote this private prototype directly to publication.

The original website, root loader, navigation, images, original Admin code and all 414 resource records remain unchanged in the repository.
