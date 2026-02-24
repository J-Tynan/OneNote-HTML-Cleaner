# TODO

All project TODO items are tracked here. Please do not leave TODO comments in source files — add or update entries in this file instead.

This file was merged with `TODOs.md` to keep a single canonical task list for the project.

---

## Recent Success

- [x] PWA conversion test with `Test File.mht` passed — ready to commit (2026-02-20)
 - [x] In-app Help popup and keyboard shortcut added (2026-02-20)

- [x] Convert-button end-to-end smoke test added: `Tests/convert-button-smoke-playwright.js` (2026-02-24)

- Apply changes in small, isolated batches.
- After each batch:
  - Convert a known‑good `.mht` fixture.
  - Confirm status reaches “Done” and a download link appears.
- Do not introduce new logging helpers without defining them first.
- Prefer removing optional diagnostics over risking runtime instability.

---


- [ ] Keep scope centered on browser‑first parsing + conversion of MHTML to clean modern HTML.
- [ ] Prioritize extraction fidelity and HTML structure before UI polish or advanced features.
- [ ] Explicitly defer `.one` and `.onepkg` structural parsing to a later milestone so the first stable release ships on the reliable MHTML path.

Note: MHTML → modern HTML pipeline is nearing completion (core transforms and formatting largely implemented).


## Prioritized PWA / Worker Tasks (highest first)


- [x] Add explicit worker handshake (`ready` / `init`)
  - Worker posts `{ type: 'ready' }` after init.
  - Wrapper buffers messages until handshake completes.

- [x] Move import‑time side‑effects into explicit `init()`
  - MHT‑only refactor implemented.
  - Full audit and native importer migration deferred.
- [x] Remove `debugWorker()` references from codebase
  - `debugWorker` is deprecated and must not be reintroduced during PWA rebuild.
  - Worker diagnostics should use structured `postDiagnostic()` messages only.
  - Repository‑wide search confirmed no runtime callsites remain.
 - [x] Add cache‑update / service‑worker unregister guidance and automation
  - Implemented: worker files included in precache; `SKIP_WAITING` message handler added; activation handler deletes old caches and calls `clients.claim()`.

- [x] Harden message id / callback handling and diagnostics
  - Wrapper issues its own UUID for every payload and tracks caller-supplied ids.
  - Detect duplicate responses, log unmatched messages, and record pending callback counts.
  - Diagnostics use a structured `__diag__` schema; tests ensure conformance.
  - Added Playwright/unit tests (`worker-duplicate-response`, `worker-unmatched-message`, `diagnostic-schema`) and extended existing tests.

- [x] Phase A: Add `createLogger()` helper and compatibility exports (done 2026-02-24)
  - Uses existing human-readable prefixes; non-breaking.
  - Included `Tests/logging-interface.js` to verify behaviour.
  - TODO: migrate modules to use the new API.
- [x] Phase B: Replace direct `logInfo`/`console.*` calls in UI, wrapper, worker and pipelines
  - Modules updated: `src/ui.js`, `src/worker-wrapper.js`, `src/worker.js`, `src/app.js`, pipeline files, worker-globals, ui-downloads.
  - All console logging replaced with structured human-readable logger.
  - Tests run after migration to confirm no regressions.

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

  - Confirm no work is dispatched before `{ type: 'ready' }`.
  - Re‑run handshake Playwright test (`Tests/worker-init-playwright.js`): PASS

2. Restore and validate MHTML‑only PWA flow (done 2026-02-20)
  - Converted known‑good `.mht` fixture and confirmed download link and ZIP export.

3. Re‑apply UI features incrementally — completed (2026-02-20)
  - Unsupported‑file handling.
  - Auto‑convert opt‑out.
  - Test conversion after each step.
4. Quick win: Tweak Dark theme colours (UI) - completed (2026-02-20)
   - Owner: `design/frontend` — Estimated time: 30–60 minutes
   - Quick checklist:
     1. Review `styles.css` dark variables and adjust `--bg-*`, `--text-*`, and CTA tokens as needed.

---

## Next milestone (MHTML release)

