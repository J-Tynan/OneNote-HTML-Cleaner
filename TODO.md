# TODO

All project TODO items are tracked here. Please do not leave TODO comments in source files — add or update entries in this file instead.

This file was merged with `TODOs.md` to keep a single canonical task list for the project.

---

## Release Roadmap

- `v0.1` Stable release: shipped the browser-first `.mht` / `.mhtml` conversion path with polished UI, release screenshots, release notes, and a recorded acceptance pass. Tagged as `v0.1.0` on 2026-05-15.
- `v0.2` Stabilization and polish release: focus on real-world bug fixes, release hardening, UI consistency, deferred test-harness cleanup, and early launch/messaging assets that sharpen the current product story.
- `v1.0` Native `.one` release: add clearly scoped, documented `.one` processing with representative fixture coverage, understandable failure modes, and release-quality UX.
- `v1.1` Native-support hardening and launch-assets release: fix early `.one` issues, expand compatibility coverage, and finish richer screenshots, short feature descriptions, and shareable launch material.

With `v0.1.0` tagged, new work should center on `v0.2` stabilization while defining a strict support contract for `v1.0` native `.one` processing before broader feature expansion.

---

## Recent Success

- [x] Homepage polish pass: aligned the Start/Results cards, normalized Advanced options helper text, and improved Help popup readability and scanability. (2026-05-10)
- [x] Preserve same-tab queue state across unexpected reload/discard and add focused regression coverage in `Tests/queue-reload-restore-playwright.js`. (2026-05-10)
- [x] Fix MHT spacer regression: preserve image-only paragraphs before footer so `DevToys.mht` keeps embedded `data:image/*;base64` icons in cleaned HTML (2026-03-07)
- [x] PWA dark theme: queue status indicators (`Queued` app badge + per-file status pills) now use explicit dark-mode-aware styling (2026-03-07)
- [x] PWA homepage: add subtle spacing around `Import files` card and remove `Conversion method` copy from Advanced options (2026-03-06)
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

## Version 0.1 Stable Release Checklist (active)

Use this section as the real go/no-go list for `v0.1`.
Items below should reach zero before tagging the first stable build.

- [x] [P1] Lock first stable release scope to `.mht` / `.mhtml` input only, and reject unsupported file types clearly in the UI. (2026-03-10)
- [x] [P1] Run one clean release-candidate verification pass on `main`: `npm ci`, `npm run test:gate:native`, all Playwright smoke scripts, and the accessibility audits. (2026-03-26)
- [x] [P1] Accept locked cleaned-fixture drift for regenerated test outputs and rebaseline the locked fixtures when expected HTML changes are intentional. (2026-03-26)
- [x] [P1] Keep preserved OneNote-authored exported color styling non-blocking in `test:playwright:a11y-exports`; exported-page contrast findings should remain informational when fidelity is the higher priority. (2026-03-26)
- [x] [P1] Implement one small exported-HTML layout tweak on a short-lived branch and validate it against the locked fixtures before final screenshot capture. (2026-03-28)
- [x] [P1] Perform manual PWA acceptance on a clean browser profile using the core fixtures (`Test File.mht`, `DevToys.mht`, `Communicate using Markdown.mht`, `Resolve merge conflicts.mht`) and confirm successful conversion plus working downloads. (2026-05-12)
- [x] [P1] Capture hero screenshot on a clean browser profile: import panel + queued file + convert button visible. (2026-05-13)
- [x] [P1] Capture converted page screenshot on a clean browser profile: show a page with headings, lists, a table, and a handwriting raster (caption: “Handwriting preserved as raster image”). (2026-05-13)
- [x] [P1] Capture Advanced options screenshot on a clean browser profile: show Export format = Markdown and Markdown flavor = Obsidian selected. (2026-05-13)
- [x] [P1] Capture ZIP export screenshot on a clean browser profile: show ZIP contents with readable filenames. (2026-05-13)
- [x] [P1] Add accessibility note screenshot/caption: exported HTML includes `<main>` and a single page-level `h1`. (2026-05-13)
- [x] [P1] Add screenshot captions and alt text for the README and release page assets. (2026-05-13)
- [x] [P1] Add a concise release go/no-go checklist to project docs covering browser support, offline/service-worker update behavior, and known limitations. (2026-05-12)
- [x] [P1] Draft `RELEASE_NOTES.md` for the first stable release with supported scope, known limitations, and upgrade notes. (2026-05-12)
- [x] [P1] Run one final clean release-candidate verification pass on `main` and record the results after release-doc and screenshot-prep changes land. (2026-05-13; `npm ci`, `npm run test:gate:native`, Playwright smoke coverage, `npm run test:playwright:a11y`, `npm run test:playwright:a11y-exports`.)
- [x] [P1] Tag the first stable release only after CI is green on `main` and the manual acceptance pass is recorded. (2026-05-15, tagged as `v0.1.0` after green `main` CI.)

