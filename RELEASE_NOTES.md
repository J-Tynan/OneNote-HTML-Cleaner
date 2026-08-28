# Release Notes

<!-- markdownlint-disable MD024 -->

## 0.2.0 - Unreleased

Stabilization and polish release for the browser-first OneNote MHTML cleanup workflow.

### Highlights

- Hardened the MHTML-to-HTML pipeline against edge-case list, table, whitespace, and inline-resource regressions while keeping deterministic output.
- Consolidated release-path browser-test helpers so the shipped workflow is faster to verify and maintain.
- Polished high-visibility homepage and results controls for steadier desktop and mobile presentation.
- Tightened release-facing copy, screenshot wording, and reusable launch notes so the current shipped workflow is described consistently.
- Kept Markdown export, externalized CSS, converted-page theme toggles, and toolbar injection explicitly optional advanced features.

### Supported In This Release

- Input: `.mht`, `.mhtml`
- Output: cleaned HTML by default, optional Markdown through the advanced export controls
- Workflow: drag and drop or file picker import, auto-convert or manual convert, single-file download or ZIP download
- Optional HTML-only extras: converted-page theme toggle, toolbar injection, and externalized CSS when the workflow keeps related assets together

### Known Limitations

- Native OneNote `.one` and `.onepkg` files are detected for clearer messaging but are not converted in the shipped runtime.
- `.docx` export remains out of scope for `0.2.0`.
- Handwriting from exported MHTML is preserved as raster content rather than editable vector ink.
- Externalized CSS, toolbar injection, and converted-page theme toggle remain opt-in and are best suited to workflows that keep related assets together.

### Notes For Release Review

- The shipped production path remains browser-first OneNote MHTML cleaning.
- Advanced export and converted-page features remain optional and do not change the default HTML workflow.
- If the app appears to be running stale assets after an update, reload the page first. If the older worker still persists, unregister the service worker and reload.
- Keep browser-support wording scoped to the browsers actually exercised during the final `v0.2` verification pass.

## 0.1.0 - 2026-05-12

First stable release of the browser-first MHTML to clean HTML workflow.

### Highlights

- Stable conversion path for exported OneNote `.mht` and `.mhtml` files.
- Browser-first PWA workflow with offline availability after the first load.
- Batch conversion with ZIP export and deterministic, readable exported filenames.
- Optional Markdown export, with Obsidian as the default Markdown flavor.
- Improved first-run usability with a clearer homepage layout, in-app Help, keyboard-operable controls, and persisted theme preference.
- Same-tab queue and completed-result recovery across unexpected reload or tab discard.

### Supported In This Release

- Input: `.mht`, `.mhtml`
- Output: cleaned HTML by default, optional Markdown through the advanced export controls
- Workflow: drag and drop or file picker import, auto-convert or manual convert, single-file download or ZIP download

### Known Limitations

- Native OneNote `.one` and `.onepkg` files are detected for clearer messaging but are not converted in the shipped runtime.
- `.docx` export is out of scope for `0.1.0`.
- Handwriting from exported MHTML is preserved as raster content rather than editable vector ink.
- Externalized CSS is intended for ZIP-style export workflows where the HTML and CSS assets stay together.

### Notes For Existing Testers

- The stable release contract is intentionally narrow: the validated production path is exported OneNote MHTML only.
- If the app appears to be running stale assets after an update, reload the page first. If the older worker still persists, unregister the service worker and reload.
- Final release validation for this line includes the native regression gate, focused Playwright smoke coverage, accessibility audits, and a recorded manual acceptance pass on the core fixtures.

## 2026-02-16 - UI refinement

- Polished the landing copy, import helper text, and advanced-option guidance so first-time users can understand the workflow without sacrificing the existing semantic layout or import-focused hierarchy.
- Preserved the dominant import panel, collapsed advanced controls, grouped optional toggles, and dedicated future-expansion space while refreshing the wording for a more professional feel; the UI continues to make room for badge icons and a compact view as documented in TODO.
- Validated the change with `npm run test:toolbar` (non-blocking module-type warning remains from the current `import()` shim path).

<!-- markdownlint-enable MD024 -->