1. Harden the MHTML‑to‑HTML pipeline against fixtures and metadata scenarios.
2. Expand targeted fixture tests for MHTML edge cases (tables, lists, whitespace, inline resources).
3. Verify toolbar/config behavior remains stable for the MHTML flow and document acceptance gates.

---

## General / UI

- [ ] Review cleaned HTML output (manual review).
  - [ ] (manual review pending)
    - [ ] Address contrast violations in exported HTML (`color-contrast` on <pre> elements) by normalizing or removing problematic inline styles (pipeline update)
- [x] Prevent layout shift when Advanced options open by reserving scrollbar gutter (2026-02-22)
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
    - [x] Add Playwright smoke test `Tests/convert-button-smoke-playwright.js` (Step 3)
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
    - [x] Verify changes with visual QA and Playwright smoke tests.
      - Playwright smoke tests added: `Tests/ui-phase1-theme.spec.js`, `Tests/ui-phase1-convert-tooltip.spec.js` — both passed locally.

    Acceptance criteria:
    - Convert tooltip appears on hover/focus when `auto-convert` is enabled and `Convert` is disabled.
    - Primary and secondary buttons show rounded corners, stronger contrast, and consistent padding across app.

    Phase 2 — Light Theme Variants
    - [ ] Add testing dropdown in header (`light-theme-variant`) with 7–8 Light theme choices (e.g. `Light Default`, `Warm`, `High Contrast`, `Muted`).
    - [ ] Implement variant CSS for tokens used in exported HTML if required.
    - [ ] Run visual QA and automated tests to ensure exported HTML remains stable.

    Acceptance criteria:
    - Selecting a Light theme variant updates the UI immediately and persists choice during the session.

    Phase 3 — Dark Theme Variants
    - [ ] Add testing dropdown in header (`dark-theme-variant`) with 7–8 Dark theme choices (e.g. `Dark Default`, `Blue Tint`, `Mono`, `High Contrast`).
    - Selecting a Dark theme variant updates the UI immediately and persists choice during the session.

    Notes and rollout
    - Each phase is self-contained: implement the testing dropdown and CSS hooks first, then create the 3–4 variants, then test.
    - The dropdowns are temporary (testing-only) UI elements and will be removed after a variant is selected for final adoption.
    - Keep changes small and verifiable; run the smoke test checklist after each variant addition.

    Suggested next tasks (short term)
    - [ ] Implement Phase 1 dropdown and basic `.btn` token support.
    - [x] Add tooltip behavior for `Convert` when `auto-convert` is ON.

    ---



1. Structured `.one` parser to replace heuristic extraction.
2. Embedded resource mapping for images and attachments.


## Quality + validation

- [x] Add smoke checks for native output.
- [x] Define acceptance criteria for content fidelity.
- [x] Add ZIP and download UI tests.
- [x] Add Playwright smoke test for theme toggle and persistence.
- [x] Add Playwright smoke test for auto‑convert (2026-02-20) and unsupported‑file flows.

---

## Product / docs follow‑up

- [ ] Document current native limitations and expected fidelity.
- [ ] Decide on in‑browser decoder vs companion‑tool workflow.
- [ ] Polish page naming for GUID‑like titles.

---

## Encoding fixes — Option A (priority)

Fix mojibake and charset issues observed in converted exports. Follow a small, test-driven plan so changes are reversible and safe for the PWA.

- [ ] Investigate MHT part `Content-Type` headers and current decoding behavior.  
 - [ ] Investigate MHT part `Content-Type` headers and current decoding behavior.
 - [x] Discovery logging and CP1252 fallback prototyped (2026-02-23) — changes reverted to the stable pipeline; commit(s) saved in repository history.
 - [x] Map decoded string indices back to original MHT offsets for diagnostics (2026-02-23)
 - [x] Implement charset-aware decoding (UTF-8 → CP1252 fallback) — prototyped and validated in local tests (2026-02-23)
 - [x] Add unit/regression tests that cover CP1252, UTF-8, and missing-charset scenarios (use fixtures).
 - [ ] Re-run conversion and Playwright export audits; verify no new regressions and that mojibake is resolved.

