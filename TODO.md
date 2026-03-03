# TODO

All project TODO items are tracked here. Please do not leave TODO comments in source files — add or update entries in this file instead.

This file was merged with `TODOs.md` to keep a single canonical task list for the project.

---

## Recent Success

- [x] PWA conversion test with `Test File.mht` passed — ready to commit (2026-02-20)
- [x] In-app Help popup and keyboard shortcut added (2026-02-20)
- [x] Convert-button end-to-end smoke test added: `Tests/convert-button-smoke-playwright.js` (2026-02-24)
 - [x] Run local MHT conversion tests and regenerate `Tests/Cleaned` (2026-02-25)
 - [x] Populate missing converted fixtures used by native smoke suite (local-only) (2026-02-25)

- [x] Centralize fixture discovery and add `Tests/fixtures.js` (2026-03-02)
- [x] Sanitizer: unwrap malformed list wrappers to prevent synthetic top-level bullets (2026-03-02)
- [x] Sanitizer: align small standalone icon-only paragraphs to dominant table-cell inset (2026-03-02)
- [x] Tests: add `Tests/list-structure-normalization.unit.js` and update `Tests/direction-layout-normalization.unit.js` (2026-03-02)
- [x] Chore: update `.gitignore` to ignore large test binaries/screenshots (2026-03-02)

---

## Fixture Handling Policy

- The `Tests/Cleaned/` directory contains generated HTML and is intentionally **not** checked in.
- Regenerate these files locally using `npm run tools:regen-cleaned` (or `node tools/regenerate-cleaned.js`).
- After regeneration, run smoke/regression tests (`npm run test:gate:native`).
- Update `Tests/expected/native-regression.json` when adding/removing `.mht` inputs.

(This policy keeps large artifacts out of source control and ensures developers rebuild them on demand.)

---

## Rebuild & Change Safety Rules (PWA)

- Apply changes in small, isolated batches.
- After each batch:
  - Convert a known‑good `.mht` fixture.
  - Confirm status reaches “Done” and a download link appears.
- Do not introduce new logging helpers without defining them first.
- Prefer removing optional diagnostics over risking runtime instability.
- Logging must never throw or block worker execution.

---

## Project Scope (locked for first stable release)

- [ ] [P1] Keep scope centered on browser‑first parsing + conversion of MHTML to clean modern HTML.
- [ ] [P1] Prioritize extraction fidelity and HTML structure before UI polish or advanced features.
- [ ] [P1] Explicitly defer `.one` and `.onepkg` structural parsing to a later milestone.

Note: MHTML → modern HTML pipeline is nearing completion (core transforms and formatting largely implemented).

---

## HTML Output Standard Compliance (release‑blocking)

Derived from `docs/HTML-Output-Standard.md`.  
All items in this section must be satisfied before tagging the first stable release.

### Document structure
- [x] Assert exactly one `<main>` element per exported document.
- [x] Assert exactly one page-level `<h1>` per document.
- [x] Add regression test enforcing valid heading order (`h1 → h2 → h3`).
- [x] Assert lists are represented only with `<ul>/<ol>/<li>` (no glyphs)

- [x] Add CI check asserting no `mso-*` attributes appear in output. (2026-02-25)
- [x] Assert no Office/OneNote namespaces (`xmlns:o`, `xmlns:v`, `xmlns:w`) remain. (2026-02-25)
- [x] Assert no deprecated elements (`font`, `center`, `strike`) are emitted. (2026-02-25)
- [x] Assert no deprecated attributes (`bgcolor`, `align`, `border`, `summary`) remain. (2026-02-25)

### Attributes & styling
- [x] Normalize or remove repetitive inline styles introduced by conversion. (2026-02-26)
- [x] Add regression test asserting sanitizer idempotence. (2026-02-25)
- [x] Ensure visual fidelity does not rely on authoring‑tool‑specific styles. (2026-02-26)

### Encoding & character safety
- [x] Assert exported HTML is UTF‑8 encoded. (2026-02-26)
- [x] Add CI test asserting no C0 control characters appear in output.
- [x] Lock charset fallback behavior behind tests and documentation. (2026-02-26)

