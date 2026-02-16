# Architecture

- Static PWA (index.html + ES modules)
- Processing performed in a module Web Worker
- Pipeline modules under `src/pipeline/`
- UI communicates with worker via `postMessage` using Contracts.md shapes
- Output: per-file cleaned HTML and optional ZIP export (JSZip later)
- Import flow: file picker and drag/drop accept `.mht`, `.mhtml`, `.html`, `.htm`, `.one`, `.onepkg`

## Pipeline flow
1. MHT parsing: extract HTML and build an image map.
2. Parse HTML into a DOM Document.
3. Sanitize: ensure head metadata, remove OneNote meta, remove NBSP.
4. List repair: remove empty items, infer list types, and repair numbering.
5. Embed images using the image map.
6. Serialize without collapsing whitespace.

## Native OneNote import flow (in progress)
1. UI detects source kind (`html`, `mht`, `one`, `onepkg`) and reads native files as `ArrayBuffer`.
2. Worker routes native payloads to `src/importers/` adapters:
	- `one.js`: validates OneNote section signature and derives page titles for per-page HTML generation.
	- `onepkg.js`: validates CAB signature (`MSCF`), parses CAB folder/file tables, attempts section-byte extraction for uncompressed folders, and falls back to section placeholders for compressed folders.
3. UI renders returned hierarchy and parser warnings.
4. Full page-content extraction for compressed CAB folders (e.g., LZX) is planned next.

## Windows companion extraction
- `tools/Extract-OnePkg.ps1` uses `expand.exe` to unpack compressed `.onepkg` files into section files (`*.one`).
- Extracted sections can be imported directly through the existing native `.one` flow for richer conversion output.

## Optional injected toolbar architecture (Phase 0 locked)

Contract reference: `docs/Toolbar-Phase0-Spec.md`

- Toolbar is opt-in and default OFF.
- Bundle mode is inline/self-contained only in current phase.
- Injection must be idempotent and must not alter core conversion semantics.

### Touchpoints

1. Config normalization and defaults
	- `src/pipeline/config.js`
2. UI controls and payload construction
	- `src/ui.js`
	- `index.html`
3. Worker message pass-through for both processing types
	- `src/worker.js`
4. Pipeline output injection path
	- `src/pipeline/pipeline.js`
5. Native output injection paths
	- `src/importers/one.js`
	- `src/importers/onepkg.js`

### Day-one behavior envelope

- Edit mode toggle applies only to approved text nodes.
- Metadata panel is read-only provenance output.
- Close/hide is reversible and non-destructive.