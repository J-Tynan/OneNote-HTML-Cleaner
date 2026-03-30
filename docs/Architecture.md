# Architecture

- Static PWA (index.html + ES modules)
- Processing performed in a module Web Worker
- Pipeline modules under `src/pipeline/`
- UI communicates with worker via `postMessage` using Contracts.md shapes
- Output: per-file cleaned HTML and optional ZIP export (JSZip later)
- Import flow: file picker and drag/drop may receive `.mht`, `.mhtml`, `.html`, `.htm`, `.one`, `.onepkg`, but the stable runtime only processes the MHTML path. Native `.one` / `.onepkg` detection is retained only so unsupported files can be surfaced clearly in the UI.

## Pipeline flow
1. MHT parsing: extract HTML and build an image map.
2. Parse HTML into a DOM Document.
3. Sanitize: ensure head metadata, remove OneNote meta, remove NBSP.
4. List repair: remove empty items, infer list types, and repair numbering.
5. Embed images using the image map.
6. Serialize without collapsing whitespace.

## Deferred tag parsing flow (post-release)

- The stable release does not yet perform semantic OneNote tag parsing.
- Post-release tag work should add a dedicated tag-annotation pass in `src/pipeline/pipeline.js` after `sanitize.removeNbsp(doc)` and before later semantic/layout normalization.
- The first tag-parser scope is limited to built-in default OneNote tags detected at block-leading positions in exported MHTML/HTML.
- Canonical output for that future pass should use public `onenote-tag` markup rather than internal-only `data-onc-*` attributes.
- Renderer concerns such as emoji, SVG icons, toolbar insertion, and summaries remain separate follow-on work after the semantic contract is in place.

Reference: `docs/OneNote Tag Parsing Research.md`

## Native OneNote import flow (deferred)
1. UI still detects source kind (`html`, `mht`, `one`, `onepkg`) so unsupported native files can be identified clearly.
2. Stable runtime behavior stops at that intake boundary: `.one` and `.onepkg` are marked unsupported and are not routed through the shipped worker pipeline.
3. Importer modules under `src/importers/` remain deferred implementation assets for a future native-enabled release; they are not part of the active stable-runtime architecture.
4. Full page-content extraction for compressed CAB folders (for example LZX) remains planned work, not active architecture in the stable release.

## Windows companion extraction
- `tools/Extract-OnePkg.ps1` uses `expand.exe` to unpack compressed `.onepkg` files into section files (`*.one`).
- Extracted sections are useful for deferred native importer development, but they are not part of the current stable app flow.

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
3. Worker message pass-through for the stable processing type plus deferred native design contracts
	- `src/worker.js`
4. Pipeline output injection path
	- `src/pipeline/pipeline.js`
5. Deferred native output injection paths
	- `src/importers/one.js`
	- `src/importers/onepkg.js`

### Day-one behavior envelope

- Edit mode toggle applies only to approved text nodes.
- Metadata panel is read-only provenance output.
- Close/hide is reversible and non-destructive.