# TODO

All project TODO items are tracked here. Please do not leave TODO comments in source files — add or update entries in this file instead.

This file was merged with `TODOs.md` to keep a single canonical task list for the project.

## Current focus (PWA first)
- [ ] Keep scope centered on browser-first parsing + conversion of MHTML to clean modern HTML.
- [ ] Prioritize extraction fidelity and HTML structure before UI polish/advanced features.
- [ ] Treat optional native helper tooling (WASM/CLI) as support work, not the main product surface.
- [ ] Explicitly defer `.one` and `.onepkg` structural parsing to a later milestone so the first stable release ships on the reliable MHTML path.
- Note: MHTML → modern HTML pipeline is nearing completion (core transforms and formatting largely implemented).

## Prioritized PWA / Worker Tasks (highest first)

These tasks were identified from recent debugging and are ordered by priority for the PWA/worker hardening work.

- [ ] Add explicit worker handshake (`ready`/`init`) — ensure `src/worker-wrapper.js` waits for a `ready` message before sending work.
- [ ] Move import-time side-effects into explicit `init()` — refactor `src/worker.js` so module import does minimal work.
- [ ] Improve `debugWorker` global initialization & diagnostics — ensure `src/worker-globals.js` defines a deterministic noop and posts structured diagnostics.
- [ ] Add cache-update / service-worker unregister guidance and automation — include worker files in precache and document/automate `skipWaiting()`/`clients.claim()` rollout steps.
- [ ] Harden message id/callback handling and diagnostics — log unmatched messages, add a reserved diagnostics channel, and improve summaries for payloads/errors.
- [ ] Standardize logging formats across UI, wrapper, and worker — unify prefixes and a small JSON-summary shape for easier correlation.
- [ ] Tidy Node test warnings: add `type` to `package.json` — remove `MODULE_TYPELESS_PACKAGE_JSON` warnings from test runs.
- [ ] Standardize test output formatting — ensure tests print `Result: PASS` / `Result: FAIL` consistently.
- [ ] Run tests after changes and collect logs — re-run native and Playwright smoke tests and archive logs for the rollout.

## Tomorrow's focus (start here)

Begin work with the smallest, highest-impact items so we unblock further diagnostics and releases quickly.

1. Add explicit worker handshake (`ready`/`init`) — Owner: `core/browser` — Status: in-progress
	- Estimated time: 2–4 hours
	- Quick checklist: emit `{type:'ready'}` from the worker at the end of `init()`; buffer messages in `worker-wrapper` until ready; add a short Playwright test asserting ordering.

2. Move import-time side-effects into `init()` — Owner: `core/pipeline` — Status: next
	- Estimated time: 1–2 days (audit + refactor)
	- Quick checklist: audit import-time code, refactor to `async init()`, ensure `init()` posts `ready` and captures errors.

3. Improve `debugWorker` global initialization & diagnostics — Owner: `infra` — Status: next
	- Estimated time: 1–2 hours
	- Quick checklist: ensure `worker-globals.js` runs first and posts structured `init` diagnostics; include worker file URL/hash when possible.

Note: after these three items are complete we should be able to reproduce and fix the remaining PWA client failures reliably; proceed to the remaining prioritized tasks afterward.

Detailed task breakdown

- Add explicit worker handshake (`ready`/`init`)
	- Goal: Guarantee main thread never sends conversion payloads until the worker signals it is fully initialized.
	- Acceptance criteria: `worker-wrapper` delays all `enqueue()` dispatches until it receives `{ type: 'ready' }` from the worker; tests should assert handshake happened before any `process-entry` message is posted.
	- Suggested steps:
		1. Add lightweight `ready` message emitted by the worker at the end of its `init()`.
		2. Make `worker-wrapper` buffer messages until the handshake completes (with a short timeout and clear diagnostic if handshake fails).
		3. Add Playwright test that verifies the handshake ordering.
	- Complexity: Medium. Owner: core/browser.

- Move import-time side-effects into explicit `init()`
	- Goal: Reduce import-time work to eliminate ordering/race conditions and make failures reproducible and catchable.
	- Acceptance criteria: `src/worker.js` imports only definitions and lightweight helpers; any setup that can throw runs during `init()` and posts structured errors to main thread.
	- Suggested steps:
		1. Audit worker module imports for code that executes at import time (listeners, transforms, heavy allocations).
		2. Refactor those pieces into an exported `async function init()` that the worker calls immediately and then posts `ready`.
		3. Add tests that validate import-time errors are not thrown synchronously but are captured and posted as diagnostics.
	- Complexity: Medium–High. Owner: core/pipeline.

