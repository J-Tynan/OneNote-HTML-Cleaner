# [WIP] OneNote HTML Cleaner

OneNote HTML Cleaner is being refactored from a single PowerShell script into a framework-free Progressive Web App (PWA). The goal is to provide an offline-capable, browser-based workflow for cleaning exported OneNote HTML with a modular, testable pipeline.

## Current Status

- PWA scaffold in place (HTML, CSS, manifest, service worker).
- Modular pipeline layout created under `src/pipeline/`.
- Initial test and fixture structure added.

## Project Structure

- `index.html`, `styles.css`, `manifest.json`, `service-worker.js`: PWA shell.
- `src/app.js`, `src/ui.js`: UI wiring and application entry points.
- `src/worker.js`, `src/worker-wrapper.js`: future background processing.
- `src/pipeline/`: parsing, sanitization, and formatting stages.
- `tests/fixtures/`: sample inputs for regression coverage.

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
