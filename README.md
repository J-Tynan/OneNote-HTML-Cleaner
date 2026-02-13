# [WIP] OneNote HTML Cleaner

OneNote HTML Cleaner is being refactored from a single PowerShell script into a framework-free Progressive Web App (PWA). The goal is to provide an offline-capable, browser-based workflow for cleaning exported OneNote HTML with a modular, testable pipeline.

## Current Status

- PWA scaffold in place (HTML, CSS, manifest, service worker).
- Modular pipeline layout created under `src/pipeline/`.
- Initial test and fixture structure added.
- ZIP export support via JSZip (requires `npm install`).
- Tailwind utility baseline added for converted Cornell-style output (non-destructive, no preflight reset).

## Project Structure

- `index.html`, `styles.css`, `manifest.json`, `service-worker.js`: PWA shell.
- `src/app.js`, `src/ui.js`: UI wiring and application entry points.
- `src/worker.js`, `src/worker-wrapper.js`: future background processing.
- `src/pipeline/`: parsing, sanitization, and formatting stages.
- `tests/fixtures/`: sample inputs for regression coverage.
- `package.json`: dependencies for ZIP export.

## Local Setup

1. Run `npm install` to fetch JSZip for ZIP exports.
2. Run `npm run build:tailwind` to generate `assets/tailwind-output.css`.
3. Serve the project with a local web server that can access `node_modules/`.

## Tailwind Migration (Scoped)

- Tailwind runs with `preflight` disabled to avoid global resets.
- Pipeline adds semantic classes for Cornell-style tables/cells:
	- `table` -> `cornell-table`
	- cue column cell -> `cues`
	- notes column cell -> `notes`
- Cue-column lists are normalized with utility classes (`list-inside`, `pl-0`) while preserving numbering.
- Safe inline style migration maps only:
	- `font-family`, `font-size`, `font-weight`, `margin-top`, `margin-bottom`
- Layout-critical width/structure styles are kept inline for fidelity.

## Conversion Profiles

- `Cornell (tuned)`: current default in the UI, optimized for Cornell-style note pages.
- `Generic OneNote`: broader mode for varied pages; Cornell-specific transforms are disabled, while list indentation normalization and created date/time row merge remain enabled.

The conversion profile is selected in the app UI and passed to the pipeline as `config.Profile`.

## Native OneNote files (Phase 1)

- `.one` and `.onepkg` files are now accepted in the file picker and drag/drop flow.
- `.one` processing currently:
	- Validates native section signature.
	- Extracts page-title candidates using metadata/string heuristics.
	- Builds per-page HTML placeholders for individual downloads.
	- Supports per-file ZIP export that preserves section/page hierarchy.
- `.onepkg` processing currently:
	- Validates CAB container signature (`MSCF`).
	- Reads archive entries and derives `Section Groups > Section > Page` hierarchy.
	- Attempts deep extraction by decoding uncompressed section payloads and reusing `.one` extraction.
	- Falls back to per-section downloadable HTML placeholders when CAB compression is unsupported in-browser (e.g. `lzx`).
	- ZIP export includes these generated pages under notebook/section folder structure.
	- For fully extracted content on compressed notebooks, export from OneNote to `.one` or `.mht` and convert those files in this tool.

### Windows helper for compressed `.onepkg`

Use the included script to extract compressed notebook packages via `expand.exe`:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\Extract-OnePkg.ps1 -InputPath .\Tests\"Test Notebook.onepkg" -Force
```

The script writes an `*.extracted` folder (or your custom output path) with section files (`*.one`). You can then import those `.one` files into this app for richer conversion.

### Build `libmspack` WASM artifact (optional)

If you want to experiment with a dedicated CAB/LZX decoder path, you can build a reproducible `libmspack` WASM module:

```powershell
npm run build:libmspack:wasm
```

On Windows, this command now auto-falls back to the WSL build runner when native `bash`/`make` are not available.

Or run fully inside WSL from PowerShell (recommended on Windows):

```powershell
npm run build:libmspack:wasm:wsl
```

Notes:

- Requires Emscripten SDK (`emcc`) installed locally.
- Requires POSIX build tools (`bash` + `make`) because `libmspack` uses autotools.
- WSL variant requirements are checked with:

```powershell
npm run build:libmspack:wasm:wsl:check
```

- If `emcc` is not globally available in your shell, pass the SDK location directly:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\Build-LibmspackWasm.ps1 -EmsdkPath C:\emsdk
```

- Output artifacts are written to `assets/wasm/` as:
	- `libmspack-core.js`
	- `libmspack-core.wasm`

This phase establishes native file routing, hierarchy handling, and section-level native downloads. Full fidelity page-content extraction for native formats is still in progress.

## Refactor Goals

1. Preserve the existing PowerShell script behavior while improving portability.
2. Separate parsing, cleanup, and formatting into explicit pipeline stages.
3. Add automated tests around edge cases from real OneNote exports.
4. Provide a simple, offline-capable UI for drop-in HTML cleaning.

## Planned Next Steps

- Implement the pipeline stages with OneNote-specific rules.
- Add worker-based processing for large documents.
- Create a minimal UI for file import and preview.
- Expand fixtures and add test runner integration.

## PowerShell Legacy Script

The original script is still present for reference and parity checks until the PWA pipeline fully matches its output.