### Accessibility baseline
- [x] Assert presence of `<main>` landmark.
- [x] Assert exactly one page-level `<h1>`.
- [x] Add test asserting non-decorative images include `alt` text.

### Stability guarantees
- [x] Assert sanitization is idempotent. (2026-02-25)
- [x] Assert re‑running conversion on the same input produces equivalent output. (2026-02-25)
- [x] Lock cleaned fixtures for regression comparison. (2026-02-25)

---

## Prioritized PWA / Worker Tasks (completed)

- [x] Add explicit worker handshake (`ready` / `init`)
- [x] Move import‑time side‑effects into explicit `init()`
- [x] Remove `debugWorker()` references from codebase
- [x] Add cache‑update / service‑worker unregister automation
- [x] Harden message id / callback handling and diagnostics
- [x] Introduce structured logger and migrate all modules
- [x] Tidy Node test warnings
- [x] Run tests after changes and archive logs

---

## Next Milestone — MHTML Release
## Post‑Release Roadmap (v1.x) The following items are explicitly deferred until after the first stable release. They are exploratory or additive features that build on the now‑stable HTML pipeline.

1. Harden MHTML‑to‑HTML pipeline against edge‑case fixtures.
2. Expand targeted fixture tests (tables, lists, whitespace, inline resources).
3. Verify toolbar/config behavior remains stable and document acceptance gates.

---

## General / UI

- [x] Manual review of cleaned HTML output. (2026-02-26)
  - Findings captured in `Tests/reports/manual-review-findings.md`.
- [x] Prevent layout shift when Advanced options open.
- [x] Redesign UI to look professional and accessible.
- [x] Add in‑app Help popup and keyboard shortcut.
- [x] Add Light/Dark theme toggle.
- [x] Add auto‑convert opt‑out and persistence.
- [x] Detect and mark unsupported file types.
- [x] [P1] Add small indentation to lists (bullet, numbered). (2026-03-01)
- [x] [P1] Move to a single OneNote parity-first conversion method (retire profile branching in UI/config). (2026-03-02)
- [x] [P1] Loosen tight left margin on converted-page content for better OneNote visual parity. (completed 2026-03-02)
- [x] [P2] Fix PWA header bar right-edge gap so the header background extends flush to the full viewport width. (2026-03-02)
- [x] [P2] Add responsive Playwright coverage to assert header bar edge-to-edge rendering on desktop and mobile viewports. (2026-03-02)

### Outstanding Visual Tasks

- [ ] Tune left-margin for handwriting-heavy pages (`Test Handwriting.html`) — currently wider than ideal; requires layout heuristic adjustments and regression fixtures.
- [ ] Implement Converted-Page Theme Toggle (HTML only): add UI option, inject toggle into converted pages, support OLED-black option, and add Playwright smoke tests.
- [ ] Externalized CSS review follow-up: audit generated CSS, consolidate over-generated selectors, and add visual regression checks to ensure parity with embedded-style baseline.
- [ ] Polish exported page naming: replace GUID-like titles with a deterministic, readable naming strategy for downloads/archives.

---

## Toolbar Edit Controls

- [x] Add Undo button to row of formatting tools (2026-03-03)
- [x] Split heading control into H1–H4 buttons for explicit block styles (2026-03-03)
- [x] Rename Hyperlink button to Link while keeping the dual-prompt flow (2026-03-03)
- [x] Toggle Bold/Italic/Heading buttons on double-clicks and enforce heading exclusivity (2026-03-03)

**Immediate Next Priority**
- **Add guardrail for oversized inlined images (P2):** Prevent very large embedded images from forcing layout/margin regressions and from inflating exported artifacts. Recommended next step: add a size threshold, surface a warning in CLI/PWA, and add regression tests. (proposed 2026-03-02)

**Notes / Deferred items**
- `Test Handwriting.html` left-margin remains wider than ideal on some handwriting/image-heavy pages; after tuning the baseline heuristic we applied a conservative exception, but this fixture still shows a visual gap. We'll accept this as deferred for now and revisit with a dedicated handwriting/ink handling task (see Experimental handwriting conversion). (noted 2026-03-02)

