# TODO

All project TODO items are tracked here. Please do not leave TODO comments in source files — add or update entries in this file instead.

This file was merged with `TODOs.md` to keep a single canonical task list for the project.

## Current focus (PWA first)
- [ ] Keep scope centered on browser-first parsing + conversion of MHTML to clean modern HTML.
- [ ] Prioritize extraction fidelity and HTML structure before UI polish/advanced features.
- [ ] Treat optional native helper tooling (WASM/CLI) as support work, not the main product surface.
- [ ] Explicitly defer `.one` and `.onepkg` structural parsing to a later milestone so the first stable release ships on the reliable MHTML path.

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

## Conversion / Features
- [x] Implement optional single injected output toolbar in exported HTML with multiple advanced feature toggles. (spec locked: self-contained inline bundle; initial scope includes edit + metadata toggles on day one; execution split between high-leverage work and Raptor Mini grunt tasks)
- [x] Process entire notebooks to hierarchical folder ZIPs. (implemented: hierarchy + per-page downloads + ZIP export)
- [x] Run browser validation / smoke tests.

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
- [ ] Add targeted unit/fixture tests for table-edge cases and compressed `.onepkg` LZX extraction paths; keep metadata regression coverage green (`test:semantic:native` + `test:metadata:onepkg`).

## Product/docs follow-up
- [ ] Document current native limitations and expected fidelity in README/docs to set realistic user expectations until parser work lands.
- [ ] Decide whether to prioritize in-browser decoder integration or a hybrid companion-tool workflow for compressed notebooks. (in progress — libarchive.js fallback implemented; research/integration pending)
- [ ] Polish page naming for GUID-like section/page titles (make friendly display names for downloads).

---

If you move a TODO from code into this file, consider adding a short code comment to indicate the task was centralized, e.g. `// todo: moved to TODO.md`. 
