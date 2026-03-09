Title: Externalized-CSS follow-up, parity tests, idempotence fix, rebaseline

Summary
- Implement follow-up from the Externalized CSS audit: add authoritative review doc, a fixture-backed parity test, and CI wiring.
- Fix sanitizer idempotence: ensureMainHeading now prefers an existing `h1.converted-page-title` to avoid re-promotion on subsequent passes.
- Rebaseline locked "cleaned" fixtures to reflect intentional pipeline output changes (compact spacer stylesheet injection).

Files changed / added
- EXTERNALIZED-CSS-REVIEW.md — authoritative audit and decision summary
- TODO.md — backlog update marking follow-up complete
- package.json — added `test:externalize-css-parity` and included parity in `test:gate:native`
- Tests/externalize-css-parity.unit.js — new fixture-backed parity regression test
- src/pipeline/sanitize.js — minor idempotence fix in `ensureMainHeading`
- Tests/main-heading.unit.js — added regression test for title promotion idempotence
- Tests/expected/locked-cleaned/* — rebaselined locked fixtures via `npm run fixtures:rebaseline`

Test results (local CI runs)
- `npm run test:externalize-css` → PASS
- `npm run test:externalize-css-parity` → PASS
- `npm run test:ui-download-smoke` → PASS
- `npm run test:gate:native` → initially failed (idempotence), fixed and re-ran → PASS (exit code 0)
- `npm run fixtures:rebaseline` → updated `Tests/expected/locked-cleaned/manifest.json` and files

Notes for reviewer
- The `ensureMainHeading` change is intentionally minimal and narrowly scoped to prefer an already-resolved page title marker; see `Tests/main-heading.unit.js` for the regression test.
- Locked fixtures were intentionally updated to match pipeline output; rebaseline artifacts are included in `Tests/expected/locked-cleaned/`.
- If you prefer a separate PR for the rebaseline, I can split the change.

Suggested steps to land
1. Create a feature branch (e.g. `feature/externalized-css-parity`) from `main`.
2. Commit the code + test + fixture changes with the message in `PR_COMMIT_MESSAGE.txt`.
3. Run the gate locally (`npm run test:gate:native`) to confirm green.
4. Push branch and open PR; request review from the docs and pipeline owners.

Attachments
- See `Tests/` for new/updated tests and `Tests/expected/locked-cleaned/` for baselines.

If you want, I can create the branch and commit locally and push the PR—please confirm and provide the remote (or I'll use `origin`).
