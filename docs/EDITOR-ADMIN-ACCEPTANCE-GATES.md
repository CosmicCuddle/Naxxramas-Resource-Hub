# Original website administrator acceptance gates

**Status (6 November 2026): DEVELOPMENT ONLY. Not approved for release.**

This checklist protects the existing Naxxramas Resource Hub's administrator interface while the multi-file Save/Restore editor is developed. It applies to the disposable, full-website private Chrome snapshot and future separately approved, reversible testing. It must not be interpreted as permission to authenticate to production, replace the original editor or publish files.

## Confirmed evidence

| Check | Status | Evidence / limit |
| --- | --- | --- |
| Original admin entry present | **Confirmed** | The real visitor-facing Admin button was identified without exposing its source text |
| Desktop password panel | **Confirmed** | Isolated Chrome at 1440px, protected commit `9f86f775`; password field became visible |
| Mobile password panel | **Confirmed** | Isolated Chrome at 390px, same protected commit |
| No-login safety | **Confirmed in private test** | No password typed/submitted; no admin privileges enabled; original navigation and resource shell remained |
| Original editing controls present | **Confirmed, structural only** | Browser sees the hidden visitor-state editing button and password field |
| 414-resource and complete-site reconstruction | **Confirmed for previous read-only fixtures** | Separate source/round-trip tests; not proof of authenticated editing |
| Password keyboard accessibility | **Diagnostic in development** | Reports only whether field is labelled, keyboard-focusable, focused on open, or within a declared ARIA modal; results do not automatically alter HTML |

The confirmed no-login checks come from the dedicated [editor prototype Chrome run](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42261782068) on the original, disposable site snapshot. The exact full editor suite for subsequent changes must still be checked. The page is opened privately on a loopback-only local server with remote requests blocked.

## Still required before administrator feature acceptance

1. **Keyboard and modal review:** inspect accessibility observations; do not quietly change the original login design or weaken access control.
2. **Legitimate administrator acceptance:** only with CosmicCuddle's explicit authorization, test authenticated entry in a safe, isolated environment. Do not store, log, request in GitHub comments or embed any credential in test code or fixtures.
3. **One original resource edit:** exercise editing of a title and multiline content through the *actual original* administrator UI; compare exact hashes and check all 413 unrelated resources remain untouched.
4. **Custom data preservation:** inspect preservation of every original resource field and association, all original 27 direct DATA members and the separate 29-item side collection; don't reduce the scope to the 414-item main array.
5. **Other admin capabilities:** verify original create/edit/remove and navigation or management controls according to their existing intended permissions, using fictional disposable records and explicit approval for any destructive operation.
6. **Independent restoration:** retain a *separate complete* source/asset/Git backup; restore it successfully somewhere else; prove the rollback procedure before any production-level writer or migration.
7. **Repeatable version-safe saves:** test two successive edits, conflict refusal from older drafts, hard failure on unknown/unsafe paths and exact complete-site compatibility. Do not allow silent rebases or automatic loss of existing editor drafts.
8. **Desktop/mobile and asset parity:** test real keyboard focus paths, custom images, media, search, page navigation, original Game Clients administrator states and non-invasive layout fidelity.
9. **Owner release decision:** CosmicCuddle must first approve the canonical 415-file overlay versus 418-file source tree, the real writing path, rollback and any merge or publication. PR #56 remains a draft until those decisions.

## Current restriction

This development branch has **no approved live GitHub save transaction**, no authenticated admin test, and no owner-approved canonical resource layout. A browser showing the password panel is **not** a passed administrator Save/Restore test. Do not change the live website, original server settings, external forms or public assets to satisfy a prototype test.