---

## Pre-Release Redundant Code Review (triaged)

This audit pass is complete. Keep this section as historical context for what was reviewed, what was fixed for release, and what was explicitly deferred.

- [x] [P1] Audit app/UI option wiring for stale branches, duplicated state handling, and retired-profile remnants. (2026-03-11)
- [x] [P1] Audit config normalization for legacy aliases and unnecessary single-profile compatibility paths. (2026-03-11)
- [x] [P1] Audit pipeline sanitization/style helpers for duplication, fixture-specific logic, and extractable modules. (2026-03-11)
- [x] [P1] Audit native importer code paths against first stable release scope and log explicit defer/gate decisions. (2026-03-11)
- [x] [P1] Audit Markdown and experimental export paths for redundant logic and coupling to the default HTML path. (2026-03-11)
- [x] [P1] Audit worker diagnostics/initialization for unnecessary complexity and test-driven production branches. (2026-03-11)
- [x] [P1] Audit test infrastructure for fixture coupling, duplicated helpers, and production code that exists only for tests. (2026-03-11)
- [x] [P1] Convert confirmed review findings into prioritized cleanup tasks before the release-candidate verification pass. (2026-03-26, completed through the triage decisions and bucketed follow-up items below.)

### Bucket 1 findings: App/UI option wiring

- [x] [P1] Remove retired UI style-variant/testing scaffolding from `src/ui.js` (`applyUiStyleVariant`, removed-dropdown comments, and no-op restore blocks) so the shipped UI no longer carries dead experiment-era code. (2026-03-11)
- [x] [P1] Consolidate Advanced options state derivation so UI control enable/disable rules and conversion payload generation share one source of truth instead of duplicating export-format/theme-toggle logic across `src/ui.js` and `src/ui-downloads.js`. (2026-03-11)
- [x] [P1] Remove or centralize the fallback conversion-config branch in `src/ui.js` so new Advanced options cannot drift from `runtime.downloadHelpers.getConversionConfig()`. (2026-03-11)

### Bucket 2 findings: Config normalization and single-profile legacy

- [x] [P1] Remove dead single-profile indirection from `src/pipeline/config.js` (`normalizeProfile`, `PROFILE_PRESETS`, and the unused local `profile` path) so config normalization reflects the actual one-profile release design. (2026-03-11)
- [x] [P1] Decide whether camelCase config aliases in `src/pipeline/config.js` are still required for external callers; if not, remove them and simplify tests/docs to the canonical config shape. (2026-03-11)
- [x] [P1] Remove the remaining `generic` profile legacy from tests, docs, and native importer defaults (`Tests/mht-fixtures-playwright.js`, `docs/Contracts.md`, `src/importers/one.js`, `src/importers/onepkg.js`) unless a specific backwards-compatibility requirement is documented. (2026-03-11)

### Bucket 3 findings: Pipeline sanitization and style-helper duplication

