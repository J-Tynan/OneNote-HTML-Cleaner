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
	- `one.js`: validates OneNote section signature and returns section scaffold.
	- `onepkg.js`: validates CAB signature (`MSCF`) and builds hierarchy from CAB entries.
3. UI renders returned hierarchy and parser warnings.
4. Full page extraction and hierarchy-preserving ZIP export are planned next.