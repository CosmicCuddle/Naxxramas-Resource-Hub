# Review ZIP recovery in the local website editor

**Status: DEVELOPMENT PROTOTYPE — no live GitHub Save, no deployment approval (6 November 2026).**

The existing editor can download one combined private ZIP containing the **page/navigation draft** and/or the **414-resource title/content draft**, a SHA-256 manifest and instructions. Previously, reopening these drafts required manually extracting the ZIP.

The editor has a local **Open a saved combined review ZIP** control. Choose a previously saved review ZIP; a strict in-browser reader verifies its structure before enabling **Restore Page Draft in Editor** and **Restore Resource Draft in Editor** for any included drafts. It also retains optional **Download Page Draft (.json)** and **Download Resource Draft (.json)** fallback buttons. The original review ZIP is not modified or uploaded.

### What is checked

- Only the exact supported three-file and four-file review ZIP inventories. No arbitrary paths, parent traversal, duplicate paths, archive comments, hidden trailing bytes, ZIP64, compression or encryption are accepted.
- Local and central ZIP headers must agree on entry names, offsets, uncompressed sizes, and CRC-32 checksums.
- Payload names, UTF-8 decoding, basic original draft formats, and the expected private-review manifest structure must match.
- Each recovered JSON draft must match the manifest's recorded **SHA-256** and UTF-8 byte length. Only the dedicated private review draft names can be offered for download.
- The archive is limited to 20 MiB and every entry to 16 MiB; failure leaves the editor's existing working drafts alone and disables both recovery buttons.

**Important distinction:** These checks establish only that the chosen ZIP is internally consistent with its manifest. A malicious person could construct a different ZIP with new matching checksums. This is **not cryptographic authentication of an author or a GitHub commit**, and the reviewed draft does not include a complete website backup.

### How to recover drafts

1. Open `editor/index.html` from the development editor copy.
2. Load the four original page HTML files and navigation source using the folder picker in section 1, if recovering page edits. For resource edits, separately load and verify the original `site-content.html` in section 4.
3. In section 5, choose the previously downloaded combined review ZIP.
4. When verification succeeds, select **Restore Page Draft in Editor** and/or **Restore Resource Draft in Editor**. Each area checks the original source fingerprint, validates the whole incoming draft before changing in-memory state, and requests confirmation if existing unsaved edits would be replaced.
5. Alternatively, download one or both JSON drafts and open them using **Load Saved Draft** in section 5 or **Load Resource Draft** in section 4. The same validation and overwrite-confirmation rules apply.

**Cancellation or validation failure keeps existing local edits.** In particular, the page editor now asks before replacing unsaved page or navigation edits, matching the existing resource editor's behaviour. Unsafe link addresses and changed/duplicate page source paths are refused during import; stale source files cannot silently receive an older saved draft.

The recovery interface does not merge drafts across domains or automatically overwrite both at once. A user chooses page and resource restoration separately. It never runs original website scripts, commits files, publishes or connects to any account. If a ZIP fails verification, keep the original ZIP and investigate; do not bypass integrity checks.

### Release blockers unchanged

Stage 6 remains incomplete: a canonical resource layout is unapproved (415-file versioned overlay versus 418-file full source tree); there is no live administrator Save transaction, retained full independent backup, verified production-grade rollback, or owner-approved merge/deployment. This recovery control removes manual ZIP extraction **and** lets the user restore each source-verified local draft directly, subject to a new overwrite-confirmation gate. The original website and all 414 resource records remain untouched by the PR.


### Part 12 — page edit integrity tightened before a review ZIP is accepted

The local ZIP saver and ZIP reader now both reject a page draft whose edited field keys are not valid text/link token positions (`T:<position>` or `H:<position>`), whose saved edit values are not strings, or whose values exceed the original editor's 30,000-character per-field limit. This is **in addition to** the existing exact page path/source-hash metadata and ZIP CRC/SHA checks. Tests include a **deliberately forged archive with matching CRC and SHA-256** that must still be refused when it contains an invalid page value.

Valid unchanged text, empty page text, multiline text and Unicode remain supported. A failed export does **not** replace existing in-memory draft edits. The source-bound page editor remains the ultimate authority: it separately validates actual scanned text/link positions, original file hashes, link safety, navigation and overwrite consent when restoring. Passing a ZIP check **never** proves a real source edit was applied or authorises GitHub publication.

**Development status:** These source/test changes are confined to the private editor prototype in draft PR #56. Latest exact-head CI must succeed before this safety change is marked verified. There is still no authenticated original Admin Save, production writer, selected 415/418 resource layout, owner-held release backup or permission to merge/deploy.


### Part 12 follow-up — writer and recovery reader use matching size limits

