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
