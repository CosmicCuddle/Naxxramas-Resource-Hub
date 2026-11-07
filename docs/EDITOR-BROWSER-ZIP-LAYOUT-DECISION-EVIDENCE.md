# Source layout decision evidence from the editor's actual saved ZIP

**6 November 2026 — private Stage 6 engineering review. No layout approved, no save, no merge, no deployment.**

The browser editor can now restore page and resource drafts directly from a source-checked private review ZIP. Its **actual saved ZIP bytes** can also be reviewed against a clean, exact Git checkout using `editor/tools/review-private-combined-zip.cjs`.

This follow-up adds `editor/tools/review-browser-zip-layout-choices.cjs`: it sends those **same actual ZIP draft bytes** through the existing, independently implemented **418-file full-source** and **415-file versioned-resource-overlay** checks, then checks that the same page changes, resource fragments and reconstructed `site-content.html` hashes result. Neither proposed layout is installed in Git or selected.

## What a valid result proves

- The combined review archive contains **both** the original-format page/navigation draft and resource draft. A page-only or resource-only ZIP is still valid for its existing single-domain review, but is not treated as evidence of a *two-domain layout comparison*.
- The local Git checkout matches a caller-specified exact 40-character commit, and was clean before and after the review.
- Every changed existing page/navigation file has the **same exact original and proposed SHA-256** across both independent planners.
- Every changed resource fragment corresponds to the **same original resource index** and has the **same original and proposed SHA-256** across both layout designs.
- Both candidate planners generate the **same complete compatibility website SHA-256** without rewriting or losing the original non-resource shell and custom data.
- No resource-source layout, GitHub update, owner approval, independent durable backup, administrator Save/Restore, or publication is claimed.

The report contains paths, counts, SHA-256 values and explicit refusal flags; no full HTML, private resource content or edited wording appears.

## The two candidate layouts

| Proposed authoring arrangement | Additional resource-source files | Retains original runtime until approved change | Status |
| --- | ---: | --- | --- |
| A. Full legacy resource source tree | **418** (414 resource fragments plus manifest/prefix/suffix/separators) | Yes | Technically rehearsed, not owner approved |
| B. Resource-only versioned overlay | **415** (414 resource fragments plus one manifest) | Yes | Technically rehearsed, not owner approved |

Previous independently verified uncompressed baseline: full source tree **31,102,068 bytes**, resource-only overlay **1,072,527 bytes**. Candidate B avoids duplicating a roughly 30 MB non-resource shell. These are original-baseline feasibility measurements, *not exact sizes of any later edited state*.

**Provisional technical preference:** B is the better **transitional** layout for a conservative first implementation, because it is much smaller and reduces duplicate source-of-truth risk while keeping the existing loader and generated compatibility HTML. It is not yet a true standalone authoritative source tree. A production-ready B must handle repeated revisions without depending on the original runtime hash forever, and must have an independently verified source builder, backup and restore.

Neither option is selected by this tool. CosmicCuddle makes the final decision after reviewing both options, preservation tests and the authenticated administrator workflow.

## Private command

In a **clean disposable checkout**, with an external private saved ZIP and known Git commit:

```text
node editor/tools/review-browser-zip-layout-choices.cjs --checkout "/absolute/disposable/repository" --zip "/private/location/Naxxramas-Private-Editing-Review.zip" --commit "40-character-Git-SHA"
```

The private tool does not extract the ZIP or write any source files. It fails if the private ZIP changes during processing. The test `editor/tests/browser-zip-layout-choices.test.cjs` creates a ZIP using the **real browser writer**, compares both layouts with source checks, and injects mismatched paths/hashes, stale commits, malformed ZIPs and incomplete dual-domain input.

**Release remains blocked:** canonical storage decision; real end-to-end File Save and exact-old remote Git ref update; full and independent backup verified through restoration; original Admin/editing and custom-field acceptance; complete browser/keyboard/mobile acceptance; owner-authorised merge and deployment. No real website files are changed by this exercise.