- Improve `debugWorker` global initialization & diagnostics
	- Goal: Make `debugWorker` reliably present during module evaluation and improve the fidelity of import-time error reports.
	- Acceptance criteria: `src/worker-globals.js` defines a deterministic noop `debugWorker` on import and attaches `error`/`unhandledrejection` handlers that post a structured diagnostic message containing `id: 'init'`, `stack`, `file`, and `lineno` fields.
	- Suggested steps:
		1. Keep the noop global but extend the diagnostic payload to include the worker file URL and a short file hash (if available).
		2. Ensure `worker.js` imports `worker-globals.js` as the very first import.
	- Complexity: Small. Owner: infra.

- Add cache-update / service-worker unregister guidance and automation
	- Goal: Prevent clients from running stale `worker.js` by improving update rollout and providing clear operator/user remediation steps.
	- Acceptance criteria: `service-worker.js` includes `src/worker.js` and `src/worker-globals.js` in the precache; release notes include an explicit `unregister` + hard-reload instruction; optionally provide a short in-app “Check for updates” button that triggers `skipWaiting()`.
	- Suggested steps:
		1. Confirm worker files are in precache and bump cache name on release.
		2. Add documentation snippet to README with steps to `navigator.serviceWorker.getRegistration()` -> `unregister()` for support staff.
		3. (Optional) Add a dev-only `Check for updates` control that calls `registration.waiting.postMessage({type:'SKIP_WAITING'})`.
	- Complexity: Small. Owner: platform/docs.

- Harden message id/callback handling and diagnostics
	- Goal: Reduce chance of unmatched messages and make root cause visible when worker posts early/unexpected messages.
	- Acceptance criteria: `worker-wrapper` logs unmatched message ids with a timestamp, summary (first 2KB), and pending callback count; tests simulate worker posting an `init` error before callback registration and confirm wrapper logs the unmatched message and surfaces the diagnostic to UI.
	- Suggested steps:
		1. Add structured unmatched-message logging in `worker-wrapper` and include a reserved diagnostics id namespace (e.g., `__diag__`).
		2. Add a compact summary function for payloads (type, size, first-n chars) to avoid log flooding.
	- Complexity: Small. Owner: core/browser.

- Standardize logging formats across UI, wrapper, and worker
	- Goal: Make cross-process correlations trivial by using consistent prefixes and a small JSON-summary shape for payloads/errors.
	- Acceptance criteria: All logs use prefixes `[ui]`, `[worker-wrapper]`, `[worker]`, and structured summaries contain `id`, `type`, `size`, `timestamp`.
	- Suggested steps:
		1. Define a one-page logging convention in `docs/Logging.md` (or README section).
		2. Update the most diagnostic-heavy places (`ui.js`, `worker-wrapper.js`, `worker-globals.js`) to follow the pattern.
	- Complexity: Small. Owner: infra.

- Tidy Node test warnings: add `type` to `package.json`
	- Goal: Remove `MODULE_TYPELESS_PACKAGE_JSON` warnings during Node test runs.
	- Acceptance criteria: Adding `"type": "module"` does not break test scripts; test runs show no module-type warnings.
	- Suggested steps:
		1. Add the field to `package.json` and run the full test suite locally.
		2. If any tests fail due to module type changes, revert and investigate per-file fixes (e.g., use `.cjs` for CommonJS tests).
	- Complexity: Small. Owner: infra/tests.

- Standardize test output formatting
	- Goal: Make CI and local test logs easier to scan by printing `Result: PASS` / `Result: FAIL` consistently.
	- Acceptance criteria: All `Tests/*.js` smoke scripts print `Result: PASS` on success and `Result: FAIL` on failure.
	- Suggested steps:
		1. Update test harness helpers or wrapper scripts to normalize final output.
		2. Run smoke and Playwright tests to confirm formatting.
	- Complexity: Small. Owner: tests.

- Run tests after changes and collect logs
	- Goal: Validate each change set with the native and Playwright smoke tests and store the logs for rollout verification.
	- Acceptance criteria: All tests pass locally and logs are archived to `tools/logs/<timestamp>/` for the release package.
	- Suggested steps:
		1. After each PR merge for the above items, run `npm run test:smoke:native` and `npm run test:ui-download-smoke` and collect logs.
		2. Add a small `tools/collect-logs.ps1` helper to tar/zip the logs folder for upload.
	- Complexity: Small. Owner: devops/tests.
## Next milestone (MHTML release)
1. Harden the MHTML-to-HTML pipeline against fixtures and metadata scenarios so outputs match modern semantic HTML expectations.
2. Expand targeted fixture tests for MHTML edge cases (tables, lists, whitespace, inline resources) and cross-browser smoke checks.
3. Verify existing toolbar/config behavior remains stable for the MHTML flow and document the acceptance gate for this release.

