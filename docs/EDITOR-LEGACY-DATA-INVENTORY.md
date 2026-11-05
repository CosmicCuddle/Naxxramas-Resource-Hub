# Legacy Resource Hub data inventory — 5 November 2026

**Status:** Read-only structural findings from the preserved website baseline. **No migration approved or performed.**

**Source:** site-content.html, Git blob SHA-1 71ab9f2bf4cf12282fcbe135f7ec787805715b62. The published site and pristine backup branch are not modified by this audit.

## Baseline integrity

| Audit | Observed value | Meaning |
| --- | ---: | --- |
| Original file bytes | 30,976,969 | Exact source byte length |
| Approximate source lines | 31,988 | Newline count plus one |
| Opening script tags | 35 | Structural marker count only |
| Opening style tags | 36 | Structural marker count only |
| Embedded image data-URI prefixes | 95 | Occurrences, **not** a count of unique images |
| Original top-level data object members | 27 | Lexically identified in the window object assigned before the DATA clone |

The site assigns its main DATA value through JSON.parse(JSON.stringify(...)) of an existing window property. One earlier assignment initializes that property with an object literal. A second assignment to the same window property appears later in the source and must not be conflated with the pre-clone initializer. No website JavaScript was executed to obtain these findings.

## Candidate resource inventory

The earlier object literal has **five direct arrays**, in source order:

| Member index (not a resource ID) | Syntactic entries | Direct object literals | Interpretation |
| --- | ---: | ---: | --- |
| 4 | 414 | 414 | Whitelisted key resources |
| 12 | 0 | 0 | Empty array; use remains unverified |
| 16 | 0 | 0 | Empty array; use remains unverified |
| 17 | 29 | 29 | Separate named-object collection, not yet classified |
| 27 | 0 | 0 | Empty array; use remains unverified |

The resources array contains **414 object literals**. Each has direct fields named id, title, section, classes, and content. No repeated literal ID token was found using the read-only lexical check; this is **not** a guarantee of runtime uniqueness or approval to renumber IDs.

These objects also contain **13,821 occurrences of fields outside the audit's small approved field-name allowlist**. This does not mean 13,821 distinct fields. It indicates substantial additional/custom structure that must survive an eventual migration. No unknown field names, content, IDs or values were printed.

The separate 29-item array has 29 direct objects with a name field and no direct id field. We must not count these as resource records or discard them without determining their purpose.

### Protected 29-item side collection — verified shape (Part 08)

The standalone read-only audit now checks this collection against the same exact original Git blob as the 414 resources. GitHub editor workflow run 42040703834 passed **63/63 tests**, including the new side-collection tests.

| Aggregate finding | Verified |
| --- | ---: |
| Direct side objects | 29 |
| Direct properties per object | 7, consistently |
| Total direct properties | 203 |
| Literal name fields | 29 |
| Duplicate decoded names | 0 |
| Direct id fields | 0 |
| Object-valued direct fields | 87 (three per record) |
| String-valued direct fields | 58 (two per record) |
| Number-like direct fields | 58 (two per record) |
| Arrays / expressions / unparseable direct fields | 0 |

No site names, content values, custom property keys or identifiers were printed by the new audit. Its shape counts **do not** reveal what the three nested objects contain, which site features depend on them, or whether any runtime mutations occur. Do not rename, flatten, omit or export this 29-item collection independently until its nested schema and references are fully checked. The original file and visitor code were not modified.


## Byte-exact split and rebuild proof (development only)

The read-only in-memory splitter now locates the pre-clone window object, isolates all **414 resource object fragments** and retains **415 separator sections**. It reconstructs the complete original HTML without writing a single file.

| Round-trip gate | Verified result |
| --- | --- |
| Resources reconstructed | 414 of 414 |
| Original and reconstructed bytes | 30,976,969 each |
| Original and reconstructed SHA-256 | 34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8 |
| Bytes changed | 0 |
| Missing record handling | Rejected |
| Reordered or altered record handling | No longer byte-identical |
| Repository files written | 0 |

