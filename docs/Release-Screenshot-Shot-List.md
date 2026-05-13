# v0.1 Release Screenshot Shot List

Use this document to capture the final release screenshots for `0.1.0`.

Save all captured files under `assets/release/` using the filenames below so the later README update can reference them directly without renaming.

## Capture Setup

- Use a clean browser profile on the current `main` build.
- Use one browser consistently for the full set.
- Keep the viewport consistent across the four primary product screenshots.
- Avoid visible devtools, unrelated tabs, noisy desktop chrome, or stale queue state.
- If the app looks stale after deployment, reload first. Only unregister the service worker if stale assets still persist.

## Required Files

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
- Scene: Advanced options expanded with Export format set to Markdown and Markdown flavor set to Obsidian
- Caption: Advanced options expose optional Markdown export controls without changing the default HTML workflow.
- Alt text: Advanced options expanded with Markdown export selected and Obsidian chosen as the Markdown flavor.
- Notes: keep the view focused on the controls; avoid crowding the frame with unrelated results.

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

## Recommended Capture Order

1. `release-import-workflow.png`
2. `release-advanced-options-markdown.png`
3. `release-converted-output.png`
4. `release-zip-export.png`
5. `release-accessibility-structure.png`

This order minimizes repeated setup changes in the app state.

## Completion Check

Before handing the screenshots back for integration, confirm all five files exist in `assets/release/` and that none of them still need cropping, renaming, or caption changes.