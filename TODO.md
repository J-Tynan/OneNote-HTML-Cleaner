# TODO

All project TODO items are tracked here. Please do not leave TODO comments in source files — add or update entries in this file instead.

This file was merged with `TODOs.md` to keep a single canonical task list for the project.

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
- [ ] Replace heuristic `.one` text extraction with a structured parser that preserves page layout semantics (headings, lists, tables, whitespace, section boundaries). (in progress — prototype renderer added)
- [x] Improve table/list detection and rendering in `.one` renderer (supports tab/pipe/multi-space splitting, markdown separators, row normalization).
- [ ] Add extraction support for embedded resources from native payloads (images, attachments, object placeholders) and map them into exported HTML. (in progress — inline images extracted)
- [ ] Preserve page metadata (title, created/modified timestamps, author fields where available) and render it consistently in output HTML. (in progress — basic metadata detection added)
- [ ] Improve HTML output templating for native pages so structure and spacing are represented instead of flat preview lists. (in progress)

## `.onepkg` deep extraction
- [x] Add proper in-app decode path for compressed CAB folders (LZX/MSZIP) — implemented a libarchive.js WASM fallback for LZX and MSZIP; next: optional native LZX WASM decoder integration.
- [ ] Expand section extraction to parse full page trees from extracted `.one` binaries, including nested groups/sections/pages. (in progress — folder/cab parsing added; deeper extraction ongoing)
- [x] Keep browser fallback UX for unsupported compression, but include clearer post-extract import guidance and verification steps. (helper panel + PowerShell command added)

## Quality + validation
- [x] Add regression fixtures for `Tests/Test Section.one` and `Tests/Test Notebook.onepkg` that check for minimum content fidelity (tables/images/metadata markers).
- [x] Add smoke checks for native output in `Tests/Cleaned` to ensure links, ZIP export, and hierarchy rendering remain stable.
- [x] Define acceptance criteria for “content fidelity” (structure, tables, images, whitespace, metadata) and use it as a release gate for native parsing.
- [ ] Add targeted unit/fixture tests for table-edge cases and `.onepkg` LZX extraction path.

## Product/docs follow-up
- [ ] Document current native limitations and expected fidelity in README/docs to set realistic user expectations until parser work lands.
- [ ] Decide whether to prioritize in-browser decoder integration or a hybrid companion-tool workflow for compressed notebooks. (in progress — libarchive.js fallback implemented; research/integration pending)
- [ ] Polish page naming for GUID-like section/page titles (make friendly display names for downloads).

---

If you move a TODO from code into this file, consider adding a short code comment to indicate the task was centralized, e.g. `// todo: moved to TODO.md`. 
