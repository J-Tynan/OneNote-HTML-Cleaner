# TODO

All project TODO items are tracked here. Please do not leave TODO comments in source files — add or update entries in this file instead.

This file was merged with `TODOs.md` to keep a single canonical task list for the project.

---

## Rebuild safety rules (PWA)

When restoring from a known‑good build and re‑applying changes:

- Apply changes in small, isolated batches.
- After each batch:
  - Reload the PWA.
  - Convert a known‑good `.mht` fixture.
  - Confirm status reaches “Done” and a download link appears.
- Do not introduce new logging helpers without defining them first.
- Logging must never be able to throw or block worker execution.
- Prefer removing optional diagnostics over risking runtime instability.

---

## Current focus (PWA first)

- [ ] Keep scope centered on browser‑first parsing + conversion of MHTML to clean modern HTML.
- [ ] Prioritize extraction fidelity and HTML structure before UI polish or advanced features.
- [ ] Treat optional native helper tooling (WASM/CLI) as support work, not the main product surface.
- [ ] Explicitly defer `.one` and `.onepkg` structural parsing to a later milestone so the first stable release ships on the reliable MHTML path.

Note: MHTML → modern HTML pipeline is nearing completion (core transforms and formatting largely implemented).

---

## Prioritized PWA / Worker Tasks (highest first)

These tasks were identified from recent debugging and are ordered by priority for PWA and worker hardening.

- [x] Add explicit worker handshake (`ready` / `init`)
  - Worker posts `{ type: 'ready' }` after init.
  - Wrapper buffers messages until handshake completes.
  - Playwright handshake test added.

- [x] Move import‑time side‑effects into explicit `init()`
  - MHT‑only refactor implemented.
  - Full audit and native importer migration deferred.

- [x] Remove `debugWorker()` references from codebase
  - `debugWorker` is deprecated and must not be reintroduced during PWA rebuild.
  - Worker diagnostics should use structured `postDiagnostic()` messages only.
  - Repository‑wide search confirmed no runtime callsites remain.

 - [x] Add cache‑update / service‑worker unregister guidance and automation
  - Implemented: worker files included in precache; `SKIP_WAITING` message handler added; activation handler deletes old caches and calls `clients.claim()`.
  - Added `scripts/bump-sw-cache.js` (preview/apply cache-name bump) and `Tests/sw-bump.js` unit test. See `docs/Service-Worker-Updates.md` for usage.

- [ ] Harden message id / callback handling and diagnostics
  - Log unmatched messages with timestamp and summary.
  - Add reserved diagnostics channel.
  - Improve error summaries for payloads and failures.

- [ ] Standardize logging formats across UI, wrapper, and worker
  - Use consistent prefixes: `[ui]`, `[worker-wrapper]`, `[worker]`.
  - Logging helpers must be defined before use, gated behind flags, and guaranteed not to throw.
  - Prefer structured summaries (`id`, `type`, `size`, `timestamp`) for correlation.

- [ ] Tidy Node test warnings
  - Add `"type": "module"` to `package.json` if safe.
  - Remove `MODULE_TYPELESS_PACKAGE_JSON` warnings.

- [ ] Standardize test output formatting
  - Ensure tests print `Result: PASS` / `Result: FAIL` consistently.

- [ ] Run tests after changes and collect logs
  - Re‑run native and Playwright smoke tests.
  - Archive logs for rollout verification.

---

## Tomorrow’s focus (start here)

Begin with the smallest, highest‑impact items to unblock diagnostics and releases.

1. Verify worker handshake and init ordering
   - Confirm no work is dispatched before `{ type: 'ready' }`.
   - Re‑run handshake Playwright test.

2. Restore and validate MHTML‑only PWA flow
   - Convert known‑good `.mht` fixture.
   - Confirm download link appears and ZIP export works.

3. Re‑apply UI features incrementally
   - Theme system.
   - Unsupported‑file handling.
   - Auto‑convert opt‑out.
   - Test conversion after each step.

4. Quick win: Tweak Dark theme colours (UI)
   - Owner: `design/frontend` — Estimated time: 30–60 minutes
   - Quick checklist:
     1. Review `styles.css` dark variables and adjust `--bg-*`, `--text-*`, and CTA tokens as needed.
     2. Verify `tailwind.config.js` dark mode strategy (`darkMode: 'class'`) and `src/theme.js` toggle behavior.
     3. Run the app, toggle theme, and confirm contrast and button states visually and with the existing Playwright theme test.

    5. Implement Dark theme variants in CSS (Option B) — Owner: `design/frontend` — Status: in-progress
      - Estimated time: 30–60 minutes (initial blocks)
      - Quick checklist:
        1. Add `html.dark[data-variant="<name>"] { ... }` blocks to `styles.css` for 3–4 variants.
        2. Wire the test dropdown to toggle `document.documentElement.dataset.variant` (next step).
        3. Verify style changes when variant is selected and persist `themeVariant` in `localStorage` if desired.

---

## Next milestone (MHTML release)

1. Harden the MHTML‑to‑HTML pipeline against fixtures and metadata scenarios.
2. Expand targeted fixture tests for MHTML edge cases (tables, lists, whitespace, inline resources).
3. Verify toolbar/config behavior remains stable for the MHTML flow and document acceptance gates.

---

## General / UI

- [ ] Review cleaned HTML output (manual review).
- [ ] Audit accessibility of outputs.
- [x] Add badge icons and compact view improvements.
- [x] Redesign UI to look professional and accessible.
  - [x] Add Light/Dark theme toggle and polish dark mode.
  - [x] Add auto‑convert checkbox in Advanced options and persist setting.
  - [x] Hide auto‑convert notice when auto‑convert is disabled.
  - [x] Detect and mark unsupported file types (MHTML‑only release) and prevent processing.

---

## Conversion / Features

- [x] Implement optional injected output toolbar (self‑contained inline bundle).
- [x] Process entire notebooks to hierarchical folder ZIPs.
- [x] Run browser validation and smoke tests.
- [x] Enforce MHTML‑only intake at UI layer and surface “Unsupported” for other formats.

---

## Future native import milestone (post‑stable)

1. Structured `.one` parser to replace heuristic extraction.
2. Embedded resource mapping for images and attachments.
3. Structured warning diagnostics with backward compatibility.
4. `.onepkg` deep extraction expansion.
5. Targeted fixture tests for native edge cases.

---

## Quality + validation

- [x] Add regression fixtures for native parsing.
- [x] Add smoke checks for native output.
- [x] Define acceptance criteria for content fidelity.
- [x] Add metadata propagation regression tests.
- [x] Add warning‑code contract tests.
- [x] Add ZIP and download UI tests.
- [x] Add Playwright smoke test for theme toggle and persistence.
- [ ] Add Playwright smoke test for auto‑convert and unsupported‑file flows.

---

## Product / docs follow‑up

- [ ] Document current native limitations and expected fidelity.
- [ ] Decide on in‑browser decoder vs companion‑tool workflow.
- [ ] Polish page naming for GUID‑like titles.