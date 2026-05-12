# v0.1 Release Go / No-Go Checklist

Use this document as the release-facing sign-off sheet for `0.1.0`.

The goal is to confirm that the shipped contract, public-facing assets, and final verification evidence all match the release scope already defined in `TODO.md`.

## Canonical Release Contract

- Version: `0.1.0`
- Stable input scope: exported OneNote `.mht` and `.mhtml` only
- Stable output scope: cleaned HTML by default, optional Markdown through advanced export controls
- Unsupported native formats: `.one` and `.onepkg` are detected for messaging but are not converted in the shipped runtime
- Out of scope for this release: `.docx` export and native OneNote conversion
- Accessibility baseline: exported HTML should include one page-level `h1` and a `<main>` landmark

## Release Sign-Off Checklist

- [ ] `README.md`, `RELEASE_NOTES.md`, and `TODO.md` all describe the same shipped v0.1 scope.
- [ ] Public docs describe Markdown export as optional/advanced rather than the default workflow.
- [ ] Public docs describe native `.one` and `.onepkg` files as unsupported in the shipped runtime.
- [ ] Public docs avoid broader browser-compatibility claims than the final RC pass actually verifies.
- [ ] Service-worker update guidance is present: reload first, then unregister and reload only if stale assets persist.
- [ ] Known limitations are stated clearly and consistently.
- [ ] Screenshot assets are captured and placed in the release-facing docs.
- [ ] Screenshot captions and alt text are final.
- [ ] Final RC verification results are recorded after the release-facing docs and screenshot assets land.
- [ ] `v0.1.0` tag is created only after `main` is green.

## Browser And Runtime Verification Notes

- Record the exact browser/version combinations exercised in the final RC pass.
- Do not broaden support wording beyond the browsers actually exercised during final validation.
- Confirm the offline-capable PWA flow still works after the first load.
- Confirm that a fresh reload picks up the current service-worker-managed assets.

## Screenshot Inventory

### 1. Main import workflow

- Scene: homepage import panel with one queued `.mht` file and the primary convert action visible
- Caption: Import MHTML files, review the queue, and convert in a single browser-first workflow.
- Alt text: Homepage showing the import panel, one queued MHTML file, and the convert action.

### 2. Converted page output

- Scene: converted page showing headings, lists, a table, and a handwriting raster
- Caption: Converted output preserves document structure, tables, and handwriting as raster content.
- Alt text: Converted page showing headings, lists, a table, and preserved handwriting as a raster image.

### 3. Advanced options

- Scene: Advanced options expanded with Export format set to Markdown and Markdown flavor set to Obsidian
- Caption: Advanced options expose optional Markdown export controls without changing the default HTML workflow.
- Alt text: Advanced options expanded with Markdown export selected and Obsidian chosen as the Markdown flavor.

### 4. ZIP export

- Scene: ZIP export result showing readable filenames
- Caption: Batch exports produce readable filenames that are easier to store and share.
- Alt text: ZIP export result showing multiple converted files with readable filenames.

### 5. Accessibility note asset

- Scene: exported HTML structure showing one page-level `h1` and a `<main>` landmark
- Caption: Exported HTML keeps a single page-level heading and a main landmark for a cleaner accessibility baseline.
- Alt text: Exported HTML structure highlighting a single page-level h1 and a main landmark.

## Final RC Verification Record

Complete this section only after the release-facing docs and screenshots are landed.

- [ ] `npm ci`
- [ ] `npm run test:gate:native`
- [ ] Playwright smoke coverage
- [ ] Accessibility audits
- [ ] Manual acceptance already recorded for the locked core fixtures

## Release Decision

- Go if every checklist item above is complete and `main` is green.
- No-go if scope wording drifts, screenshot assets are still placeholders, or the final RC pass finds a release-path regression.