# Stage 6 — private interrupted Save and recovery rehearsal

**Status: test-only / unapproved (6 November 2026).** No active GitHub Save button, merge, deployment or approved resource-source layout.

The new editor/tools/rehearse-private-generation-switch.cjs reuses the existing verified **414 physical resource fragments**, manifest, exact original website and source-bound **three-file proposed package**. It rehearses a fictional one-resource edit in newly created OS-private folders. All generated files are deleted after the test.

The trial keeps two fully verified versions: **g0** contains the original site; **g1** contains a reconstructed website. Three proposed files (one resource fragment, the version manifest and regenerated complete site-content.html) are compared to the reviewed package. All 413 unrelated fragments are required to remain byte-identical. A temporary local CURRENT.json pointer identifies the selected generation.

It injects four scenarios:

1. **Partially written version:** Changing a fragment without its manifest fails verification. The original stays active.
2. **Interrupted before selection:** A complete candidate is prepared, but an injected interruption leaves the original selected.
3. **Acknowledgement lost after selection:** The new source is already selected; the trial checks which generation really became current rather than treating an error as a failed Save.
4. **Stale second attempt:** An older session cannot replace the new selected version. A separate, explicit private-only recovery restores the independently verified original.

**Limits:** The local same-directory file rename is NOT a real GitHub compare-and-swap, cross-process concurrency proof, power-loss durability guarantee or verified production rollback. A real GitHub restoration would need a new reviewed source commit, owner approval and an independently retained backup, not rewriting history. The 415/418 candidate resource layouts remain unapproved. Authenticated Admin editing and actual Save/Restore are still not implemented.

This code affects only temporary development tests. It neither modifies the published pages, original site-content.html, resource objects, separate 29-item collection, administrator functions nor the production Git branch.