- [x] [P1] Extract shared style declaration parsing/serialization and CSS length helpers into `src/pipeline/styleUtils.js`, and rewire `src/pipeline/inlineStyleMigration.js` plus `src/convert/markdownIr.js` to use the shared implementation. (2026-03-11)
- [x] [P1] Finish migrating the remaining style declaration and CSS length call sites in `src/pipeline/sanitize.js` and `src/pipeline/listRepair.js` so the shared utility module becomes the only implementation path. (2026-03-12)
- [x] [P1] Split OneNote-specific layout normalization from general sanitization in `src/pipeline/sanitize.js` so placeholder removal, header/date positioning, handwriting margin logic, and icon-paragraph alignment are easier to review and test independently. (2026-03-12)
- [x] [P1] Reassess `collapseInlineStyleDuplicates()` in `src/pipeline/sanitize.js` versus `migrateInlineStylesToUtilities()` in `src/pipeline/inlineStyleMigration.js` and remove overlapping mapping logic where the two paths duplicate class-derivation behavior. (2026-03-12)

### Bucket 4 findings: Native importer scope drift

- [x] [P1] Decide whether native `.one` / `.onepkg` detection should remain in shared runtime helpers (`src/importers/sourceKind.js`, `src/ui.js`, `src/worker.js`) during the first stable release, or be gated behind an explicit non-release flag. (2026-03-12, decided to keep detection exposed for unsupported-file messaging while conversion remains blocked in the shipped UI/worker path.)
- [x] [P1] Align docs and tests with the actual release behavior for native formats: `README.md`, `docs/Architecture.md`, `docs/Contracts.md`, and native test scripts currently describe a more active native path than the worker now ships. (2026-03-12)
- [x] [P1] Contain native importer implementation debt (`src/importers/one.js`, `src/importers/onepkg.js`, `src/importers/warnings.js`) behind a documented post-release plan so deferred code does not keep leaking into release-facing contracts and defaults. (2026-03-12)

### Bucket 5 findings: Experimental export paths

 [x] [P1] Unify export-format and Markdown-flavor normalization so `src/ui-downloads.js`, `src/pipeline/config.js`, and `src/pipeline/toolbarInjector.js` do not each maintain their own accepted-format logic.
 [x] [P1] Remove duplicate Markdown conversion routing between `src/worker.js` and `src/worker-wrapper.js` so experimental export behavior has one canonical execution path.
 - [x] [P1] Quarantine dormant `.docx` runtime branches at the config boundary and update docs (2026-03-12).
 - [x] [P1] Refactor toolbar injector to consume an explicit normalized `exportState` and rewire callers (2026-03-12).

- [x] [P1] Simplify diagnostic buffering and dispatch in `src/worker-wrapper.js` so handshake timeout, unmatched-message, duplicate-response, and worker-origin diagnostics all flow through one implementation path instead of partially duplicating push/trim/event logic. (2026-03-12)
- [x] [P1] Decide whether `window.__getWorkerManagerDiagnostics`, `window.__getRuntime`, and other test-facing globals in `src/ui.js` should remain in production builds; if they stay, document them as explicit dev hooks rather than leaving them as ad hoc test affordances. (2026-03-12)
- [x] [P1] Reassess whether the current worker-wrapper fallback/diagnostic surface is testing implementation details rather than product behavior, especially around duplicate-response and unmatched-message handling in `src/worker-wrapper.js` and the corresponding Playwright tests. (2026-03-12)
- [x] [P1] Review handshake and callback timeout policy in `src/worker-wrapper.js` so the 5-second handshake timer, 120-second job timeout, and `maxPendingCallbacks` cap are either documented product decisions or simplified out of the release path. (2026-03-12)
- [x] [P1] Remove remaining deprecated `debugWorker` compatibility scaffolding from `src/worker-globals.js` once no import-time callers rely on it. (2026-03-12)

### Bucket 7 findings: Test infrastructure and fixture coupling