This establishes that source fragments can be separated and reassembled in memory **without loss**. It does **not** prove that new separately stored files have been created, that a modified resource can be safely published, or that the browser/site logic is functionally equivalent after changing how data loads.

## Field and association audit

The 414 object literals were inspected without evaluating their source. All have an id, title, section, classes and content field. All 414 id values are ordinary decodable source strings and are distinct after decoding; none are repeated. These findings concern the **original literal** only, not every potential runtime mutation.

| Finding | Observed |
| --- | ---: |
| Decoded distinct resource IDs | 414 |
| Repeated decoded IDs | 0 |
| Distinct section values | 7 |
| Distinct values stored as class associations | 41 |
| Total class-association entries | 393 |
| Resource properties per record | 37–43 |
| Additional property occurrences outside the approved audit allowlist | 13,821 |
| Image markers inside resource fragments | 0 |

The 41 distinct class-association values are **not** 41 playable character classes. Their exact meaning and relationship to navigation/progression remain under review. All 414 content values are string literals, but these may embed structured HTML or other custom content: do not flatten them into plain text.

## Embedded image baseline

The source contains **95 embedded image references** comprising **71 distinct decoded image payloads**. All 95 passed the declared file-header checks and reversible Base64 decoding.

| Format | References |
| --- | ---: |
| PNG | 47 |
| JPEG | 32 |
| WebP | 16 |

There are **24 repeated image payload references**. The sum of decoded image bytes, counting repeated references, is 19,598,519. These references occur 20 times before and 75 times after the source resources array; none occur inside the 414 resource fragments.

A *distinct payload* does not necessarily correspond to an already separate image file. Deduplicating or moving images into shared asset files is **only a future option**. All original resource references, display appearance and theme must be retained until proven equivalent.

## Confidence boundaries

**Confirmed by source syntax:** 27 direct members in the earlier object, 414 direct resource object literals, 29 separate object literals, three empty direct arrays, and the listed field-presence totals.

**Unverified:** active/runtime resource count after initialization, uniqueness of decoded/normalized IDs, reference validity, media asset uniqueness, nested data contracts, interaction with administrator edits, exact purpose of all 27 object members, and effect of the later assignment.

**No migration:** The large HTML source has not been altered, the data is not exported, and there has been no production change. This inventory is not permission to change or simplify the website schema.

## Migration safety gates

1. **Exhaustive record contract.** Identify all fields in all 414 resource object literals and the purpose of the 29-item collection, including nested records and custom attributes. Preserve unknown/custom fields byte-for-byte or via an explicitly verified lossless representation.
2. **ID and relationship safety.** Verify stable resource IDs, cross-references, class/dungeon/raid associations, images, ordering, and administrative edit pathways. Do not regenerate IDs or silently normalize text.
3. **Reversible transformation.** Build an offline, reviewable exporter/importer and compare hashes, record counts, field counts, IDs, resource ordering and rendered behaviour before and after each small change.
4. **Protection.** Keep a complete pristine repository backup and a disposable test branch. Do not change the published main site, its loader or production admin workflow during investigation.
5. **Owner release gate.** Require working browser tests, CI, full-site restore procedure, private/local editor distribution and explicit CosmicCuddle approval before any merge.

## Read-only audit commands

Run from a complete repository checkout:

    node editor/tools/inspect-legacy.cjs
    node editor/tools/audit-legacy-shape.cjs
    node editor/tools/audit-legacy-json.cjs
    node editor/tools/check-legacy-roundtrip.cjs
    node editor/tools/audit-resource-schema.cjs
    node editor/tools/audit-legacy-media.cjs
    node --test editor/tests/*.test.cjs

Audit scripts report aggregates and hashes only; they do not evaluate website code, write files, print private content or upload data.

**Next investigation:** Map original resource field schema and internal references without changing source data.
