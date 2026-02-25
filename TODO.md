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

- [ ] Keep scope centered on browser‑first parsing + conversion of MHTML to clean modern HTML.
- [ ] Prioritize extraction fidelity and HTML structure before UI polish or advanced features.
- [ ] Explicitly defer `.one` and `.onepkg` structural parsing to a later milestone.

Note: MHTML → modern HTML pipeline is nearing completion (core transforms and formatting largely implemented).

---

## HTML Output Standard Compliance (release‑blocking)

Derived from `docs/HTML-Output-Standard.md`.  
All items in this section must be satisfied before tagging the first stable release.

### Document structure
- [x] Assert exactly one `<main>` element per exported document.
- [x] Assert exactly one page-level `<h1>` per document.
- [x] Add regression test enforcing valid heading order (`h1 → h2 → h3`).
- [ ] Assert lists are represented only with `<ul>/<ol>/<li>` (no bullet glyphs).

### Forbidden markup & artifacts
- [ ] Add CI check asserting no `mso-*` attributes appear in output.
- [ ] Assert no Office/OneNote namespaces (`xmlns:o`, `xmlns:v`, `xmlns:w`) remain.
- [ ] Assert no deprecated elements (`font`, `center`, `strike`) are emitted.
- [ ] Assert no deprecated attributes (`bgcolor`, `align`, `border`, `summary`) remain.

### Attributes & styling
- [ ] Normalize or remove repetitive inline styles introduced by conversion.
- [ ] Add regression test asserting sanitizer idempotence.
- [ ] Ensure visual fidelity does not rely on authoring‑tool‑specific styles.

### Encoding & character safety
- [ ] Assert exported HTML is UTF‑8 encoded.
- [x] Add CI test asserting no C0 control characters appear in output.
- [ ] Lock charset fallback behavior behind tests and documentation.

### Accessibility baseline
- [ ] Assert presence of `<main>` landmark.
- [ ] Assert exactly one page‑level `<h1>`.
- [ ] Add test asserting non‑decorative images include `alt` text.
- [ ] Normalize or remove inline styles that introduce contrast violations.

### Stability guarantees
- [ ] Assert sanitization is idempotent.
- [ ] Assert re‑running conversion on the same input produces equivalent output.
- [ ] Lock cleaned fixtures for regression comparison.

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

1. Harden MHTML‑to‑HTML pipeline against edge‑case fixtures.
2. Expand targeted fixture tests (tables, lists, whitespace, inline resources).
3. Verify toolbar/config behavior remains stable and document acceptance gates.

---

## General / UI

- [ ] Manual review of cleaned HTML output.
  - [ ] Address contrast violations in exported HTML (`<pre>` elements).
- [x] Prevent layout shift when Advanced options open.
- [x] Redesign UI to look professional and accessible.
- [x] Add in‑app Help popup and keyboard shortcut.
- [x] Add Light/Dark theme toggle.
- [x] Add auto‑convert opt‑out and persistence.
- [x] Detect and mark unsupported file types.

### Manual Convert Button
- [x] Convert button implemented and tested.
- [x] Disabled when auto‑convert is ON.
- [x] Tooltip shown when disabled.
- [x] Playwright smoke test added.
- [x] README updated.

---

## Encoding Fixes — Option A (priority)

- [ ] Re‑run conversion and Playwright export audits after charset fixes.
- [ ] Verify mojibake is resolved with no regressions.
- [ ] Commit charset fallback changes only after full regression pass.

---

## Sanitization, Quality & Encoding (recommended)

### Sanitization
- [x] Remove Office/OneNote artifacts.
- [ ] Remove obsolete attributes (`summary`, legacy `xmlns`).
- [x] Normalize repetitive inline styles (migration + collapse rules).
- [x] Implement `normalizeTableAttributes` with unit tests.
- [x] Restore embedded images in pipeline and add `image-embedding.unit.js`.

### Encoding & control characters
- [x] Detect C0 control characters at decode time.
 - [x] Add CI test asserting no control characters in output.
- [ ] Apply minimal sanitization only if decoding cannot fully resolve issues.

### Accessibility & semantics
- [ ] Add heading hierarchy smoke test.

- [x] Add heading hierarchy smoke test. (2026-02-25)
- [x] Assert single page‑level `lang` attribute.
- [ ] Add test for missing `alt` text on images.
- [ ] Detect excessive layout tables and flag for review.

### Performance / output size
- [ ] Warn or reject exported HTML with large inlined images.
- [ ] Flag excessive inline styles for optimization.

---

## Regression Fixtures

- [ ] Add problematic `.mht` files to locked regression suite.
- [ ] Ensure CI covers encoding, list fidelity, and sanitization cases.

---

## Resolved: List Duplication Bug

- [x] Root cause identified and fixed.
- [x] Focused regression tests added.
- [x] Cleaned fixtures updated.
- [x] Fix documented in README and release notes.

---

## Product / Docs Follow‑Up

- [ ] Document native import limitations and expected fidelity.
- [ ] Decide on in‑browser decoder vs companion‑tool workflow.
- [ ] Polish page naming for GUID‑like titles.