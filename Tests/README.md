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
