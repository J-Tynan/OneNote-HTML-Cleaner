# Pre-Release Redundant Code Review

This document captures the audit-first code review completed before the release-candidate verification pass. It is intended to be the readable companion to the backlog entries in `TODO.md`.

## Goal

Review the codebase in bounded passes to identify:

- redundant code
- stale feature remnants
- release-scope drift
- test-driven production branches
- structural complexity that should be cleaned up before or after RC

This review was findings-first. It did not bundle implementation cleanup into the audit itself.

## Review Buckets

### 1. App/UI option wiring

Confirmed findings:

- `src/ui.js` still contains stale UI experiment scaffolding, including removed-dropdown comments, `applyUiStyleVariant()`, and no-op restoration code.
- Advanced option state is derived in more than one place. `src/ui.js` controls enable/disable and help text, while `src/ui-downloads.js` separately derives the conversion payload.
- `src/ui.js` still carries a fallback conversion-config branch that can drift from `runtime.downloadHelpers.getConversionConfig()`.

Follow-up tasks:

- Remove retired UI style-variant/testing scaffolding from `src/ui.js`.
- Consolidate Advanced options state derivation into one shared source of truth.
- Remove or centralize the fallback conversion-config branch in `src/ui.js`.

### 2. Config normalization and single-profile legacy

Confirmed findings:

- `src/pipeline/config.js` uses `SINGLE_PROFILE`, `PROFILE_PRESETS`, and `normalizeProfile()` even though the app only emits `onenote`.
- `generic` profile compatibility survives in config normalization, tests, importer defaults, and docs rather than the live UI path.
- camelCase and PascalCase config alias handling has spread across normalization logic and may no longer be justified.

Follow-up tasks:

- Remove dead single-profile indirection from `src/pipeline/config.js`.
- Decide whether camelCase config aliases are still required for external callers.
- Remove remaining `generic` profile legacy from tests, docs, and importer defaults unless explicitly required.

### 3. Pipeline sanitization and style-helper duplication

Confirmed findings:

- Style declaration parsing/serialization is duplicated across `src/pipeline/sanitize.js`, `src/pipeline/inlineStyleMigration.js`, `src/pipeline/listRepair.js`, and `src/convert/markdownIr.js`.
- CSS length parsing and conversion logic is split across multiple modules with different behaviors.
- `src/pipeline/sanitize.js` mixes general sanitization with OneNote-specific layout heuristics, placeholder cleanup, header/date normalization, handwriting margin handling, and icon alignment.
- `collapseInlineStyleDuplicates()` and `migrateInlineStylesToUtilities()` overlap in class-derivation behavior.

Follow-up tasks:

- Consolidate repeated style helpers into a shared utility module.
- Consolidate CSS length parsing/conversion helpers.
- Split OneNote-specific layout normalization from general sanitization.
- Reassess overlap between inline-style collapse and inline-style migration paths.

### 4. Native importer scope drift

Confirmed findings:

- `src/worker.js` now explicitly rejects native `.one` / `.onepkg` processing for the current release.
- Despite that, shared helpers, importer modules, warning contracts, tests, and docs still describe a more active native-import path.
- The release scope is MHTML-only, but native format handling still leaks into release-facing documentation and defaults.

Follow-up tasks:

- Decide whether native `.one` / `.onepkg` detection should remain in shared runtime helpers during the first stable release.
- Align docs and tests with the actual shipped release behavior for native formats.
- Contain native importer implementation debt behind a documented post-release plan.

### 5. Experimental export paths

Confirmed findings:

- Export-format and Markdown-flavor normalization is duplicated across `src/ui-downloads.js`, `src/pipeline/config.js`, and `src/pipeline/toolbarInjector.js`.
- Markdown conversion routing exists in both `src/worker.js` and `src/worker-wrapper.js`.
- Shared runtime code still recognizes `.docx` even though the homepage option was removed and implementation remains deferred.
- Export metadata concerns in `src/pipeline/toolbarInjector.js` depend on the same normalized export state that is already derived elsewhere.

Follow-up tasks:

- Unify export-format and Markdown-flavor normalization.
- Remove duplicate Markdown conversion routing between `src/worker.js` and `src/worker-wrapper.js`.
- Remove or quarantine dormant `.docx` runtime branches unless explicitly required.
- Feed toolbar/export metadata from a smaller shared normalized export-state object.

### 6. Worker diagnostics and test-driven runtime branches

Confirmed findings:

- `src/worker-wrapper.js` contains multiple diagnostic paths that partially duplicate push/trim/event-dispatch behavior.
- The wrapper carries a 5-second handshake timeout, a 120-second job timeout, duplicate-response tracking, unmatched-message diagnostics, and a capped in-memory buffer, all in the production path.
- `src/ui.js` exposes test-facing globals such as `window.__getWorkerManagerDiagnostics` and `window.__getRuntime`.
- `src/worker-globals.js` still contains deprecated `debugWorker` compatibility scaffolding.

Follow-up tasks:

- Simplify diagnostic buffering and dispatch in `src/worker-wrapper.js`.
- Decide whether test-facing globals in `src/ui.js` should remain in production builds.
- Reassess whether current worker tests are overfitted to implementation details.
- Review handshake and timeout policy so it is either documented or simplified.
- Remove deprecated `debugWorker` compatibility once no callers depend on it.

### 7. Test infrastructure and fixture coupling

Confirmed findings:

- Many Playwright scripts duplicate the same `createStaticServer()` helper.
- Several regression scripts still scan fixtures ad hoc with `fs.readdirSync(...)` rather than using `Tests/fixtures.js`.
- Many Node tests repeat logging suppression and JSDOM/DOMParser setup.
- Some tests depend on production globals such as `window.__getRuntime` and `window.__getWorkerManagerDiagnostics`.
- `Tests/mht-fixtures-playwright.js` still defaults to the legacy `generic` profile path.

Follow-up tasks:

- Extract a shared Playwright/static-server helper.
- Consolidate fixture discovery on top of `Tests/fixtures.js`.
- Extract shared Node-test setup helpers.
- Reduce test dependence on production globals.
- Remove stale profile assumptions from test coverage.

## Likely Pre-RC Cleanup Candidates

These items currently look like the best candidates to fix before the clean release-candidate verification pass:

- native-scope docs/contracts drift
- duplicated Markdown routing between `src/worker.js` and `src/worker-wrapper.js`
- stale UI/test scaffolding in `src/ui.js`
- single-profile/config legacy that still leaks into tests and release-facing docs

## Likely Post-RC Structural Cleanup

These items currently look safer to defer unless they are tied to a live bug:

- style-helper consolidation
- deep `sanitize.js` extraction
- broad worker diagnostics simplification
- test-harness deduplication

## Source Of Truth

- Backlog tracking: `TODO.md`
- This document: readable audit summary and prioritization note
