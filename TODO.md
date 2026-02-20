# TODO

All project TODO items are tracked here. Please do not leave TODO comments in source files — add or update entries in this file instead.

This file was merged with `TODOs.md` to keep a single canonical task list for the project.

---

## Recent Success

- [x] PWA conversion test with `Test File.mht` passed — ready to commit (2026-02-20)
 - [x] In-app Help popup and keyboard shortcut added (2026-02-20)

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
  - Added `scripts/bump-sw-cache.cjs` (preview/apply cache-name bump) and `Tests/sw-bump.js` unit test. See `docs/Service-Worker-Updates.md` for usage.

- [ ] Harden message id / callback handling and diagnostics
  - Log unmatched messages with timestamp and summary.
  - Add reserved diagnostics channel.
  - Improve error summaries for payloads and failures.

- [ ] Standardize logging formats across UI, wrapper, and worker
  - Use consistent prefixes: `[ui]`, `[worker-wrapper]`, `[worker]`.
  - Logging helpers must be defined before use, gated behind flags, and guaranteed not to throw.
  - Prefer structured summaries (`id`, `type`, `size`, `timestamp`) for correlation.

- [ ] Tidy Node test warnings
 - [x] Tidy Node test warnings (2026-02-20)
  - Added `"type": "module"` to `package.json` and converted test entry points to ESM where safe; renamed CommonJS configs/scripts to `.cjs` to maintain compatibility.
  - Remove `MODULE_TYPELESS_PACKAGE_JSON` warnings.

- [ ] Standardize test output formatting
  - Ensure tests print `Result: PASS` / `Result: FAIL` consistently.

- [ ] Run tests after changes and collect logs
 - [x] Run tests after changes and collect logs (2026-02-20)
  - Re‑ran native and Playwright smoke tests locally; smoke suite passed.
  - Archived test run outputs for verification.

---

## Tomorrow’s focus (start here)

Begin with the smallest, highest‑impact items to unblock diagnostics and releases.

1. Verify worker handshake and init ordering — completed (2026-02-20)
  - Confirm no work is dispatched before `{ type: 'ready' }`.
  - Re‑run handshake Playwright test (`Tests/worker-init-playwright.js`): PASS

2. Restore and validate MHTML‑only PWA flow (done 2026-02-20)
  - Converted known‑good `.mht` fixture and confirmed download link and ZIP export.

3. Re‑apply UI features incrementally — completed (2026-02-20)
  - Theme system.
  - Unsupported‑file handling.
  - Auto‑convert opt‑out.
  - Test conversion after each step.

