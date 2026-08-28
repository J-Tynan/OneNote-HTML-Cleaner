# v0.2 Release Screenshot Inventory

Use this document as the filename, scene, caption, and alt-text source of truth for `0.2.0`.

The current `v0.2` screenshot set is already captured under `assets/release/`. This document keeps the public wording aligned across `README.md`, `RELEASE_NOTES.md`, and the release checklist.

## Asset Status

- Keep all current release assets under `assets/release/` with the filenames below.
- Do not recapture or rename assets unless the product UI changes enough that the current image becomes misleading.
- If wording drifts from what an image actually shows, update the docs to match the captured asset rather than inventing a cleaner description.

## Current Files

### 1. Main import workflow

- Filename: `assets/release/release-import-workflow.png`
- Scene: homepage import panel with one queued `.mht` file and the primary convert action visible
- Caption: Import MHTML files, review the queue, and convert in a single browser-first workflow.
- Alt text: Homepage showing the import panel, one queued MHTML file, and the convert action.
- Notes: keep the queue small and readable; show the core homepage flow rather than advanced settings.

### 2. Converted page output

- Filename: `assets/release/release-converted-output.png`
- Scene: converted page showing headings, lists, a table, and a handwriting raster
- Caption: Converted output preserves document structure, tables, and handwriting as raster content.
- Alt text: Converted page showing headings, lists, a table, and preserved handwriting as a raster image.
- Notes: choose a converted page that reads clearly at screenshot scale and includes the handwriting raster in-frame.

### 3. Advanced options

- Filename: `assets/release/release-advanced-options-markdown.png`
- Scene: Advanced options expanded with optional output controls visible, including externalized CSS, Markdown export, converted-page theme toggle, and toolbar injection
- Caption: Advanced options expose optional output controls such as externalized CSS, Markdown export, converted-page theme toggles, and toolbar injection without changing the default HTML workflow.
- Alt text: Advanced options expanded with externalized CSS, Markdown export, converted-page theme toggle, and toolbar injection controls visible.
- Notes: this asset is not Markdown-only anymore; keep the wording aligned to the current captured image while preserving that these features are optional.

### 4. ZIP export

- Filename: `assets/release/release-zip-export.png`
- Scene: ZIP export result showing readable filenames
- Caption: Batch exports produce readable filenames that are easier to store and share.
- Alt text: ZIP export result showing multiple converted files with readable filenames.
- Notes: capture the clearest product-visible proof of readable filenames. If file explorer framing is necessary, keep it tight and legible.

### 5. Accessibility note asset

- Filename: `assets/release/release-accessibility-structure.png`
- Scene: exported HTML structure showing one page-level `h1` and a `<main>` landmark
- Caption: Exported HTML keeps a single page-level heading and a main landmark for a cleaner accessibility baseline.
- Alt text: Exported HTML structure highlighting a single page-level h1 and a main landmark.
- Notes: this can be a supporting figure rather than a hero image. Prioritize clarity of the structure evidence over visual polish.

## Alignment Check

- The caption and alt-text strings for these five assets should match exactly in `README.md` and `docs/Release-Go-No-Go-Checklist.md`.
- `RELEASE_NOTES.md` should describe the same feature set and release scope without needing to repeat every caption verbatim.
- Keep the release copy narrow: browser-first MHTML cleaning, optional advanced features, unsupported native `.one` and `.onepkg`, and no broader browser-support claims than the recorded verification supports.
