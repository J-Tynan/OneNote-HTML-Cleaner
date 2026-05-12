# OneNote HTML Cleaner

Convert OneNote MHTML exports into clean, portable HTML and optional Markdown — entirely in your browser.

OneNote HTML Cleaner is a progressive web app for people who need a practical way to turn exported OneNote pages into cleaner, easier-to-share output without installing a desktop toolchain. The stable release path is focused on MHTML input and a straightforward conversion flow that works well for first-time users as well as repeat batch use.

## v0.1 Release Highlights

- Stable MHTML -> HTML conversion with deterministic output and offline PWA support.
- Optional Markdown export (Obsidian default) and optional externalized CSS for ZIP exports.
- Handwriting preserved as raster images; vector ink extraction remains post-release work.
- Native `.one` and `.onepkg` files are surfaced clearly as unsupported instead of being partially processed.

## Screenshots

| Main App | Converted Output |
| --- | --- |
| Release screenshot target: import panel with queued file and Convert action visible | Release screenshot target: converted page with headings, lists, table, and handwriting raster |

| Advanced Options | Batch Export |
| --- | --- |
| Release screenshot target: Advanced options expanded with Markdown and Obsidian selected | Release screenshot target: ZIP export result with readable filenames |

Accessibility note asset target: exported HTML with a single page-level `h1` and a `<main>` landmark.

## Why Use It

- Convert exported OneNote MHTML files into cleaner HTML with a simpler reading experience.
- Run entirely in the browser with offline capability after the first load.
- Process one file quickly or batch multiple files into a ZIP download.
- Keep the default experience simple while still offering advanced export controls when needed.
- Preserve important note content such as headings, lists, tables, images, and handwriting rasters.

## Quick Start

This is the fastest path for someone using the app once.

1. Open the app in your browser.
2. Drag in your exported OneNote `.mht` or `.mhtml` files, or use the file picker.
3. Leave Advanced options collapsed unless you specifically need Markdown export or externalized CSS.
4. Let the app convert automatically, or click `Convert` if you have disabled auto-convert.
5. Download a single converted file or use `Download ZIP` for multi-file exports.

If your goal is simply to clean and save an exported OneNote page, the default settings are intended to be enough.

## First-Time User Notes

- The stable release supports OneNote MHTML exports only: `.mht` and `.mhtml`.
- Unsupported files such as `.one` and `.onepkg` are detected and labeled clearly instead of being partially processed.
- The app includes a Light / Dark UI theme toggle and remembers your choice in the browser.
- In-app help is available from the Help button, and keyboard support is built in for Help, importing, and the main controls.
- Exported HTML targets one page-level `h1` and a `<main>` landmark for a cleaner accessibility baseline.
- If you only need HTML output, you can ignore most advanced settings.
- Tested locally with automated browser coverage on Chromium 145 for Windows; files are processed locally in your browser and are not uploaded.

## Key Features

### Offline-Capable PWA

The app runs as a progressive web app so the conversion workflow remains available in the browser without requiring a desktop installation. After the first load, the app can continue working offline using cached app assets.

If a newly deployed build appears stale, reload first. If the older service worker still persists, unregister it and reload.

Screenshot placeholder: app home screen showing clean import workflow

### Clean HTML Output

Converted output is designed to be more readable and easier to reuse than raw exported OneNote HTML. The project standard targets semantic HTML5 structure, UTF-8 encoding, and predictable document organization for exported pages.

### Batch Conversion And ZIP Export

You can process one file or multiple files in the same session. Batch exports are packaged into a ZIP with deterministic, readable filenames so the result is easier to store and share.

Screenshot placeholder: multi-file queue and ZIP download workflow

### Simple Default Flow, Advanced Controls When Needed

Advanced options stay collapsed by default so first-time users are not forced through configuration before converting a file. When needed, advanced settings can enable optional behaviors such as:

- manual convert mode
- Markdown export
- externalized CSS for ZIP exports
- converted-page theme toggle options for HTML output

### Optional Markdown Export

The app can also export Markdown through the advanced export controls. Obsidian-compatible output is the default Markdown flavor, with additional supported flavors available for users who need a different target.

### Optional Externalized CSS For ZIP Exports

For HTML batch exports, styles can be written to separate CSS files instead of staying embedded in each HTML file. This is useful when exported files will remain together as a ZIP package.

### Preserved Rich Content

The conversion path preserves important note structures such as headings, lists, tables, images, and handwriting rendered as raster content from the original export.

## What’s Supported

### Supported Input

- `.mht`
- `.mhtml`

### Supported Output

- HTML
- Markdown through the advanced export controls

### Built-In User Controls

- drag and drop or file-picker import
- automatic conversion or manual conversion
- single download or ZIP download
- Light / Dark UI theme toggle
- in-app Help modal with keyboard support

