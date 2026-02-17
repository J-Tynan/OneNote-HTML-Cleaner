# [WIP] OneNote HTML Cleaner

OneNote HTML Cleaner is being refactored from a single PowerShell script into a framework-free Progressive Web App (PWA). The goal is to provide an offline-capable, browser-based workflow for cleaning exported OneNote HTML with a modular, testable pipeline.

## Current Status

- PWA scaffold in place (HTML, CSS, manifest, service worker).
- Modular pipeline layout created under `src/pipeline/`.
- Initial test and fixture structure added.
- ZIP export support via JSZip (requires `npm install`).
- Tailwind utility baseline added for converted Cornell-style output (non-destructive, no preflight reset).
 - MHTML → modern HTML conversion pipeline: nearly complete (core transforms and formatting mostly implemented).
 - Experimental support for native OneNote files (`.one`, `.onepkg`) is available but not fully implemented; see the "Native OneNote files" section for known limitations and recommended developer workflows.
 - Release note: The first stable release targets MHTML files only (`.mht`, `.mhtml`). Other formats (plain `.html`, `.one`, `.onepkg`, etc.) are intentionally out of scope for the initial release and will be added in future feature branches.

## UI experience

- The front-end now follows a lightweight state machine: the import panel is always the dominant action, the status panel describes Empty → Processing → Completed/Partial, and diagnostics only appear when work is underway or issues occur.
- Advanced controls live in a collapsed `<details>` block labeled “Advanced options (Optional)” so the surface stays calm while still letting power users tweak conversion profile, native toolbar toggles, and status filters.
- Semantic layout (`header`, `main`, `section`, `footer`) plus Tailwind utility spacing/typography keep the experience accessible without extra frameworks, matching the offline-first promise of the app.
- The UI now includes a Light / Dark theme toggle (top-right). It defaults to Light on first visit and records that choice to `localStorage`; subsequent toggles persist the user's preference.
 - The app enforces an MHTML-only intake for the stable release: non-MHTML files are shown as "Unsupported" in the queue and are not sent to the conversion pipeline (no partial conversions, no silent failures).
 - Advanced options now include an "Automatically convert files when added to the queue" toggle. When disabled, files remain in the queue until the user starts conversion manually; the preference persists across sessions.

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

## Testing

- Automated tests include lightweight Node checks and Playwright smoke tests. Current Playwright smoke tests cover theme initialization/toggling and ZIP/download flows (`Tests/theme-playwright.js`, `Tests/ui-download-zip-playwright.js`).
- Additions: there are unit tests for download helpers and other pipeline contracts under `Tests/`.

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

## Native OneNote files (Phase 1) — Experimental

- Note: native `.one` and `.onepkg` handling is experimental and partial. The app accepts these files in the picker and via drag/drop, but full in-browser extraction for all compressed notebooks is not yet implemented. Some flows will fall back to placeholder exports or require developer-side preprocessing.

- `.one` processing (experimental/partial):
	- Attempts to validate native section signatures when possible.
	- Tries to extract page-title candidates and canonicalize basic metadata (`title`, `author`, `createdAt`, `modifiedAt`).
	- Produces per-page HTML placeholders and metadata sidecars (`*.metadata.json`) for ZIP exports when full content extraction isn’t available.

- `.onepkg` processing (experimental/partial):
	- Detects CAB container signature (`MSCF`) and enumerates archive entries to derive notebook hierarchy.
	- May decode uncompressed section payloads and reuse `.one` extraction logic, but compressed payloads (for example, LZX) are not fully decoded in-browser yet.
	- For compressed notebooks, the pipeline currently falls back to per-section placeholders or recommends exporting to `.one`/`.mht` and importing those files for richer conversion.
	- ZIP exports include generated pages and metadata when possible, but exact fidelity varies with archive compression.

### Windows helper for compressed `.onepkg`

Use the included helper script to extract compressed notebook packages locally (see `tools/Extract-OnePkg.ps1`).

> Note: extraction is a local developer operation — run the tool on your machine and import the resulting `*.one` section files into the app.

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

- If `emcc` is not globally available in your shell, pass the SDK location directly by running the local build helper `tools/Build-LibmspackWasm.ps1` (run it from PowerShell on your development machine).

- Output artifacts are written to `assets/wasm/` as:
	- `libmspack-core.js`
	- `libmspack-core.wasm`

This phase establishes native file routing, hierarchy handling, and section-level native downloads. Full fidelity page-content extraction for native formats is still in progress.

## Optional injected toolbar (experimental)

- An opt-in single injected output toolbar is planned and currently spec-locked in `docs/Toolbar-Phase0-Spec.md`.
- Default is OFF to preserve output parity and test stability.
- Day-one scope includes multiple feature toggles within that single toolbar:
	- Edit mode toggle (text-focused and reversible)
	- Metadata panel toggle (read-only provenance)
	- Close/hide control
- Bundle model is self-contained inline only for standalone exported HTML compatibility.

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