Notes: prefer discovery logging first (non-invasive) before applying decoding changes to avoid surprising the PWA; I will proceed only after you approve Step 1.

---

## Sanitization, Quality & Encoding (recommended)

These follow-ups address artifacts, control characters, accessibility, and output size issues found in exported HTML. Prioritize the control-character fix first (high severity).

- **Sanitization tasks**
  - [ ] Add a pipeline sanitizer that removes Office/Word/OneNote artifacts (`xmlns:o`, `Main-File`/`File-List` links, `mso-*` spans/attributes, `mso-spacerun`, `class` tokens injected by Office) during conversion.
  - [ ] Remove obsolete attributes left by conversion (e.g. `summary` on `table`, legacy `xmlns` values) or normalize them to modern equivalents.
  - [ ] Normalize or collapse repetitive inline font/size/style attributes into a minimal stylesheet or atomic utility classes to reduce output size and duplicated markup.

- **Encoding & control characters**
  - [x] Add a decode-time detection for C0 control characters (U+0000..U+001F excluding TAB/LF/CR). Log file, part, and byte offsets when found.
  - [ ] Add unit/regression tests that assert exported HTML contains no C0 control characters; fail CI if they appear.
  - [ ] If decoding improvements remove characters safely, implement refined `decodeBytes` / `needsFallback` logic on a feature branch and re-run regression tests.
  - [x] If decoding cannot fully eliminate a small set of control codepoints, add a minimal sanitization/normalization step immediately prior to JSON serialization that only removes or replaces the problematic codepoints (document why).

- **Accessibility & semantics checks**
  - [ ] Add a smoke test asserting a valid heading hierarchy (exactly one page-level `h1`, then appropriate `h2`/`h3` ordering).
  - [ ] Assert presence of a `main` landmark and one page-level `lang` attribute (choose a single `lang` and remove spurious `lang` values on inline elements).
  - [ ] Verify that non-decorative images have `alt` text and add tests to catch inline images lacking `alt`.
  - [ ] Add a test to detect table-based layout patterns left unnecessarily, and flag pages for manual review if excessive layout tables are present.

- **Performance / output size**
  - [ ] Add a rule to warn or reject exported HTML that inlines images larger than a configured threshold (e.g., 50 KB), to avoid bloated outputs.
  - [ ] Add a lint/check that flags excessive inline styles (e.g., pages with > N inline style attributes) for further optimization.

- **Regression fixtures**
  - [ ] Add the problematic `.mht` fixtures (`Resolve merge conflicts`, `Communicate using Markdown`, etc.) to an encoding regression suite with locked expected outputs so fixes are covered by CI.

These tasks are intended to be conservative and test-driven: implement detection and logging first, then propose small, reversible sanitization changes with regression coverage.

---

## New: List duplication bug (high priority)

- Description: After applying the charset-fallback changes, some converted HTML files in [Tests/Cleaned](Tests/Cleaned) show duplicated bullet points or extra list markers (single lists sometimes render with one extra bullet, some lists show double bullets).
- Repro: Converted `*.mht` files in `Tests/Cleaned` contain the regression; user tested PWA conversions and provided the samples.
- Impact: Visual layout and semantics of lists are affected; accessibility and content fidelity may regress.

### Tasks
 [x] Investigate cause of list duplication (decode/mapping → HTML transform) — reproduced locally using `Tests/Cleaned` fixtures.
 [x] Create focused unit/regression test(s) asserting list markup fidelity for problem fixtures.
 [x] Implement minimal pipeline fix (non-destructive): stripped explicit bullet glyphs and collapsed trivial nested lists in the sanitizer.
 [x] Run full regression suite and review output in `Tests/Cleaned` — regression test(s) pass and cleaned HTML saved.
 [x] Document the root cause and fix in `README.md` and release notes.

 Note: The cleaned outputs for the affected fixtures have been placed in `Tests/Cleaned` and the focused regression test confirms the list-duplication regression is resolved. Please review and commit when ready.