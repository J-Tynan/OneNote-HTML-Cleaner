# Pipeline import-time audit — summary

Date: 2026-02-19
Owner: pipeline-team

## Goal
Audit `src/pipeline/*` for import-time side-effects (code that runs during module evaluation) and produce a remediation checklist so the worker can lazy-load the pipeline without synchronous failures.

## Files inspected
- `src/pipeline/pipeline.js`
- `src/pipeline/mht.js`
- `src/pipeline/parser.js`
- `src/pipeline/sanitize.js`
- `src/pipeline/listRepair.js`
- `src/pipeline/inlineStyleMigration.js`
- `src/pipeline/images.js`
- `src/pipeline/format.js`
- `src/pipeline/toolbarInjector.js`
- `src/pipeline/cornellSemantics.js`
- `src/pipeline/dateTimeLayout.js`
- `src/pipeline/config.js`

## Findings (short)
- No import-time side-effects were found in the pipeline modules above.
- All modules export functions/constants; no module executes heavy work at top-level (no IIFEs, event listeners, large allocations, or synchronous WASM initialization).
- `console.*` calls are used only inside exported functions (runtime diagnostics) — safe.

## Recommendations
- Mark: `PASS` — safe to lazy-load these modules inside `worker.init()` (already implemented).
- Keep `Tests/import-safety-playwright.js` coverage broad — it now imports the full set of pipeline modules to catch regressions.
- If future changes add new dependencies, ensure they are either import-time-safe or deferred into `init()`.

## Remediation checklist (if any import-time code is later introduced)
- Move heavy initialization into an exported `async initModule()` and call it from `worker.init()`.
- Avoid top-level `new` for large buffers, synchronous WASM compilation, or DOM access in modules that may be imported in a worker context.
- Add unit tests that `import()` the module from a browser context (Playwright) and assert the import does not throw.

## Next steps completed here
- Extended `Tests/import-safety-playwright.js` to import all pipeline modules.
- Verified `import-safety` Playwright test passes locally.

---

If you want, I can add a gating CI check (run `test:import-safety`) to fail builds when a pipeline module introduces import-time side-effects.