- [ ] [P2] Post-release: extract a shared Playwright/static-server helper for the repeated `createStaticServer()` pattern used across the browser smoke tests so server setup changes do not require editing dozens of files. (triaged 2026-03-26)
- [ ] [P2] Post-release: consolidate fixture discovery on top of `Tests/fixtures.js` and remove ad hoc `fs.readdirSync('Tests')` scans from regression scripts so the suite has one canonical fixture policy. (triaged 2026-03-26)
- [ ] [P2] Post-release: extract shared Node-test setup helpers for logging suppression, JSDOM/DOMParser bootstrapping, and common assertion utilities instead of repeating `setEnabled(false)` and local polyfills across many unit scripts. (triaged 2026-03-26)
- [ ] [P2] Post-release: reduce test dependence on production globals such as `window.__getRuntime` and `window.__getWorkerManagerDiagnostics` by introducing explicit test harness helpers or dev-only adapters. (triaged 2026-03-26)
- [ ] [P2] Post-release investigate HTML cleaning tools such as "HTML Tidy" to improve your HTML cleanup pipeline.
- [x] [P1] Review browser test coverage for stale assumptions, including the old `generic` profile default in `Tests/mht-fixtures-playwright.js`, so fixture comparisons align with the actual release path. (2026-03-26, triage confirmed `Tests/mht-fixtures-playwright.js` now defaults to `onenote` and no remaining `generic` test defaults were found under `Tests/`.)

### Pre-RC cleanup triage

- [x] [P1] Decide which confirmed findings must be fixed before the clean release-candidate verification pass versus explicitly deferred to post-release. (2026-03-26, decision: previously likely pre-RC candidates were already completed on 2026-03-11/12; remaining open audit items are post-release structural cleanup.)
- [x] [P1] Treat these as likely pre-RC candidates unless new evidence changes priority: native-scope docs/contracts drift, duplicated Markdown routing between `src/worker.js` and `src/worker-wrapper.js`, stale UI/test scaffolding in `src/ui.js`, and single-profile/config legacy that still leaks into tests and release-facing docs. (2026-03-26, confirmed already addressed by completed tasks in Buckets 1, 2, 4, and 5.)
- [x] [P2] Treat these as likely post-RC structural cleanup unless they are tied to a live bug: style-helper consolidation, deep `sanitize.js` extraction, broad worker diagnostics simplification, and test-harness deduplication. (2026-03-26, confirmed deferred; no new release-path bug evidence found.)

### Post-triage next task

- Current next release task is to execute the `v0.2` stabilization plan, then define the narrow support contract that will gate `v1.0` native `.one` work.

### Version 0.1 Close-Out Order (historical)

This close-out sequence was completed for `v0.1.0` and remains here as release-process history.

1. Finish release-facing documentation.
2. Capture the release screenshot set and captions.
3. Perform the manual PWA acceptance pass on a clean browser profile using the locked core fixtures.
4. Run the final clean release-candidate verification pass on `main`.
5. Tag `v0.1` only after CI is green on `main` and the manual acceptance pass is recorded.

### Explicit Deferrals Unless New Evidence Appears

- Treat broad worker-diagnostics simplification as post-release unless it fixes a verified release-path bug.
- Treat broad test-harness deduplication as post-release unless it blocks accurate RC verification.
- Treat `.docx` implementation work as post-release; only quarantine or document its dormant runtime branches before stable.
- Treat further externalized-CSS review follow-up as post-release unless fidelity evidence says otherwise.

---

## Project Scope (release policy)

These are scope guardrails for the first stable release, not day-to-day completion tasks.

- [P1] Keep scope centered on browser‑first parsing + conversion of MHTML to clean modern HTML.
- [P1] Prioritize extraction fidelity and HTML structure before UI polish or advanced features.
- [P1] Defer `.one` and `.onepkg` structural parsing until after the first stable release.

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

## Version 0.2 — Bug Fixes And Polish (post-`v0.1`)

Use this track to make the shipped browser-first MHTML workflow calmer, more reliable, and easier to present before native-file support expands the scope.

Release goal:
- Reduce avoidable bugs and release friction in the current `.mht` / `.mhtml` path.

Success criteria:
- Real-world MHTML regressions are addressed faster because the test harness is easier to trust and maintain.
- High-visibility UI controls feel consistent and screenshot-ready across desktop and mobile displays.
- The current feature set has clearer acceptance gates, sharper docs, and reusable launch material that can carry into later releases.

