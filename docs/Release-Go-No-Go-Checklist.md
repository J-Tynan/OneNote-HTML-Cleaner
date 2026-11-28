# v1.0.0 Release Go / No-Go Checklist

Use this document as the release-facing sign-off sheet for `1.0.0`.

The goal is to confirm that the production contract and public-facing copy describe the same browser-first `v1.0.0` release. Screenshot updates are optional and are not a release gate.

## Canonical Release Contract

- Version: `1.0.0`
- Stable input scope: exported OneNote `.mht` and `.mhtml` only
- Output scope: cleaned HTML by default, experimental Markdown through advanced export controls, and ZIP export for batches
- Optional features: externalized CSS for ZIP workflows, converted-page theme toggle, toolbar injection, and UI theme support
- Native formats: `.one` section recovery is experimental and may be incomplete; `.onepkg` conversion remains unsupported
- Out of scope for this release: `.docx` export and a stable native OneNote fidelity guarantee
- Accessibility baseline: accessibility audits are required; exported HTML should include one page-level `h1` and a `<main>` landmark

## Release Sign-Off Checklist

- [ ] Confirm `README.md`, `RELEASE_NOTES.md`, and `TODO.md` describe the same browser-first `v1.0.0` scope.
- [ ] Confirm public docs describe Markdown as experimental and toolbar injection, converted-page theme toggles, and externalized CSS as optional.
- [ ] Confirm public docs distinguish experimental `.one` recovery from unsupported `.onepkg` conversion.
- [x] Public docs avoid broader browser-compatibility claims than the recorded verification supports.
- [x] Service-worker update guidance is present: reload first, then unregister and reload only if stale assets persist.
- [x] Screenshot asset filenames in `assets/release/` match the active release docs.
- [ ] Confirm historical screenshot captions and alt text remain accurate.
- [ ] Final `v1.0.0` RC verification results are recorded after the release-facing docs are locked.
- [ ] Create the `v1.0.0` tag only after `main` is green and all release checks are complete.

## Browser And Runtime Verification Notes

- Record the exact browser/version combinations exercised in the final RC pass.
- Do not broaden support wording beyond the browsers actually exercised during final validation.
- Confirm offline reopening and conversion after an online load and successful service-worker installation.
- Confirm that a fresh reload picks up the current service-worker-managed assets.
- Re-check that opt-in converted-page features remain off by default in the shipped HTML path.

## Screenshot Inventory

These historical v0.2 screenshots predate the current UI. Capture or refresh is optional release collateral and is not required for `v1.0.0`.

Use `docs/Release-Screenshot-Shot-List.md` for the exact filenames, scene descriptions, caption text, and alt-text wording.

### 1. Main import workflow

- Scene: homepage import panel with one queued `.mht` file and the primary convert action visible
- Caption: Import MHTML files, review the queue, and convert in a single browser-first workflow.
- Alt text: Homepage showing the import panel, one queued MHTML file, and the convert action.

### 2. Converted page output

- Scene: converted page showing headings, a table, and a handwriting raster
- Caption: Converted output preserves document structure, tables, and handwriting as raster content.
- Alt text: Converted page showing headings, a table, and preserved handwriting as a raster image.

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

Complete this section only after the release-facing docs are locked and the final `v1.0.0` validation pass has run.

- [ ] `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm run test:gate:native` (existing MHTML regression gate; this does not establish native support)
- [ ] Focused Playwright smoke coverage for MHTML import, output options, ZIP export, unsupported-format messaging, and responsive UI
- [ ] Accessibility audits
- [ ] Manual acceptance recorded for `.mht` / `.mhtml` import, experimental `.one` recovery and unsupported `.onepkg` messaging, HTML and experimental Markdown output, ZIP contents, externalized CSS links, offline reopen and conversion, and responsive/accessibility-critical UI states
- [ ] Confirm CI is green on `main`

Recorded on `TBD`.

## Release Decision

- Go if every checklist item above is complete and `main` is green.
- No-go if scope wording drifts or the final RC pass finds a release-path regression.