### Manual Convert Button
- [x] Convert button implemented and tested.
- [x] Disabled when auto‑convert is ON.
- [x] Tooltip shown when disabled.
- [x] Playwright smoke test added.
- [x] README updated.

### Experimental handwriting conversion
- [x] [P2] Add handwriting fixtures (OneNote pages with ink) to regression suite. (2026-03-03)
- [x] [P2] Implement ink detection in pipeline: detect `<svg>`, VML, `<canvas>`, and raster `<img>` cases. (2026-03-03)
- [x] [P2] If only raster found, preserve image, replace alt-text with appropriate wording and add data-handwriting="raster" metadata. (2026-03-03)
- [x] [P2] Add accessibility labels for handwriting assets. (2026-03-03)
- [x] [P2] Document handwriting export behavior. (2026-03-03)
  - Handwriting is preserved as raster images when exported from OneNote.
  - Output depends on OneNote theme at export time.
  - Vector ink is not available via MHTML.
  - Future enhancements may include optional vectorization.

---

### Markdown Export — Semantic Fidelity (post‑release)

Goal: Provide high‑quality, structure‑first Markdown exports suitable for long‑term
knowledge bases and note‑taking tools. Visual parity with OneNote is not a goal.

Design principles:
- Semantic fidelity over visual layout.
- Deterministic, renderer‑agnostic output.
- One shared semantic conversion core with thin flavor adapters.
- No inline HTML unless strictly necessary.

Initial scope:
- Headings, paragraphs, lists, tables, code blocks, images.
- Flatten free‑form layout and absolute positioning.
- Preserve document hierarchy and reading order.

#### Core Markdown conversion (shared)

- [x] [P2] Define a semantic Markdown intermediate representation (IR) derived from cleaned HTML. (2026-03-03)
- [x] [P2] Implement HTML → Markdown core conversion using the IR (structure‑first). (2026-03-03)
- [x] [P2] Add regression fixtures asserting stable Markdown output for representative pages. (2026-03-03)
- [x] [P2] Ensure Markdown export does not depend on CSS, JS, or runtime assets. (2026-03-03)

#### Markdown flavor support

- [x] [P2] Define supported Markdown flavors: (2026-03-03)
  - Obsidian‑compatible (default)
  - CommonMark
  - GitHub Flavored Markdown
  - Markdown Extra (optional)

- [x] [P2] Implement flavor adapters for: (2026-03-03)
  - Lists and task lists
  - Tables
  - Fenced code blocks
  - Line‑break handling

- [x] [P2] Ensure Obsidian flavor renders cleanly without requiring Obsidian‑specific metadata. (2026-03-03)
- [x] [P2] Add smoke tests validating flavor selection and routing. (2026-03-03)

### Markdown Export — Architecture Guardrails (post‑release)

- [x] [P2] Declare HTML as the canonical semantic source for all exports. (2026-03-03)  
  Document (in code comments and `README.md`) that Markdown export must operate on sanitized HTML output, not raw MHTML or pre‑sanitized structures.

- [x] [P2] Add a regression test asserting HTML → Markdown determinism. (2026-03-03)  
  Given a fixed sanitized HTML fixture, Markdown output must be byte‑stable across runs and independent of UI options unrelated to export format.


### Markdown Export — Conversion Boundaries

- [x] [P2] Explicitly flatten free‑form layout during Markdown conversion. (2026-03-03)  
  Add a test fixture with absolute positioning or multi‑column layout and assert that Markdown output is linearized in reading order.

- [x] [P2] Prohibit inline HTML emission in Markdown by default. (2026-03-03)  
  Add a guardrail test that fails if Markdown output contains raw `<div>`, `<span>`, or `<table>` tags unless a future opt‑in flag is enabled.


### Markdown Flavor Handling — Obsidian‑First

- [x] [P2] Implement a flavor adapter layer on top of core Markdown output. (2026-03-03)  
  Core conversion produces neutral Markdown; flavor adapters apply small, isolated transformations (task lists, table alignment, line breaks).