First-pass tasks:
1. Harden the MHTML-to-HTML pipeline against edge-case fixtures and expand targeted regression coverage for tables, lists, whitespace, and inline resources.
2. Tackle deferred post-release test-harness cleanup that directly improves confidence and delivery speed, especially repeated static-server setup and shared browser-test helpers.
3. Run a consistency pass on high-visibility controls and current features, including primary/secondary button polish, toolbar/config stability, and the clear-results workflow.
4. Rewrite or tighten high-traffic product copy where it still feels provisional, including Help content, feature descriptions, and acceptance-gate documentation.
5. Start reusable launch assets early: capture refreshed screenshots as the UI improves, draft short feature blurbs, and keep comparison notes that will help later release announcements.

## Version 1.0 — Native `.one` Release

Use this track for the first stable native OneNote-file release, with scope defined by a narrow support contract rather than by every deferred feature that could attach itself to native import.

Release goal:
- Ship `.one` processing as a credible product capability, not just a parser milestone.

Success criteria:
- Supported `.one` scenarios are explicitly documented and backed by representative fixtures.
- Failure modes are understandable in the UI and do not leave users guessing whether a file, feature, or workflow is unsupported.
- Native import behavior is stable enough that release notes can describe known limitations clearly without apologizing for the core workflow.

First-pass tasks:
1. Define the `v1.0` native support contract: what kinds of `.one` files are in scope, what is intentionally unsupported, and what quality bar counts as release-ready.
2. Build representative `.one` fixtures and acceptance checks around the scoped workflows before widening implementation breadth.
3. Implement the minimal release-quality native pipeline, including import UX, warnings, failure messaging, and deterministic output expectations.
4. Document native workflow limitations, expected fidelity, and troubleshooting paths in product docs and in-app help.
5. Reassess adjacent work such as `.onepkg`, `.docx`, tag tooling, and richer toolbar variants only after the core `.one` contract is stable.

## Version 1.1 — Native Support Hardening And Launch Assets

Use this track for the first post-`v1.0` hardening release: absorb real-world feedback from native `.one` usage, improve compatibility, and package the product more clearly for wider adoption.

Release goal:
- Make the native-file story dependable in practice and easier to communicate externally.

Success criteria:
- Early `.one` bugs and compatibility gaps are reduced based on real post-release evidence.
- Release assets are strong enough to explain the product quickly to new users without improvising from scratch.
- Marketing and release-prep work becomes a maintained asset library rather than a one-off scramble.

First-pass tasks:
1. Prioritize and fix the first wave of `.one` regressions, unsupported-content surprises, and fidelity gaps found after `v1.0` ships.
2. Expand compatibility fixtures and troubleshooting documentation using real sample diversity rather than only synthetic happy paths.
3. Produce a maintained screenshot set for homepage, import flow, converted output, native `.one` scenarios, and key options.
4. Draft short feature descriptions, release blurbs, and a lightweight social-media/thread outline that can be reused across release notes, README updates, and launch posts.
5. Review whether additional downstream packaging work is needed for broader promotion, such as clearer comparison tables, known-limitation summaries, or demo-ready sample files.

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
- [x] [P2] Fix PWA header bar right-edge gap so the header background extends flush to the full viewport width. (2026-03-06)
- [x] [P2] Add responsive Playwright coverage to assert header bar edge-to-edge rendering on desktop and mobile viewports. (2026-03-02)

### Outstanding Visual Tasks

- [x] Tune left-margin for handwriting-heavy pages (`Test Handwriting.html`) with follow-on content baseline normalization and regression coverage. (2026-03-06)
- [x] Implement Converted-Page Theme Toggle (HTML only): add UI option, inject toggle into converted pages, support OLED-black option, and add Playwright smoke tests. (2026-03-03)
- [x] Externalized CSS review follow-up: audit generated CSS, consolidate over-generated selectors, and add visual regression checks to ensure parity with embedded-style baseline. (2026-03-07, via `tools/css-audit-report.js`, shared-bundle consolidation in `src/ui-downloads.js`, and `Tests/externalize-css-visual-parity-playwright.js`)
- [x] Polish exported page naming: replace GUID-like titles with a deterministic, readable naming strategy for downloads/archives. (2026-03-07, implemented via `src/export-filenames.js` with coverage in `Tests/exported-page-naming.unit.js`)
- [ ] [P1] Polish primary action buttons for screenshot readiness: increase button size, label padding, and contrast so they read clearly across matte laptop, OLED phone, and IPS desktop displays.
- [ ] [P1] Run a consistency pass on secondary/icon controls so Help, theme, remove, and similar buttons use clearer sizing, spacing, and visibility.
- [x] [P1] Refactor the Help pop-up content into easier-to-scan native collapsible sections using built-in browser features where practical (for example, `details` / `summary`). (2026-05-10)
- [ ] [P1] Do a cross-display UI polish review before screenshots and record any remaining readability or contrast fixes needed for the PWA.

