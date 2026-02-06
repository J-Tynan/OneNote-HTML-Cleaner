# Architecture

- Static PWA (index.html + ES modules)
- Processing performed in a module Web Worker
- Pipeline modules under `src/pipeline/`
- UI communicates with worker via `postMessage` using Contracts.md shapes
- Output: per-file cleaned HTML and optional ZIP export (JSZip later)