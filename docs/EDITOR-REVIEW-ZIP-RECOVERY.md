# Review ZIP recovery in the local website editor

**Status: DEVELOPMENT PROTOTYPE — no live GitHub Save, no deployment approval (6 November 2026).**

The existing editor can download one combined private ZIP containing the **page/navigation draft** and/or the **414-resource title/content draft**, a SHA-256 manifest and instructions. Previously, reopening these drafts required manually extracting the ZIP.

The editor now has a local **Open a saved combined review ZIP** control. Choose a previously saved review ZIP; a strict in-browser reader verifies the file structure before enabling **Download Page Draft (.json)** and **Download Resource Draft (.json)** as appropriate. The original review ZIP is not modified or uploaded.

### What is checked

- Only the exact supported three-file and four-file review ZIP inventories. No arbitrary paths, parent traversal, duplicate paths, archive comments, hidden trailing bytes, ZIP64, compression or encryption are accepted.
- Local and central ZIP headers must agree on entry names, offsets, uncompressed sizes, and CRC-32 checksums.
- Payload names, UTF-8 decoding, basic original draft formats, and the expected private-review manifest structure must match.
- Each recovered JSON draft must match the manifest's recorded **SHA-256** and UTF-8 byte length. Only the dedicated private review draft names can be offered for download.
- The archive is limited to 20 MiB and every entry to 16 MiB; failure leaves the editor's existing working drafts alone and disables both recovery buttons.

**Important distinction:** These checks establish only that the chosen ZIP is internally consistent with its manifest. A malicious person could construct a different ZIP with new matching checksums. This is **not cryptographic authentication of an author or a GitHub commit**, and the reviewed draft does not include a complete website backup.

### How to recover drafts

1. Open `editor/index.html` from the development editor copy.
2. In section 5, choose the previously downloaded combined review ZIP.
3. When verification succeeds, download the available page and/or resource draft JSON files.
4. Use **Load Saved Draft** in section 5 for the page/navigation JSON, and **Load Resource Draft** in section 4 for the resource JSON. The existing editors perform their independent source-baseline checks.

The recovery interface **never automatically overwrites current working edits**, merges conflicting drafts, runs original website scripts, commits files, publishes, or connects to any account. The original source files must be supplied separately and pass their normal checks. If a ZIP fails verification, keep the original ZIP and investigate; do not bypass integrity checks.

### Release blockers unchanged

Stage 6 remains incomplete: a canonical resource layout is unapproved (415-file versioned overlay versus 418-file full source tree); there is no live administrator Save transaction, retained full independent backup, verified production-grade rollback, or owner-approved merge/deployment. This recovery control only removes the manual ZIP extraction step from the **local draft recovery** workflow. The original website and all 414 resource records remain untouched by the PR.
