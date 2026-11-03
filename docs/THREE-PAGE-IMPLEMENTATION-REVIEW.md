# Three Native Resource Hub Pages — DRAFT Implementation Review

**Owner:** CosmicCuddle — final approval required.
**Planning:** https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/issues/46
**Status:** Scoped review branch only. No merge, deployment, application uploads or player accounts activated.

## Design feedback incorporated — 3 November 2026

After viewing the offline screenshot, the owner confirmed the overall layout was acceptable but pointed out **non-native menu icons** and a **large empty gap** in the hero/header area.

- The earlier offline screenshot generator used temporary Unicode glyphs (sparkle, pencil, envelope) and **was not accurate for sidebar icon appearance**. The draft's real navigation script has now been explicitly tied to three Warcraft icon-image assets confirmed in the original site's own HTML (book for New Players, note for Server Rules, key for Apply to Join), using the site's original `nav-icon-image` class and native size.
- `assets/naxx-three-pages.css` now collapses the native `170px` artwork column only for the three new pages, where large banner emblems were intentionally removed. It also tightens excess header padding. The original native banner and images on every other Resource Hub page are unaffected.
- Asset versions bumped to `v=2` in the root and subpage loaders; tests verify the icon assets exist in original site source and the empty column is removed.
- **The previous screenshots predate these corrections**. Do not present those old images as proof of this revised layout. A real connected browser review is still required for full Warcraft icon rendering and the final visual appearance before owner merge approval.

## Included for review

- `new-players/` — detailed New Player Guide, character-based Individual Progression, client build 12340, verified patch release links, private post-acceptance configuration, Playerbots, altbots, Auction House, loot and 14 anticipated FAQ questions.
- `rules/` — twelve full, permanently visible rule cards, examples, group etiquette, ticket help, enforcement and 35 practical Getting Started FAQ questions grouped into five topic sections about client setup, IP tiers, Playerbots and altbots.
- `apply/` — short Download → Complete and Save → Upload and Submit flow, disabled uploader, manual owner-review/reply explanation and ten anticipated FAQ questions.
- `assets/naxx-three-pages.js` — adds exactly three native-styled links immediately after Home in both original sidebar and mobile drawer; leaves all original groups, search, breadcrumbs, existing Admin controls and resources intact.
- `assets/naxx-three-page-bootstrap.js` — loads the **same native ~31MB source** and the exact existing root overlay scripts for the new permanent URLs. Does not use the visual preview as code.
- `assets/naxx-three-pages.css` — new-page-card-only styles, matching native black/deep-red/gold; avoids modifying sitewide sidebar dimensions, search, breadcrumbs and general site CSS.

The root `index.html` remains a lightweight loader with only two new asset references. `site-content.html` must remain bit-for-bit unchanged during this feature draft. Existing talent fixes, raids timers, patch notes, Change Notes, modules, other menus and Admin are not replaced.

## Owner's FAQ direction — 3 November 2026 (awaiting wording approval)

The owner reviewed the original Rules FAQ and requested **more practical questions**, especially how to set up the client, what Individual Progression does, what each tier means, how a player determines their tier, what Playerbots do, and whether bots complete their own quests.

The draft Rules page FAQ was expanded to **35 Getting Started Q&As**, with 5 topic headings and jump links. The twelve already approved rules and the approved Vanilla group etiquette, ticket guide and enforcement sections are unchanged. The New Player Guide remains the detailed source, linked from these short FAQ answers. The FAQ text itself is **proposed for owner review, not yet approved**.

