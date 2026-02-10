# Tests

This folder contains lightweight browser-based tests for the HTML pipeline.

## Running tests
1. Serve the repository root with a local static server.
2. Open `tests/runner.html` in the browser.
3. Click "Run Tests" to execute the cases in `tests/cases.json`.

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