4. Quick win: Tweak Dark theme colours (UI) - completed (2026-02-20)
   - Owner: `design/frontend` — Estimated time: 30–60 minutes
   - Quick checklist:
     1. Review `styles.css` dark variables and adjust `--bg-*`, `--text-*`, and CTA tokens as needed.
     2. Verify `tailwind.config.cjs` dark mode strategy (`darkMode: 'class'`) and `src/theme.js` toggle behavior.
     3. Run the app, toggle theme, and confirm contrast and button states visually and with the existing Playwright theme test.


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
 - [x] Add in-app Help popup (Help button + modal) (2026-02-20)
  - [x] Add Light/Dark theme toggle and polish dark mode.
  - [x] Add auto‑convert checkbox in Advanced options and persist setting.
  - [x] Hide auto‑convert notice when auto‑convert is disabled.
  - [x] Detect and mark unsupported file types (MHTML‑only release) and prevent processing.

 - [ ] Add Convert button (manual-trigger for queued conversions)
   - Location: `index.html` Import panel (below `Download ZIP`)
   - Acceptance criteria:
     - `Convert` is visible at all times in the Import panel (below `Download ZIP`).
     - `Convert` is **disabled** when `auto-convert` is ON; becomes **enabled** when `auto-convert` is OFF and at least one supported file is queued.
     - Clicking `Convert` processes all queued, supported files (uses existing `processEntry()`), updates statuses, and produces downloadable output.
   - Subtasks:
     - [x] Add `convertButton` markup to `index.html` (Step 1)
     - [x] Implement `processQueue()` and `updateConvertButton()` in `src/ui.js` (Step 2)
     - [x] Wire event handler in `bindEvents()` and ensure `updateConvertButton()` is called from `renderFileList()` and `setAutoConvertEnabled()` (Step 2)
     - [x] Add Playwright smoke test `Tests/auto-convert-manual-playwright.js` (Step 3)
     - [x] Update `README.md` with manual convert instructions (Step 3)

   - [x] Add tooltip behavior for `Convert` when `auto-convert` is ON.
         between themes at runtime when opened in a browser.
       - Default export uses Light theme; enabling Dark is opt-in in Advanced options.
       - Feature must be optional and not change existing exported markup when disabled.
       - Keep the implementation small, dependency-free, and non-throwing.

    ## UI Polish — Phased Plan (testing-first dropdowns)

    To avoid scope creep and maintain safety, UI polish will be implemented in three separate phases. Each phase will provide 3–4 testable variants exposed via a temporary, testing-only dropdown in the header. Changes are immediate when a variant is selected so designers and engineers can compare quickly.

    Phase 1 — Update UI Styling (Controls, Buttons, Spacing)
 - [x] Add testing dropdown in header (`ui-style-variant`) with 3–4 variant presets; dropdown has been removed after variant selection.
 - [x] Implement stylesheet tokens and base `.btn` updates used by the variants (`--radius-md`, `--btn-padding-x`, `--btn-shadow`).
    - [ ] Verify changes with visual QA and Playwright smoke tests.

    Acceptance criteria:
    - Convert tooltip appears on hover/focus when `auto-convert` is enabled and `Convert` is disabled.
    - Primary and secondary buttons show rounded corners, stronger contrast, and consistent padding across app.

    Phase 2 — Light Theme Variants
    - [ ] Add testing dropdown in header (`light-theme-variant`) with 3–4 Light theme choices (e.g. `Light Default`, `Warm`, `High Contrast`, `Muted`).
    - [ ] Implement variant CSS for tokens used in exported HTML if required.
    - [ ] Run visual QA and automated tests to ensure exported HTML remains stable.

    Acceptance criteria:
    - Selecting a Light theme variant updates the UI immediately and persists choice during the session.
    - Exported/converted HTML is unchanged unless explicitly requested by the variant.

    Phase 3 — Dark Theme Variants
    - [ ] Add testing dropdown in header (`dark-theme-variant`) with 3–4 Dark theme choices (e.g. `Dark Default`, `Blue Tint`, `Mono`, `High Contrast`).
    - [ ] Implement dark-theme token overrides and ensure focus/contrast rules are preserved.
    - [ ] Run visual QA and tests (including Playwright theme tests) to validate contrast and accessibility.

    Acceptance criteria:
    - Selecting a Dark theme variant updates the UI immediately and persists choice during the session.
    - Contrast ratios meet accessibility minimums for interactive controls.

    Notes and rollout
    - Each phase is self-contained: implement the testing dropdown and CSS hooks first, then create the 3–4 variants, then test.
    - The dropdowns are temporary (testing-only) UI elements and will be removed after a variant is selected for final adoption.
    - Keep changes small and verifiable; run the smoke test checklist after each variant addition.

    Suggested next tasks (short term)
    - [ ] Implement Phase 1 dropdown and basic `.btn` token support.
    - [ ] Add tooltip behavior for `Convert` when `auto-convert` is ON.
    - [ ] Add Playwright checks for tooltip + variant selection persistence.

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
- [x] Add Playwright smoke test for auto‑convert (2026-02-20) and unsupported‑file flows.

---

## Product / docs follow‑up

- [ ] Document current native limitations and expected fidelity.
- [ ] Decide on in‑browser decoder vs companion‑tool workflow.
- [ ] Polish page naming for GUID‑like titles.