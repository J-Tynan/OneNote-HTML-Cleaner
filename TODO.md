# TODO

All project TODO items are tracked here. Please do not leave TODO comments in source files — add or update entries in this file instead.

This file was merged with `TODOs.md` to keep a single canonical task list for the project.

## Current focus (PWA first)
- [ ] Keep scope centered on browser-first parsing + conversion of OneNote formats to clean modern HTML.
- [ ] Prioritize extraction fidelity and HTML structure before UI polish/advanced features.
- [ ] Treat optional native helper tooling (WASM/CLI) as support work, not the main product surface.

## Next milestone (ordered)
1. Structured `.one` parser (replace heuristic text scraping with semantic block parsing).
2. Embedded resource mapping (images/attachments/object placeholders) with reliable HTML links.
3. Structured warning diagnostics (Option C): emit warning codes + backward-compatible warning strings for native import flows. (completed)
4. `.onepkg` deep extraction expansion (full nested groups/sections/pages from extracted `.one`).
5. Targeted fixture tests for parser/resource edge cases and compressed extraction paths.

## General / UI
- [ ] Review cleaned HTML output. (manual review pending)
- [ ] Audit accessibility of outputs.
- [ ] Add badge icons + compact view improvements.
- [ ] Re-design UI to look professional and accessible.

## Conversion / Features
- [ ] Investigate whether we can inject advanced features into our conversion process (such as adding a closable toolbar in the exported HTML).
- [x] Process entire notebooks to hierarchical folder ZIPs. (implemented: hierarchy + per-page downloads + ZIP export)
- [x] Run browser validation / smoke tests.

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