The combined **private review ZIP writer** now enforces the local recovery reader's exact limits **before download**: no empty entry, no entry larger than **16 MiB**, and no complete ZIP larger than **20 MiB**, including filename and ZIP header bytes. It cross-checks its predicted archive length against the resulting Blob length. A refused oversized save leaves all in-memory page/resource drafts untouched; use the separate individual JSON draft downloads if the combined ZIP is too large.

This review-only limit does **not** change the separate **Export Changed Files (.zip)** path or the original site's resource content. Dedicated negative tests exercise an oversized entry, an oversized combined archive and an empty entry; the existing normal-sized review ZIP/restore tests remain in place.

**Limits of this safeguard:** Matching ZIP limits do not prove that the original site files are the correct revision, that an individual JSON draft is source-bound, that the complete repository has been backed up, or that any GitHub writer is approved. The 415-versus-418 resource storage choice, authenticated original Admin Save and publishing remain gated by owner decision. Only consider the writer/reader limit mismatch fixed after successful exact-head CI.


### Part 12 — navigation metadata checked before review ZIP save or restore

The review ZIP save and recovery reader now validate the **same three original navigation records** required by the page editor: New Players (new-players), Server Rules (rules), and Apply to Join (apply) in their established order. They require the existing naxx-navigation-v1 data shape, General group, exact allowed fields, safe .jpg icon filenames (not URLs or parent paths), and valid label/title/introduction text and length bounds. This duplicates the *shape* contract at the earliest save boundary, not an attempt to authenticate a Git source revision.

A malformed navigation document is rejected **before a review ZIP is offered**, and the reader independently rejects forged ZIPs carrying modified navigation despite regenerated matching CRC-32 and SHA-256 metadata. Tests use the original content/navigation.json fixture for valid archives, and specifically try missing records, route substitutions, unknown fields, unsafe icons, invalid lengths and embedded control characters. Failed save/recovery leaves previously edited in-memory drafts intact.

**Limits:** An internally consistent ZIP can still originate from untrusted input. Exact source-hash matching, original token/link validation, overwrite confirmation, 414-resource preservation and independent backup remain separate gates. No original webpage, Admin control, resource data, production writer, public asset or source layout is altered. Treat these new changes as pending until exact-head CI passes.


### Local page source refresh — most recent folder wins (Part 12)

The **four-page plus navigation source-folder picker** in the development editor is now staged before committing: it reads and validates all five selected files into temporary memory, then changes the active source only if that folder is still the most recently selected one. An older asynchronous read or old failed selection cannot overwrite a newer loaded folder or its success/error message.

If there are **unsaved page or navigation edits at the moment replacement becomes possible**, the editor now requests consent **after reading and validation**, immediately before changing the active source. This also catches new edits made while a large folder is being read. Cancelling keeps the original source and all in-memory edits; an invalid folder also keeps them. No original website files, review ZIPs, Git commits or resource titles are automatically written.

Dedicated tests exercise overlapping folder reads, edits made mid-import, refusal/approval and old-load errors after a newer successful selection. Focused isolated runtime checks for the first three scenarios passed before CI. This guard does **not** replace the source SHA-256 checks performed when a saved draft is restored; it is a separate anti-data-loss safeguard around **source folder selection**.

**Status:** Development-only on protected draft PR #56; the full exact-head CI checks must pass before the change is considered verified. No real website Admin Save or publish action was performed.


### Part 12 — full page-draft ZIP recovery chain integration check

A new test, `editor/tests/review-zip-source-bound-e2e.test.cjs`, now exercises a single **in-memory review-only recovery chain**:

1. Build the actual combined review ZIP from fictional four-page navigation and resource-title drafts using the browser ZIP writer.
2. Reopen the actual resulting ZIP bytes using the strict archive inspector and manifest checks.
3. Use the real ZIP recovery interface to restore the page draft into the **actual source-checked local page editor**, using synthetic source records and known SHA-256 fingerprints.
4. Confirm the original page and navigation edits are restored correctly without publishing.
5. Refuse a ZIP tied to the wrong source fingerprint **before replacing existing unsaved page/navigation edits** and without prompting to overwrite.
6. Refuse restoration when the owner cancels, and reject a corrupted ZIP without enabling the restore buttons.

The resource side is **simulated** in this new integration test; independent resource-specific tests and full original 414-resource preservation checks remain separate and mandatory. The test is not authenticated original Admin Save acceptance, original source reconstruction, a full Git backup, a GitHub writer, or proof that production data can be deployed safely.

**Status:** This tests the private editor prototype only. The current GitHub Actions run for this exact head must pass before the new integration test can be counted as successfully executed in CI. No original website assets, installed client, server configuration or resource data were modified.
