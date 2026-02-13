# Tests

This folder contains lightweight browser-based tests for the HTML pipeline.

## Running tests
1. Serve the repository root with a local static server.
2. Open `tests/runner.html` in the browser.
3. Click "Run Tests" to execute the cases in `tests/cases.json`.

### Native smoke test (terminal)
- Run `npm run test:smoke:native` to validate starter checklist-aligned checks against converted native outputs in `Tests/Cleaned`.
- Optional: `node ./Tests/smoke-native.js --cleaned-dir "Tests/Cleaned"`.
- The script also prints criteria coverage for the 9-point visual checklist (automated/partial/manual).
- Regression fixture assertions are loaded from `Tests/expected/native-regression.json` (required files, per-file markers, and folder minimums).
- Optional custom fixture path: `node ./Tests/smoke-native.js --fixture "Tests/expected/native-regression.json"`.

Note: if you use VS Code Live Preview, the runner strips the injected script tag
so diffs still reflect pipeline output.

## Structure
- `fixtures/`: input HTML cases.
- `expected/`: expected HTML output from the pipeline.
- `cases.json`: maps inputs to expected outputs and config.
- `runner.html`, `runner.js`: simple browser runner.

## MHT cases
Some cases set `"preprocess": "mht"` in `cases.json`. The runner will parse
the MHT payload and pass the extracted HTML and image map into the pipeline.

## Added fixtures
- `testfile-snippet`: minimal reproduction of OneNote table/list behavior.
- `list-continuity`: verifies blank numbered rows are preserved.
- `nbsp-inline-mixed`: removes NBSP inside mixed inline content without losing images.
- `mht-full-snippet`: MHT sample with table rows, blank numbering, and inline image.
- `table-styles`: preserves table layout and inline styles.
- `cid-image`: ensures CID-based image refs are embedded.
- `nested-table-mixed-lists`: nested tables with mixed ordered/unordered lists.
- `rtl-mixed-direction`: right-to-left text mixed with LTR content.
- `large-image-data`: large embedded image data URI handling.
- `onenote-callout`: callout icon + text layout seen in OneNote.
