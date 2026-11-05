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

### Nested side-object structure and possible resource references — verified (Part 08 continuation)

Read-only GitHub editor run [42042008445](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42042008445) passed **67/67 tests** with the additional nested-structure audit. The original source fingerprint was verified before any scanning. This work did not execute page code, change website files or export source values.

| Aggregate nested finding | Result |
| --- | ---: |
| Outer side-field layouts | 1 (same ordered field-key/type layout across all 29 records) |
| First-level object fields | 87 |
| Total nested object containers, including second level | 174 |
| Direct fields inside the 87 first-level nested objects | 435 |
| Total properties in all nested objects | 696 |
| Distinct ordered nested key/type layouts | 4 |
| Nested array containers | 0 |
| String-valued nested properties | 435 |
| Number-like nested properties | 87 |
| Object-valued nested properties | 87 |
| Boolean-literal nested properties | 87 |
| Function/property-call expressions in these positions | 0 |
| Unparseable nested fields / repeated nested keys | 0 / 0 |
| Max nested container depth from first-level object | 1 (second level present) |
| Exact string/numeric-literal matches to 414 resource IDs | 0 |

The zero-match count covers literal values inspected in the side collection, **not** the content of arbitrary HTML, runtime-generated values, names matched through another mapping, or all references elsewhere in site JavaScript. It cannot demonstrate that the 29 records are independent of the main resources. Number-like values were classified by syntax; they were not all proven to be semantically meaningful numbers.

**Preservation rule:** These 29 records and all 174 nested objects must remain unmodified in any upcoming 414-resource export. Do not convert the side records into the main resource archive, rename their keys, or change the seven-property outer layout without separate owner-approved compatibility testing. The next relationship review must inspect the site code that consumes these collections; syntactic scans alone do not establish runtime meaning.

### Original inline JavaScript usage candidates — read-only check

[Editor CI run 42042814397](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42042814397) passed **71/71 tests** with a new lexical usage scanner. The scan checked 35 original inline script blocks for direct access to the original property containing the 29-item collection, using the verified original source. It did not evaluate any website code or print field names.

| Original code pattern, counted as candidates only | Count |
| --- | ---: |
| Direct dot-style accesses to the 29-item side collection | 13 |
| Direct string-bracket accesses to that collection | 0 |
| Direct dot-style accesses to the 414-resource collection | 31 |
| Direct string-bracket accesses to the resources | 0 |

This is **evidence of plausible original code usage, not a proven runtime dependency graph**. The scanner excludes quoted text and comments in straightforward cases, but could still count regex or template syntax as code; it can also miss aliases, computed field names, external scripts, and dynamically generated references. Conversely, zero exact literal ID matches between the two collections does **not** mean the side collection is unused.

**Implication:** Maintain the 29-item collection and existing script access patterns as-is. Before authoring a new browser resource editor, review read paths, write paths, and runtime tests for this collection; never replace it by trying to merge it into the 414 resource objects.

### Possible direct writes and access compatibility (Part 08 follow-up)

The new read-only consumer classifier separates direct assignments, known array-mutating method calls, shallow member assignments, and all other candidate accesses. Its results were verified on the original fixed Git blob in [editor CI run 42046940102](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42046940102). That run passed 76/76 tests.

| Lexical candidate category in 35 original inline scripts | 29-item side collection | 414-resource collection |
| --- | ---: | ---: |
| Direct reassignments | 0 | 7 |
| Known array-mutating method calls | 2 | 1 |
| Shallow member assignment patterns | 1 | 1 |
| Other access patterns | 10 | 22 |
| **Total** | **13** | **31** |

Four script blocks contain candidate side-collection accesses, nine contain candidate resource accesses, and two contain candidates for both. These totals are limited to inline scripts and syntactically visible \`DATA\` access; indirect aliases, computed property names, template/regex ambiguities, external scripts and real execution paths remain unverified. The table **must not** be interpreted as proof that any operation runs, or that the remaining access patterns are read-only.

A separate synthetic compatibility test now changes only a title within the first resource, then the last resource, entirely **in memory**. In each case, all 413 other resource objects are unchanged, the exact original source prefix/suffix are retained, and the aggregate original collection-access candidate report stays identical. [Editor CI run 42047159391](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42047159391) passed **78/78 tests**.

**Release gate:** Any future editor must preserve the 29-item side collection and all original script consumers; source-text preservation and candidate-count equality are necessary checks but do **not** prove functional browser compatibility. Run actual private/offline browser acceptance tests before enabling export or publication.





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
    node editor/tools/audit-side-collection.cjs
    node editor/tools/audit-side-nested.cjs
    node editor/tools/audit-side-usage.cjs
    node editor/tools/audit-side-consumers.cjs
    node editor/tools/audit-legacy-media.cjs
    node --test editor/tests/*.test.cjs

Audit scripts report aggregates and hashes only; they do not evaluate website code, write files, print private content or upload data.

**Next investigation:** Map original resource field schema and internal references without changing source data.