## Keyboard Shortcuts And Keyboard Controls

The app supports a small set of explicit keyboard shortcuts and a broader set of keyboard-operable controls.

### Keyboard Shortcuts

- Press `?` to open or close the Help panel when focus is not inside an input, textarea, or editable field. On many keyboards this is `Shift+/`.
- Press `Escape` to close the Help panel.

### Keyboard Controls

- Use `Tab` and `Shift+Tab` to move through the homepage controls in a natural top-to-bottom order.
- Press `Enter` or `Space` on the focused import dropzone to open the file picker.
- Press `Enter` or `Space` on focused buttons such as `Browse Files`, `Convert`, `Download`, and the theme toggle.
- Focus the Advanced options summary and use its native keyboard behavior to expand or collapse the section.

## Release Scope

The first stable release is intentionally narrow.

- Supported production conversion path: OneNote MHTML exports only
- Native OneNote files such as `.one` and `.onepkg` are not supported in this release
- `.docx` export is not part of this release
- Other input formats are intentionally outside the current shipped conversion contract

This narrower scope is deliberate. It keeps the app focused on the path that is already validated and ready for day-to-day use.

## Optional Advanced Features

These features are available for users who need more control, but they are not required for the main HTML workflow.

### Markdown Export

Enable experimental export formats in Advanced options to export Markdown instead of HTML.

### Externalized CSS

Use externalized CSS when you plan to keep exported HTML and CSS files together, typically in a ZIP download.

### Manual Convert Mode

Disable auto-convert if you want to queue files first and trigger conversion manually with the `Convert` button.

## Roadmap

The roadmap is focused on expanding the product carefully without weakening the stable MHTML workflow.

### Near-Term Direction

- continue refining the MHTML conversion path for reliability and output quality
- improve export workflows around HTML and Markdown packaging
- expand the first-time-user experience with clearer visual guidance and polished UI flows

### Planned Product Expansion

- broader export capabilities after the stable MHTML release is established
- optional toolbar enhancements for converted pages
- future investigation of richer support for native OneNote formats such as `.one` and `.onepkg`

### Planned Tag Features

- Improved parsing of OneNote tags (To‑Do, Important, Question, etc.)
- Toolbar insertion of OneNote-style tags in Edit Mode
- A standalone “Summarize Tags” tool for aggregating tags across multiple pages

The roadmap should be read as direction, not as a delivery promise.

## Known Limitations

- The stable release supports only `.mht` and `.mhtml` input files. If a converted page does not match the source note closely enough, see [Report Fidelity Problems](#report-fidelity-problems).
- Native `.one` and `.onepkg` files may be detected, but they are not converted in the shipped runtime.
- Markdown export is available through advanced export controls rather than the default path.
- Handwriting from MHTML exports is preserved as raster content rather than editable vector ink.
- Externalized CSS is intended for ZIP workflows where the HTML and CSS assets remain together.

## Report Fidelity Problems

If you hit a layout or styling problem in converted output, open a repository issue and include enough detail to make the problem reproducible:

- the source file type and a short description of the note content
- the browser and version you used
- what you expected to see
- what the converted output did instead
- screenshots of the source and converted result when possible

Use the repository issue tracker for fidelity problems and include the word `fidelity` in the title so the report is easy to triage.

## Help

- Use the in-app Help button for a short usage guide.
- Press `?` to open or close Help from the keyboard.
- Press `Escape` to close Help when it is open.
- Use the repository issue tracker for bug reports, fidelity reports, and product feedback.

## For Developers

The README is intentionally user-first. If you are working on the project itself, start with the documents below.

- [docs/Architecture.md](docs/Architecture.md)
- [docs/HTML-Output-Standard.md](docs/HTML-Output-Standard.md)
- [docs/Markdown-Flavor-Standard.md](docs/Markdown-Flavor-Standard.md)
- [docs/Service-Worker-Updates.md](docs/Service-Worker-Updates.md)
- [docs/Toolbar-Phase0-Spec.md](docs/Toolbar-Phase0-Spec.md)

### Local Setup

1. Run `npm install`.
2. Run `npm run build:tailwind`.
3. Serve the project from a local web server and open the app in a browser.

### Useful Commands

```powershell
npm run test:gate:native
npm run fixtures:rebaseline
```

### Current Development Notes

- The shipped release path is MHTML-first.
- Tailwind CSS v4 is used for utilities and layout via the CSS-first entry in `src/styles/tailwind.css`; shared component styling lives in `styles.css`, the project does not use a third-party Tailwind UI library, preflight stays disabled, and Tailwind sources are registered explicitly to avoid scanning markdown docs.
- Native OneNote importer work remains deferred beyond the first stable release.
- The repository still contains deeper technical notes for pipeline, export, and worker behavior in the `docs/` folder.