## Future native import milestone (post-stable)
1. Structured `.one` parser (replace heuristic text scraping with semantic block parsing).
2. Embedded resource mapping (images/attachments/object placeholders) with reliable HTML links.
3. Structured warning diagnostics (Option C): emit warning codes + backward-compatible warning strings for native import flows. (completed)
4. `.onepkg` deep extraction expansion (full nested groups/sections/pages from extracted `.one`).
5. Targeted fixture tests for parser/resource edge cases and compressed extraction paths.

## General / UI
- [ ] Review cleaned HTML output. (manual review pending)
- [ ] Audit accessibility of outputs.
- [x] Add badge icons + compact view improvements.
- [x] Re-design UI to look professional and accessible.
  - [x] Add Light/Dark theme toggle and polish dark mode.
  - [x] Add auto-convert checkbox in Advanced options and persist setting.
  - [x] Hide auto-convert notice when auto-convert is disabled.
  - [x] Detect and mark unsupported file types (MHTML-only release) and prevent processing.

## Conversion / Features
- [x] Implement optional single injected output toolbar in exported HTML with multiple advanced feature toggles. (spec locked: self-contained inline bundle; initial scope includes edit + metadata toggles on day one; execution split between high-leverage work and Raptor Mini grunt tasks)
- [x] Process entire notebooks to hierarchical folder ZIPs. (implemented: hierarchy + per-page downloads + ZIP export)
- [x] Run browser validation / smoke tests.
- [x] Enforce MHTML-only intake at UI layer; surface "Unsupported" for other formats (do not send to pipeline).

## Optional Feature Plan: Injected Output Toolbar (Cost-Optimized Delivery)

Delivery mode for this feature is now explicitly split:
- High-leverage design/integration decisions handled with stronger model support.
- Mechanical coding, wiring, fixtures, and repetitive test/docs tasks delegated to `Raptor Mini`.

### Phase 0 — Spec lock (before coding)
- [x] [HIGH-LEVERAGE] Finalize toolbar DOM contract: single namespaced container id, insertion point, reserved spacing behavior, no-overlap guarantee.
- [x] [HIGH-LEVERAGE] Finalize interaction contract for day-one scope:
	- Edit mode toggle (text-focused and reversible)
	- Metadata panel toggle
	- Close/hide behavior
- [x] [HIGH-LEVERAGE] Define deterministic idempotency rule (re-processing cannot duplicate toolbar markup).
- [x] [RAPTOR MINI] Mirror decisions in docs (`docs/Toolbar idea.md`, `docs/Contracts.md`, README note).

### Phase 1 — Config + wiring (default OFF)
- [x] [HIGH-LEVERAGE] Define canonical config shape + defaults for toolbar options in pipeline config normalization.
- [x] [RAPTOR MINI] Add UI controls for the single advanced toolbar:
	- Enable toolbar injection
	- Enable edit mode toggle feature
	- Enable metadata panel toggle feature
- [x] [RAPTOR MINI] Wire config through `src/ui.js` → worker payloads for both processing flows (`process-file`, `process-native-file`).
- [x] [RAPTOR MINI] Ensure default OFF keeps existing output parity and existing fixtures stable.

### Phase 2 — Implementation (single injector, reused everywhere)
- [x] [HIGH-LEVERAGE] Implement one shared, self-contained inline toolbar injector module (inline CSS + inline JS; no external asset dependency).
- [x] [RAPTOR MINI] Integrate injector into pipeline output path.
- [x] [HIGH-LEVERAGE] Integrate injector into native `.one` output path with minimal template duplication.
- [x] [RAPTOR MINI] Integrate injector into native `.onepkg` paths (placeholder + extracted pages) using same injector entrypoint.
- [x] [RAPTOR MINI] Add guard checks for single-instance injection.

### Phase 3 — Feature behavior hardening (day-one scope)
- [x] [HIGH-LEVERAGE] Finalize edit-mode boundaries (what is editable vs protected semantic scaffolding).
- [x] [RAPTOR MINI] Implement edit-mode toggling and state class hooks per spec.
- [x] [HIGH-LEVERAGE] Finalize metadata panel content schema (source names, profile, timestamp, parser diagnostics summary).
- [x] [RAPTOR MINI] Implement metadata panel rendering/toggling with accessible labels and keyboard focus order.
- [x] [RAPTOR MINI] Implement close/hide behavior and ensure reversibility.

### Phase 4 — Validation + release gating
- [ ] [HIGH-LEVERAGE] Define acceptance matrix:
	- OFF mode: no output change across pipeline/native flows
	- ON mode: deterministic toolbar injection exactly once
	- Exported HTML opens standalone without runtime dependency on app assets
- [ ] [RAPTOR MINI] Add fixture tests for toolbar OFF parity and toolbar ON behavior.
- [ ] [RAPTOR MINI] Add native-path checks for `.one` and `.onepkg` outputs with toolbar enabled.
- [ ] [RAPTOR MINI] Keep current native test suite green (`test:semantic:native`, `test:metadata:onepkg`, `test:warnings:contract`, `test:smoke:native`).
- [ ] [HIGH-LEVERAGE] Final review pass for UX clarity, accessibility, and scope discipline.