- [x] [P2] Set Obsidian‑compatible flavor as the default adapter. (2026-03-03)  
  Ensure default output renders cleanly in Obsidian without requiring wikilinks, front‑matter, or vault‑specific metadata.

- [x] [P2] Add a smoke test validating Obsidian‑flavored Markdown output. (2026-03-03)  
  Assert that default Markdown output contains no constructs known to break Obsidian rendering.


### Documentation & User Expectations

- [x] [P2] Document Markdown export philosophy in `README.md`. (2026-03-03)  
  Clearly state: semantic fidelity over visual parity, HTML‑derived conversion, Obsidian as default flavor.

- [x] [P2] Add in‑app help text explaining Markdown tradeoffs. (2026-03-03)  
  Briefly explain why layout may differ from OneNote and why this is intentional.

---

### Experimental Export Formats
- [x] [P2] Add experimental “Export format” toggle in Advanced options (OFF by default). (2026-03-03)
- [x] [P2] Show export-format dropdown when experimental toggle is enabled: HTML (`.html`), Markdown (`.md`), Document (`.docx`). (2026-03-03)
- [x] [P2] When Markdown (`.md`) export is selected, show a dependent “Markdown flavor” dropdown; hide it for non-Markdown formats. (2026-03-03)
- [x] [P2] Add 3-4 Markdown flavor options (for example: CommonMark, GitHub Flavored Markdown, Markdown Extra, Obsidian-compatible (default). (2026-03-03)
- [ ] [P2] Define flavor-specific conversion behavior for lists, tables, fenced code blocks, task lists, and line-break handling.
- [x] [P2] Add validation so Markdown flavor is disabled/ignored unless export format is Markdown. (2026-03-03)
- [x] [P2] Add smoke tests for Markdown flavor visibility, selection behavior, and conversion-path routing. (2026-03-03)
- [x] [P2] Keep current HTML pipeline as default/fallback when experimental export is disabled. (2026-03-03)
- [x] [P2] Add UX validation and disabled-state messaging for unsupported/unfinished formats. (2026-03-03)
- [x] [P2] Add smoke tests for export-format selection behavior. (2026-03-03)
- [x] [P3] Document feature as experimental in `README.md` and in-app help text. (2026-03-03)

#### Markdown export UX

- [x] [P2] Default Markdown flavor to Obsidian‑compatible. (2026-03-03)
- [x] [P2] Clearly label Markdown export as “structure‑first (layout not preserved)”. (2026-03-03)
- [x] [P2] Disable Markdown flavor selection unless export format is Markdown. (2026-03-03)
- [x] [P2] Add help text explaining semantic vs visual tradeoffs. (2026-03-03)


### Converted-Page Theme Toggle (HTML only)
- [ ] [P2] Add Advanced options checkbox: “Add theme toggle (Light/Dark) to converted pages” (default OFF).
- [ ] [P2] Add dependent sub-checkbox: “Use OLED black for Dark theme” (enabled only when theme toggle option is ON).
- [ ] [P2] Inject a simple symbol-based Light/Dark toggle into converted HTML pages (top-right corner, default Light, one click/tap toggles Dark).
- [ ] [P2] Ensure this feature applies only to HTML exports; disable/hide and explain unavailability for `.md` / `.docx` / `.pdf` outputs.
- [ ] [P2] Add native + Playwright smoke coverage for toggle rendering, interaction, default state, and OLED-black variant behavior.
- [ ] [P3] Document exported-page theme toggle behavior and limitations in `README.md` and in-app help.

### Externalized CSS for Converted Pages (HTML only)
- [x] [P2] Add Advanced options checkbox: “Externalize CSS to separate file” (default OFF). (2026-02-27)
- [x] [P2] Add dependent sub-option (enabled only when externalize is ON): “CSS mode: Shared stylesheet for all converted pages / One stylesheet per page”. (2026-02-27)
- [x] [P2] Keep current embedded-style output as default/fallback when externalize is OFF. (2026-02-27)
- [x] [P2] For ZIP exports, write stylesheet assets with deterministic names and update converted HTML to reference them. (2026-02-27)
- [x] [P2] Define naming and path strategy for both modes (shared: one CSS asset per export batch; per-page: one CSS asset per converted page). (2026-02-27)
- [x] [P2] Ensure externalized CSS output remains standalone-safe for expected usage (clear warning/help text when output is downloaded as a single HTML file without assets). (2026-02-27)
- [x] [P2] Add regression and smoke tests for: toggle OFF parity, shared mode links, per-page mode links, and missing-asset behavior messaging. (2026-02-27)
- [ ] [P3] Document External CSS behavior, constraints, and recommended usage in `README.md` and in-app help.

#### Externalized CSS review follow-up (deferred to post-release)
Note: Deferred by decision on 2026-02-27. Re-open after first stable release.
- [ ] [P3] Run fixture-by-fixture review of generated CSS files (`shared` and `per-page`) to verify rule quality, duplication, and readability.
- [ ] [P3] Audit extracted selectors/classes for over-generation (for example too many one-off classes) and define consolidation rules.
- [ ] [P3] Compare visual parity against embedded-style baseline on all locked fixtures and record any regressions by fixture name.
- [ ] [P3] Decide whether additional inline-style properties should stay inline for fidelity and update extraction allow/deny rules.
- [ ] [P3] Confirm CSS filename/path strategy remains optimal for downstream workflows (ZIP root vs nested assets, stable names, collision handling).
- [ ] [P3] Publish review findings and decisions in `Tests/reports/manual-review-findings.md` (or a dedicated CSS review report) before finalizing this feature.

---

## Sanitization, Quality & Encoding (recommended)

### Sanitization
- [x] Remove Office/OneNote artifacts.
- [x] Remove obsolete attributes (`summary`, legacy `xmlns`). (2026-02-25)
- [x] Normalize repetitive inline styles (migration + collapse rules).
- [x] Implement `normalizeTableAttributes` with unit tests.
- [x] Restore embedded images in pipeline and add `image-embedding.unit.js`.

### Encoding & control characters
- [x] Detect C0 control characters at decode time.
- [x] Add CI test asserting no control characters in output.
- [x] [P1] Apply minimal sanitization fallback only when decode recovery fails, with regression tests.

### Accessibility & semantics
- [x] Add heading hierarchy smoke test. (2026-02-25)
- [x] Assert single page‑level `lang` attribute.
- [x] Add test for missing `alt` text on images. (2026-02-25)

### Performance / output size
- [x] [P2] Add guardrail for oversized inlined images (threshold + warning/fail behavior + test coverage). (2026-03-02)
- [x] [P2] Add threshold-based warning for excessive inline styles and verify via regression test. (2026-03-02)

### Export output independence
- [x] [P1] Ensure exported HTML pages are dependency-free by default (no required external JS/CSS libraries when opening output files). (2026-03-02)
- [x] [P1] Add regression checks asserting converted HTML outputs do not require CDN or app-runtime library imports. (2026-03-02)
- [x] [P1] Keep optional export features self-contained in produced artifacts (for example inline assets or bundled sidecars) with safe fallback when disabled. (2026-03-02)
- [x] [P2] Document dependency-free export guarantees and known caveats in `README.md` and in-app help. (2026-03-02)

---

## Regression Fixtures

- [x] Add problematic `.mht` files to locked regression suite. (2026-02-26)
- [x] Ensure CI covers encoding, list fidelity, and sanitization cases. (2026-02-27)

- [x] Ensure regression suite picks up newly added fixtures via discovery (2026-03-02)

---

## Resolved: List Duplication Bug

- [x] Root cause identified and fixed.
- [x] Focused regression tests added.
- [x] Cleaned fixtures updated.
- [x] Fix documented in README and release notes.

---

## Product / Docs Follow‑Up

- [x] [P2] Document native import limitations and expected fidelity in `README.md` and release notes. (2026-02-27)
- [x] [P2] Decide and record preferred workflow: in‑browser decoder vs companion-tool path. (2026-02-27)
- [ ] [P3] Polish page naming for GUID-like titles with a deterministic title strategy.
- [x] [P2] Document Markdown export philosophy. (2026-03-03)
  - Semantic fidelity over visual parity
  - Obsidian as default flavor
  - Known limitations vs HTML export
