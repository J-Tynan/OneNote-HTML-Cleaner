# v0.2 Release Go / No-Go Checklist

Use this document as the release-facing sign-off sheet for `0.2.0`.

The goal is to confirm that the shipped contract, current screenshot assets, and public-facing copy all describe the same `v0.2` stabilization release.

## Canonical Release Contract

- Version: `0.2.0`
- Stable input scope: exported OneNote `.mht` and `.mhtml` only
- Stable output scope: cleaned HTML by default, optional Markdown through advanced export controls
- Optional HTML-only extras: converted-page theme toggle, toolbar injection, and externalized CSS when the workflow keeps related assets together
- Unsupported native formats: `.one` and `.onepkg` are detected for messaging but are not converted in the shipped runtime
- Out of scope for this release: `.docx` export and native OneNote conversion
- Accessibility baseline: exported HTML should include one page-level `h1` and a `<main>` landmark

## Release Sign-Off Checklist

- [x] `README.md`, `RELEASE_NOTES.md`, and `TODO.md` describe the same current shipped scope.
- [x] Public docs describe Markdown export, toolbar injection, converted-page theme toggles, and externalized CSS as optional advanced features rather than the default workflow.
- [x] Public docs describe native `.one` and `.onepkg` files as unsupported in the shipped runtime.
- [x] Public docs avoid broader browser-compatibility claims than the recorded verification supports.
- [x] Service-worker update guidance is present: reload first, then unregister and reload only if stale assets persist.
- [x] Screenshot asset filenames in `assets/release/` match the active release docs.
- [x] Screenshot captions and alt text are aligned across the README, screenshot inventory, and this checklist.
- [ ] Final `v0.2` RC verification results are recorded after the release-facing docs are locked.
- [ ] Create the `v0.2.0` tag only after `main` is green.

## Browser And Runtime Verification Notes

- Record the exact browser/version combinations exercised in the final RC pass.
- Do not broaden support wording beyond the browsers actually exercised during final validation.
- Confirm the offline-capable PWA flow still works after the first load.
- Confirm that a fresh reload picks up the current service-worker-managed assets.
- Re-check that opt-in converted-page features remain off by default in the shipped HTML path.

## Screenshot Inventory

Use `docs/Release-Screenshot-Shot-List.md` for the exact filenames, scene descriptions, caption text, and alt-text wording.

### 1. Main import workflow

- Scene: homepage import panel with one queued `.mht` file and the primary convert action visible
- Caption: Import MHTML files, review the queue, and convert in a single browser-first workflow.
- Alt text: Homepage showing the import panel, one queued MHTML file, and the convert action.

### 2. Converted page output

- Scene: converted page showing headings, lists, a table, and a handwriting raster
- Caption: Converted output preserves document structure, tables, and handwriting as raster content.
- Alt text: Converted page showing headings, lists, a table, and preserved handwriting as a raster image.

### 3. Advanced options

- Scene: Advanced options expanded with optional output controls visible, including externalized CSS, Markdown export, converted-page theme toggle, and toolbar injection
- Caption: Advanced options expose optional output controls such as externalized CSS, Markdown export, converted-page theme toggles, and toolbar injection without changing the default HTML workflow.
- Alt text: Advanced options expanded with externalized CSS, Markdown export, converted-page theme toggle, and toolbar injection controls visible.

### 4. ZIP export

- Scene: ZIP export result showing readable filenames
- Caption: Batch exports produce readable filenames that are easier to store and share.
- Alt text: ZIP export result showing multiple converted files with readable filenames.

### 5. Accessibility note asset

- Scene: exported HTML structure showing one page-level `h1` and a `<main>` landmark
- Caption: Exported HTML keeps a single page-level heading and a main landmark for a cleaner accessibility baseline.
- Alt text: Exported HTML structure highlighting a single page-level h1 and a main landmark.

## Final RC Verification Record

Complete this section only after the release-facing docs are locked and the final `v0.2` validation pass has run.

- [ ] `npm ci`
- [ ] `npm run test:gate:native`
- [ ] Focused Playwright smoke coverage for the shipped flow and any changed release-facing UI
- [ ] Accessibility audits
- [ ] Manual acceptance recorded for the locked core `.mht` fixtures

Recorded on `TBD`.

## Release Decision

- Go if every checklist item above is complete and `main` is green.
- No-go if scope wording drifts, the screenshot assets become stale or misleading, or the final RC pass finds a release-path regression.