### Delegation checklist for `Raptor Mini` sessions
- [ ] Use small, file-scoped prompts (one file or one integration point per prompt).
- [ ] Require no speculative refactors outside scoped files.
- [ ] Require tests to run after each change batch.
- [ ] Escalate architecture or behavior ambiguities for high-leverage review instead of guessing.

## Highest priority (native fidelity)
- [ ] Replace heuristic `.one` text extraction with a structured parser that preserves page layout semantics (headings, lists, tables, whitespace, section boundaries). (in progress — phase 3 added semantic confidence filtering, tighter page segment windows, low-confidence diagnostics, and direct parser semantic test coverage)
- [x] Improve table/list detection and rendering in `.one` renderer (supports tab/pipe/multi-space splitting, markdown separators, row normalization).
- [ ] Add extraction support for embedded resources from native payloads (images, attachments, object placeholders) and map them into exported HTML. (in progress — inline images + attachment candidates + object placeholder hints extracted; ZIP resource export wiring added)
- [x] Preserve page metadata (title, created/modified timestamps, author fields where available) and render it consistently in output HTML. (implemented — canonical metadata extraction (`title`/`author`/`createdAt`/`modifiedAt`) for `.one` pages, metadata propagation into `.onepkg`-derived pages, and ZIP `*.metadata.json` sidecars)
- [x] Option C (deep): standardize native parser diagnostics as structured warning codes while keeping existing warning strings for UI/tests backward compatibility. (implemented — `warningDetails`, `WARNING_CODES`, UI migration, structured tests, and `test:warnings:contract`.)
- [ ] Improve HTML output templating for native pages so structure and spacing are represented instead of flat preview lists. (in progress)

## `.onepkg` deep extraction
- [x] Add proper in-app decode path for compressed CAB folders (LZX/MSZIP) — implemented a libarchive.js WASM fallback for LZX and MSZIP; next: optional native LZX WASM decoder integration.
- [x] Add reproducible `libmspack` WASM build tooling for Windows + WSL (`npm run build:libmspack:wasm`, `:wsl`, and `:wsl:check`) with automatic WSL fallback when native POSIX tools are unavailable.
- [ ] Expand section extraction to parse full page trees from extracted `.one` binaries, including nested groups/sections/pages. (in progress — folder/cab parsing added; deeper extraction ongoing)
- [x] Keep browser fallback UX for unsupported compression, but include clearer post-extract import guidance and verification steps. (helper panel + PowerShell command added)

## Quality + validation
- [x] Add regression fixtures for `Tests/Test Section.one` and `Tests/Test Notebook.onepkg` that check for minimum content fidelity (tables/images/metadata markers).
- [x] Add smoke checks for native output in `Tests/Cleaned` to ensure links, ZIP export, and hierarchy rendering remain stable.
- [x] Define acceptance criteria for “content fidelity” (structure, tables, images, whitespace, metadata) and use it as a release gate for native parsing.
- [x] Add dedicated metadata propagation regression test for `.onepkg` import (`Tests/metadata-onepkg-parser.js`) and wire npm script (`test:metadata:onepkg`).
- [x] Add warning-code contract test (`Tests/warning-code-contract.js`) and npm script (`test:warnings:contract`).
- [x] Centralize warning codes and helpers (`src/importers/warnings.js`) and migrate importers/UI/tests to use them.
- [x] Add unit/fixture tests for ZIP/button behavior and a browser smoke page (`Tests/ui-download-zip.html`).
- [ ] Add targeted unit/fixture tests for table-edge cases and compressed `.onepkg` LZX extraction paths; keep metadata regression coverage green (`test:semantic:native` + `test:metadata:onepkg`).
- [x] Add npm script for download tests (`test:ui-downloads`).
- [x] Automate browser smoke test (headless) for `Tests/ui-download-zip.html`.
- [x] Add Playwright smoke test for theme toggle & persistence (`Tests/theme-playwright.js`).
- [ ] Add Playwright smoke test for auto-convert & unsupported-file flows (`Tests/auto-convert-playwright.js`).

## Product/docs follow-up
- [ ] Document current native limitations and expected fidelity in README/docs to set realistic user expectations until parser work lands.
- [ ] Decide whether to prioritize in-browser decoder integration or a hybrid companion-tool workflow for compressed notebooks. (in progress — libarchive.js fallback implemented; research/integration pending)
- [ ] Polish page naming for GUID-like section/page titles (make friendly display names for downloads).

---

If you move a TODO from code into this file, consider adding a short code comment to indicate the task was centralized, e.g. `// todo: moved to TODO.md`. 