---

## Toolbar Edit Controls

- [x] Add Undo button to row of formatting tools (2026-03-03)
- [x] Split heading control into H1–H4 buttons for explicit block styles (2026-03-03)
- [x] Rename Hyperlink button to Link while keeping the dual-prompt flow (2026-03-03)
- [x] Toggle Bold/Italic/Heading buttons on double-clicks and enforce heading exclusivity (2026-03-03)
- [ ] [P2] Redesign the Edit Mode toolbar UI and tools so Advanced options can reveal a hidden toolbar-style dropdown before conversion, letting users choose the injected toolbar chrome only when needed to limit output filesize; initial styles to explore: Office-97, Ribbon, MacOS, and Linux.
- [ ] [P2] Add coverage to test the Edit Mode toolbar UI variants so Office-97, Ribbon, MacOS, and Linux styles are verified for selection behavior, rendering, and core toolbar actions before release.

### OneNote Tag Support (post‑release)

#### Phase 1 — Tag Parsing Improvements
- [ ] [P2] Expand MHTML → HTML sanitizer to detect OneNote tag glyphs and map them to semantic tag types.
- [ ] [P2] Define canonical HTML representation for tags (for example, `<span class="onenote-tag" data-tag="todo">`).
- [ ] [P2] Add regression fixtures containing all built‑in OneNote tag types.
- [ ] [P2] Add Markdown export rules for tags (Obsidian-compatible checkboxes, emoji, or text markers).

#### Phase 2 — Edit Mode Tag Insertion
- [ ] [P2] Add tag insertion controls to Edit Mode toolbar (To‑Do, Important, Question, Idea, etc.).
- [ ] [P2] Ensure inserted tags use the same canonical HTML representation as parsed tags.
- [ ] [P2] Add Playwright coverage for tag insertion, toggling, and deletion.
- [ ] [P2] Add visual variants for tag icons depending on toolbar UI style (Office‑97, Ribbon, MacOS, Linux).

#### Phase 3 — Tag Summary Tool
- [ ] [P3] Create standalone `summarize-tags.html` tool for drag‑and‑drop analysis of converted HTML/Markdown.
- [ ] [P3] Parse tags across multiple files and group by:
  - tag type
  - page/file
  - completion state (for To‑Do)
- [ ] [P3] Add filters for tag type, page, and completion.
- [ ] [P3] Add export options (HTML summary, Markdown summary).
- [ ] [P3] Add a small demo dataset and link from README.

### OneNote Tag System — Design & Research (post‑release)

#### Phase 0 — Research Capture (now)
- [ ] Record Option A (emoji) and Option B (Heroicons) findings in docs.
- [ ] Decide on a single canonical tag data model independent of rendering.
- [ ] Define required tag metadata: type, label, priority, completion state.

#### Phase 1 — Canonical Tag Model
- [ ] Define canonical HTML structure for tags (`data-tag`, `data-label`, etc.).
- [ ] Add minimal CSS for tag containers (spacing, alignment, accessibility).
- [ ] Add regression fixtures containing parsed OneNote tags.

#### Phase 2 — Emoji Renderer (Option A)
- [ ] Define emoji mapping for all default OneNote tags.
- [ ] Add CSS to normalize emoji size and baseline alignment.
- [ ] Use emoji renderer for:
      - Markdown export
      - Summarize Tags tool
      - Plain‑text fallback

#### Phase 3 — SVG Renderer (Option B)
- [ ] Define Heroicons mapping for all default OneNote tags.
- [ ] Add SVG renderer for:
      - Edit Mode toolbar
      - Converted HTML output
- [ ] Ensure SVG renderer can be swapped for emoji renderer without markup changes.