Grounding:
- The required 3.3.5a client and two patch filenames, character-based Individual Progression and permissible altbot levelling come from the existing reviewed guide and the owner's recorded rules.
- [The owner's Grimfeather IP fork](https://github.com/CosmicCuddle/mod-individual-progression/blob/master/src/IndividualProgression.h) has internal completed-milestone state values 0–7 for early Vanilla, Molten Core, Onyxia, Blackwing Lair, AQ preparation/war, AQ and Naxxramas; these are **not character levels**. It does not establish a public-facing player tier lookup. Its [`ip get` chat command](https://github.com/CosmicCuddle/mod-individual-progression/blob/master/src/cs_individualProgression.cpp) is restricted to `SEC_GAMEMASTER`, so the public page **does not instruct normal players to use it**.
- Upstream Playerbots can quest independently depending on settings, but the owner's **deployed** autonomous quest and group quest syncing options are not yet confirmed. The FAQ makes this caveat explicit.
- A targeted verification request has been filed with Maintenance at [Coordination Issue #34](https://github.com/CosmicCuddle/Naxxramas-Server-Coordination/issues/34). Update the two provisional answers once actual live capabilities are established.

**No merge or publication authorised.** This is a draft content edit only.

### Owner request: substantially larger but readable FAQ

CosmicCuddle asked for **many more questions and answers**, with useful detail that remains easy to read. The draft FAQ has been extended to **35 questions**, grouped by Client Setup & Joining (7), Individual Progression & Tiers (11), Playerbots & Altbots (10), Loot, Trading & Everyday Play (4), and Help & Troubleshooting (3). Short topic links allow navigation without collapsing any answer. Each answer stays to a few sentences and points to the full New Player Guide or the relevant rule when more detail is needed.

**Content status:** proposed for owner review; do not interpret this drafting action as approval of the FAQ or as authority to merge. The 12 individually approved rules, group etiquette, in-game ticket instructions, and ban enforcement sections are unchanged. The server-specific tier display and installed bot quest behaviour are still awaiting verification from Maintenance ([Issue #34](https://github.com/CosmicCuddle/Naxxramas-Server-Coordination/issues/34)).

## Native runtime regression work — 3 November 2026

The initial screenshots showed only the intended design. An additional source-level review of the original site's JavaScript revealed that the native Resource Hub may **re-render `#resourceGrid` after the new page is mounted**. The initial one-time data attribute would have prevented remounting, and a displayed guide could disappear.

- `assets/naxx-three-pages.js` now caches each route's fetched HTML once and observes **only the content grid** for native redraws. When the native page renderer replaces the guide content, the new-page article is restored from memory without another network request or a repeated mutation loop.
- The original Resource Hub's other pages are not intercepted; the observer is installed only for these new guide routes. Any handbook-only height/grid classes are cleared on these routes.
- The page's native heading, breadcrumb and contextual banner text are reapplied when remounted. The Apply demo remains disabled.
- `assets/tests/native-three-pages-behavior.test.cjs` provides a dependency-free mock DOM test for all three page load/re-render paths, one fetch per route, a disabled Apply upload, and a genuine error state when a page cannot be fetched.
- `assets/tests/native-three-pages-navigation.test.cjs` tests native desktop/mobile buttons, placement after Home, link activation, route-selected state, native rebuild recovery and no duplicates.
- `assets/tests/native-three-pages.test.cjs` additionally checks **root and subpage JS/CSS asset parity** so future site features are not accidentally left out on nested guide URLs.
- In-session execution of the production navigation and mounting logic with isolated DOM simulations passed for Home and Rules navigation/rebuild and for New Players, Rules and Apply guide redraw/recovery. These are **simulated checks**, not proof of actual deployed browser integration.
- Full connected-browser QA and screenshots that show the real CDN icons are still required; do not portray earlier mock screenshots as final browser evidence.

## Public Game Clients correction incorporated — 3 November 2026

**Resolved in the current website source:** CosmeticCuddle approved the separate targeted Game Clients sanitisation, merged into `main` via [PR #48](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/pull/48). This draft branch has now incorporated that merge, retaining the original Resource Hub source file **after** the approved single-field redaction. Exact source Git blob: `71ab9f2bf4cf12282fcbe135f7ec787805715b62`.

The public site no longer gives new applicants the old connection-setting line; it explains that approved connection instructions are supplied privately as an acceptance-email attachment. Existing client and custom patch information remain intact. The draft test now requires the sanitized content hash, so the old source must not be reintroduced by accident.

**Historical exposure is a separate issue:** Earlier public commits, cached files and previous downloads cannot be erased by an ordinary merge. Maintenance is assessing whether the historic information is still sensitive via [Coordination Issue #33](https://github.com/CosmicCuddle/Naxxramas-Server-Coordination/issues/33). Do not reproduce the historical address or file contents in public tickets, PRs or new documents.

**Still outstanding before publication:** owner approval of full page text and raid-only loot details, real-browser desktop/mobile QA, and review of the closed application state. The private Tally upload remains disabled and requires a separate owner-approved activation process.

## Publication gates — owner decisions needed

- Confirm final Rules Draft 1.0 wording, especially the separate raid-only Master Looter setup; the exact approved raid workflow and automation status have **not** been independently verified.
- Confirm any final player account onboarding/registration sequence, application access model and how future tier access is actually enabled in game. No assumed race restrictions, automatic whitelist or paid expansion services are claimed.
- Verify required patch releases remain current immediately before publication (checked 3 Nov 2026: main v1.0.6.8.4 includes `patch-V.mpq`; v1.0.6.7 supplies `patch-Z.mpq`).
- Pick the official blank application format (fillable PDF, editable DOCX or both). The attached design-review samples are **not published** or offered as final files.
- Approve a privacy notice, retention/deletion schedule, contact email handling, reviewer access, spam/rate limits and permitted reapplications/withdrawals.
- Review desktop/mobile visual QA, header/footer, three new links, keyboard navigation, original site content and all anticipated FAQ answers.
- Confirm the only publicly displayed application state is **closed** until genuine end-to-end tests and explicit owner activation approval.

## Tally Free integration plan — not connected

Tally Free is the preferred option **subject to owner-controlled setup and private testing**. Current official references:
- https://tally.so/help/file-uploads — free file upload supports max **10 MB per file**, with allowed file types.
- https://tally.so/help/embed-your-form — embed with transparent background, dynamic sizing and direct-form fallback link once an owner-controlled test form exists.
- https://tally.so/help/self-email-notifications — notifications are supported on Free. Uploaded files are linked rather than attached to emails.
- https://tally.so/help/submissions-data-retention — scheduled automatic retention requires **Business**, not Free; Free needs a **manual deletion policy**, with deleted submissions otherwise retained in Trash for up to 90 days unless permanently emptied.

**Owner must create/control the form account personally; do not request credentials.** Configure a private test form accepting exactly one PDF or DOCX max 10 MB, applicant email, optional Discord name, community nickname and minimal approved questionnaire. Restrict submissions to the owner/reviewer; verify that uploaded file links do not expose data to unauthenticated third parties. Validate mobile and keyboard file selection, wrong extension, large file, missing file, lost connection, duplicate submit and real server-confirmed success. Use dummy documents only.

After the owner approves the form and supplies its exact embed URL, add the native-framed iframe and a plainly worded external **Open upload form** fallback link to the Apply page. A real success message must appear only after Tally confirms persistence; a failure must not claim successful delivery. Owner email notification is separate from an acceptance decision. Never put uploaded applications, contact details or secrets in GitHub Pages, repository commits, Issues or public previews.

## Regression and manual checks

Run `node assets/tests/native-three-pages.test.cjs`. It checks the exact three routes, preserved lightweight loader, unchanged original source SHA, native nav integration, all 12 visible rules, the 14/9/10 FAQ groups, no accordions and inactive application receiver.

On desktop and mobile:
1. Verify Home → New Players → Server Rules → Apply to Join appears **under Home** with the existing navigation icon sizing; Class Handbooks and every other native item remain in place.
2. Verify the search bar, native breadcrumb strip, original banner/card styling, Admin access and native site footer.
3. Verify the 12 rule blocks all show fully, and FAQs display question/answer text without click-to-expand.
4. Verify original Home, Class and Dungeon Handbooks, Talent Sets, Talent Calculator, Module Information, Game Clients, Temporary Banned, Patches and Change Notes still work.
5. Verify Apply has **no working submit**, no upload endpoint, no live embed and no false confirmation.
6. Inspect at desktop around 1440×900 and mobile 390×844 for overflow, clipped labels and tab navigation.

**Rollback:** Revert this draft PR if later merged; it adds a small set of files and two root loader references. Do not reset `main`; retain the original large content asset. This PR is deliberately not approved for merge.
