# Release Notes

<!-- markdownlint-disable MD024 -->

## 1.0.0 - Unreleased

Browser-first production release for the supported OneNote MHTML cleanup workflow.

### Highlights

- Hardened the MHTML-to-HTML pipeline against edge-case list, table, whitespace, and inline-resource regressions while keeping deterministic output.
- Consolidated release-path browser-test helpers so the shipped workflow is faster to verify and maintain.
- Polished high-visibility homepage and results controls for steadier desktop and mobile presentation.
- Tightened release-facing copy, screenshot wording, and reusable launch notes so the current shipped workflow is described consistently.
- Kept experimental Markdown export, externalized CSS, converted-page theme toggles, and toolbar injection explicitly optional advanced features.
- Includes accessibility coverage and clear unsupported-format messaging in the release scope.

### Supported In This Release

- Input: `.mht`, `.mhtml`
- Output: cleaned HTML by default, experimental Markdown through the advanced export controls, and ZIP export for batches
- Workflow: drag and drop or file picker import, auto-convert or manual convert, single-file download or ZIP download
- Optional HTML-only extras: converted-page theme toggle, toolbar injection, and externalized CSS when the workflow keeps related assets together

### Known Limitations

- Native `.one` sections use experimental heuristic recovery and may produce incomplete or inaccurate output; review it before use. Native `.onepkg` notebooks are unsupported.
- `.docx` export remains out of scope for `1.0.0`.
- Handwriting from exported MHTML is preserved as raster content rather than editable vector ink.
- Externalized CSS, toolbar injection, and converted-page theme toggle remain opt-in and are best suited to workflows that keep related assets together.

### Notes For Release Review

- The shipped production path remains browser-first OneNote MHTML cleaning.
- Advanced export and converted-page features remain optional and do not change the default HTML workflow.
- If the app appears to be running stale assets after an update, reload the page first. If the older worker still persists, unregister the service worker and reload.
- Keep browser-support wording scoped to the browsers actually exercised during the final `v1.0.0` verification pass.

## 0.2 - 2026-08-29

Browser-first stabilization release for exported OneNote MHTML, with optional Markdown and ZIP export.

- Hardened MHTML conversion and improved homepage, Help, queue recovery, and batch export flows.
- Kept Markdown, externalized CSS, converted-page theme toggles, and toolbar injection optional.
- Native `.one` and `.onepkg` conversion was outside the published v0.2 scope.

[Published v0.2 release](https://github.com/J-Tynan/OneNote-HTML-Cleaner/releases/tag/v0.2)

## 0.1.0 - 2026-05-15

First stable release of the browser-first MHTML to clean HTML workflow. These notes were drafted on 2026-05-12; the release was tagged on 2026-05-15.

### Highlights

- Stable conversion path for exported OneNote `.mht` and `.mhtml` files.
- Included service-worker code, but the original release did not automatically register it; offline availability was not ensured.
- Batch conversion with ZIP export and deterministic, readable exported filenames.
- Optional Markdown export, with Obsidian as the default Markdown flavor.
- Improved first-run usability with a clearer homepage layout, in-app Help, keyboard-operable controls, and persisted theme preference.
- Same-tab queue and completed-result recovery across unexpected reload or tab discard.

### Supported In This Release

- Input: `.mht`, `.mhtml`
- Output: cleaned HTML by default, optional Markdown through the advanced export controls
- Workflow: drag and drop or file picker import, auto-convert or manual convert, single-file download or ZIP download

### Known Limitations

- Native OneNote `.one` and `.onepkg` files were detected for clearer messaging but not converted in the v0.1.0 runtime.
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