#### Phase 4 — Summarize Tags Tool
- [ ] Build standalone HTML tool for drag‑and‑drop tag summaries.
- [ ] Default to emoji renderer for portability.
- [ ] Add filters by tag type, page, and completion state.

**Current Release Focus**
- **Stabilize the shipped MHTML path for `v0.2` while defining the narrow `v1.0` `.one` support contract and collecting reusable launch assets along the way.**

Completed follow-up work from this milestone:
- [x] Draft `README.md` section describing Externalize CSS behavior, supported modes, and recommended usage (shared vs per-page), including examples and known caveats. (2026-03-10)
- [x] Add in-app help text and tooltip copy explaining when externalized CSS is suitable and warnings for single-file downloads without assets. (2026-03-10)
- [x] Add a small smoke/test example (or test instruction) demonstrating per-page vs shared CSS outputs and link integrity. (2026-03-10)
- [x] Land the documentation and test updates on `main`. (2026-03-10)

**Notes / Deferred items**
- `Test Handwriting.html` follow-on content baseline margin normalization shipped with regression coverage in `Tests/direction-layout-normalization.unit.js`. Keep monitoring future handwriting fixtures for edge cases. (updated 2026-03-07)

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
- [x] [P2] Show export-format dropdown when experimental toggle is enabled: HTML (`.html`) and Markdown (`.md`) in the shipped app, while keeping `Document (.docx)` deferred post-release. (2026-03-03; clarified 2026-03-12)
- [x] [P2] When Markdown (`.md`) export is selected, show a dependent “Markdown flavor” dropdown; hide it for non-Markdown formats. (2026-03-03)
- [x] [P2] Add 3-4 Markdown flavor options (for example: CommonMark, GitHub Flavored Markdown, Markdown Extra, Obsidian-compatible (default). (2026-03-03)
- [x] [P2] Define flavor-specific conversion behavior for lists, tables, fenced code blocks, task lists, and line-break handling. (2026-03-04)
- [x] [P2] Add canonical Markdown flavor standards reference with pinned upstream specs and behavior matrix in `docs/Markdown-Flavor-Standard.md`. (2026-03-04)
- [x] [P2] Phase 2: Define 8-12 normative, per-flavor rules with pass/fail examples in `docs/Markdown-Flavor-Standard.md`. (2026-03-04)
- [x] [P2] Phase 3: Convert normative rules into fixture-backed regression assertions for all four flavors. (2026-03-04)
- [ ] [P3] Phase 4: Enforce change-governance checklist for flavor changes (docs + fixtures + tests updated together).
- [x] [P2] Add validation so Markdown flavor is disabled/ignored unless export format is Markdown. (2026-03-03)
- [x] [P2] Add smoke tests for Markdown flavor visibility, selection behavior, and conversion-path routing. (2026-03-03)
- [x] [P2] Keep current HTML pipeline as default/fallback when experimental export is disabled. (2026-03-03)
- [x] [P2] Add UX validation and disabled-state messaging for unsupported/unfinished formats. (2026-03-03)
- [x] [P2] Add smoke tests for export-format selection behavior. (2026-03-03)
- [x] [P3] Document feature as experimental in `README.md` and in-app help text. (2026-03-03)

#### Document export (`.docx`) (post-release)

Note: the shipped UI now exposes HTML and Markdown only. Full Word-compatible `Document (.docx)` export work remains deferred until after the first stable MHTML release.

- [ ] [P3] Define the canonical HTML-to-`.docx` conversion contract and supported feature set (headings, paragraphs, lists, tables, images, metadata).
- [ ] [P3] Implement Word-compatible `.docx` export from sanitized HTML rather than from raw MHTML.
- [ ] [P3] Decide packaging strategy for images, links, and document metadata inside generated `.docx` files.
- [ ] [P3] Add regression fixtures and smoke tests for `.docx` export generation, download flow, and basic Word compatibility.
- [ ] [P3] Document `.docx` export limitations, fidelity expectations, and supported workflows in `README.md` and in-app help.

#### Markdown export UX

- [x] [P2] Default Markdown flavor to Obsidian‑compatible. (2026-03-03)
- [x] [P2] Clearly label Markdown export as “structure‑first (layout not preserved)”. (2026-03-03)
- [x] [P2] Disable Markdown flavor selection unless export format is Markdown. (2026-03-03)
- [x] [P2] Add help text explaining semantic vs visual tradeoffs. (2026-03-03)


### Converted-Page Theme Toggle (HTML only)
- [x] [P2] Add Advanced options checkbox: “Add theme toggle (Light/Dark) to converted pages” (default OFF). (2026-03-03)
- [x] [P2] Add dependent sub-checkbox: “Use OLED black for Dark theme” (enabled only when theme toggle option is ON). (2026-03-03)
- [x] [P2] Inject a simple symbol-based Light/Dark toggle into converted HTML pages (top-right corner, default Light, one click/tap toggles Dark). (2026-03-03)
- [x] [P2] Ensure this feature applies only to HTML exports; disable/hide and explain unavailability for `.md` / `.docx` / `.pdf` outputs. (2026-03-03)
- [x] [P2] Add native + Playwright smoke coverage for toggle rendering, interaction, default state, and OLED-black variant behavior. (2026-03-03)
- [x] [P3] Document exported-page theme toggle behavior and limitations in `README.md` and in-app help. (2026-03-03)

### Externalized CSS for Converted Pages (HTML only)
- [x] [P2] Add Advanced options checkbox: “Externalize CSS to separate file” (default OFF). (2026-02-27)
- [x] [P2] Add dependent sub-option (enabled only when externalize is ON): “CSS mode: Shared stylesheet for all converted pages / One stylesheet per page”. (2026-02-27)
- [x] [P2] Keep current embedded-style output as default/fallback when externalize is OFF. (2026-02-27)
- [x] [P2] For ZIP exports, write stylesheet assets with deterministic names and update converted HTML to reference them. (2026-02-27)
- [x] [P2] Define naming and path strategy for both modes (shared: one CSS asset per export batch; per-page: one CSS asset per converted page). (2026-02-27)
- [x] [P2] Ensure externalized CSS output remains standalone-safe for expected usage (clear warning/help text when output is downloaded as a single HTML file without assets). (2026-02-27)
- [x] [P2] Add regression and smoke tests for: toggle OFF parity, shared mode links, per-page mode links, and missing-asset behavior messaging. (2026-02-27)
- [x] [P3] Document External CSS behavior, constraints, and recommended usage in `README.md` and in-app help. (2026-03-10)

#### Externalized CSS review follow-up (deferred to post-release)
Note: Deferred by decision on 2026-02-27. Re-open after first stable release.
- [x] [P3] Run fixture-by-fixture review of generated CSS files (`shared` and `per-page`) to verify rule quality, duplication, and readability. (2026-03-07, automated audit report in `Tests/reports/css-audit-report.md`)
- [x] [P3] Audit extracted selectors/classes for over-generation (for example too many one-off classes) and define consolidation rules. (2026-03-07, consolidation added in `src/ui-downloads.js` with unit coverage in `Tests/ui-downloads-css-consolidation.unit.js`)
- [x] [P3] Compare visual parity against embedded-style baseline on all locked fixtures and record any regressions by fixture name. (2026-03-07, automated via `Tests/externalize-css-visual-parity-playwright.js`)
- [ ] [P3] Decide whether additional inline-style properties should stay inline for fidelity and update extraction allow/deny rules.
- [ ] [P3] Confirm CSS filename/path strategy remains optimal for downstream workflows (ZIP root vs nested assets, stable names, collision handling).
- [x] [P3] Publish review findings and decisions in `Tests/reports/manual-review-findings.md` (or a dedicated CSS review report) before finalizing this feature. (2026-03-07, published in `Tests/reports/css-audit-report.md`)

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
- [x] [P3] Polish page naming for GUID-like titles with a deterministic title strategy. (2026-03-07, implemented via `src/export-filenames.js`)
- [x] [P2] Document Markdown export philosophy. (2026-03-03)
  - Semantic fidelity over visual parity
  - Obsidian as default flavor
  - Known limitations vs HTML export
