# Architecture

- Static PWA (index.html + ES modules)
- Processing performed in a module Web Worker
- Pipeline modules under `src/pipeline/`
- UI communicates with worker via `postMessage` using Contracts.md shapes
- Output: per-file cleaned HTML and optional ZIP export (JSZip later)

## Pipeline flow
1. MHT parsing: extract HTML and build an image map.
2. Parse HTML into a DOM Document.
3. Sanitize: ensure head metadata, remove OneNote meta, remove NBSP.
4. List repair: remove empty items, infer list types, and repair numbering.
5. Embed images using the image map.
6. Serialize without collapsing whitespace.