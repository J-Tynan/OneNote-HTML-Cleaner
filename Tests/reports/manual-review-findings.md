# Manual Review Findings

Date: 2026-02-26
Scope: `Tests/Cleaned/*.html` (4 fixtures)

## Reviewed Files
- `Communicate using Markdown.html`
- `DevToys.html`
- `Resolve merge conflicts.html`
- `Test File.html`

## Pass Criteria Checked
- Single `<main>` and single page-level `<h1>` behavior appears intact in reviewed outputs.
- List content is represented with semantic list tags (`<ul>/<ol>/<li>`), including deeply nested list-heavy sections.
- Table-heavy layouts remain preserved (intentional OneNote template behavior).
- Embedded images render with `alt` text in reviewed output.

## Findings
- **No blocker regressions** found for current cleaned fixtures.
- `<title>` remains generic (`Document`) across reviewed fixtures; this is noted as a quality follow-up (non-blocking) since current smoke tests only require non-empty titles.
- No `<pre>` blocks were found in this cleaned fixture set, so the contrast TODO item for `<pre>` needs either:
  - additional fixtures that include `<pre>`, or
  - a re-check of prior audit scope where those contrast findings were reported.

## Decision
- Manual review task is considered complete for the current fixture set.
- Keep contrast and regression-fixture expansion tasks open.

---

## Release Evidence Update (2026-02-27)

### Automated Coverage Snapshot
- Native release gate (`npm run test:gate:native`) passes with criteria automation now covering:
  - **C1 Structure** (partial)
  - **C2 Content** (partial)
  - **C3 Images & Media** (partial)
  - **C5 Tables/List Layout** (partial)
  - **C6 Whitespace & Margins** (partial)
  - **C7 Metadata** (automated)
  - **C8 MHTML Artifacts** (automated)
- Toolbar/config acceptance is included in gate execution via `test:pipeline-config`, `test:toolbar`, and `test:ui-downloads`.

### Manual Sign-off Still Required Before Stable Release
- **C4 Links**: verify representative relative/absolute links open as expected.
- **C9 Accessibility**: verify keyboard focus behavior and heading navigation flow in rendered output.

### Fixture Set Used for Current Gate Validation
- `Communicate using Markdown.html`
- `DevToys.html`
- `Problematic mht-full-snippet.html`
- `Problematic mht-sample.html`
- `Resolve merge conflicts.html`
- `Test File.html`

### Final C4/C9 Sign-off Pass (2026-02-27)

#### C4 Links
- Per-fixture link audit confirms content links are standard `http(s)` targets; no `javascript:` links detected.
- Link-bearing fixtures in this set: `Communicate using Markdown.html`, `DevToys.html`, `Resolve merge conflicts.html`, `Test File.html`.
- **Status:** Pass (with note) — static link integrity checks passed; full click-through behavior remains a browser manual check when preparing final release notes.

#### C9 Accessibility
- Ran `npm run test:playwright:a11y-exports` against `Tests/Cleaned`.
- Summary (`Tests/reports/exports/a11y-exports-summary.txt`):
  - FAIL: `Communicate using Markdown.html`, `DevToys.html`, `Resolve merge conflicts.html`, `Test File.html`
  - OK: `Problematic mht-full-snippet.html`, `Problematic mht-sample.html`
- Generated detailed reports in `Tests/reports/exports/*-(light|dark).json`.
- Observed serious/critical rule hits in failing fixtures (for example `aria-hidden-body` and spacing-related rules).
- **Status:** Not signed off — accessibility remediation is required before final stable release sign-off.

---

## Externalized CSS Fixture Review (2026-03-08)

Scope:
- Source fixtures audited: `Resolve merge conflicts.mht`, `Test File.mht`, `Communicate using Markdown.mht`, `DevToys.mht`
- Modes audited: `shared`, `per-page`
- Artifacts: `Tests/reports/css-audit-report.json`, `Tests/reports/css-audit-report.md`

Fixture-by-fixture status:
- `Resolve merge conflicts.mht`: PASS (`shared` and `per-page` CSS hashes match; 5,226 bytes; 51 rules)
- `Test File.mht`: PASS (`shared` and `per-page` CSS hashes match; 5,330 bytes; 51 rules)
- `Communicate using Markdown.mht`: PASS (`shared` and `per-page` CSS hashes match; 5,155 bytes; 52 rules)
- `DevToys.mht`: PASS (`shared` and `per-page` CSS hashes match; 1,620 bytes; 18 rules)

Aggregate findings:
- No missing CSS assets in either mode.
- `shared` and `per-page` extraction output is content-identical for all reviewed fixtures; mode differences remain packaging/linking concerns.
- Shared bundle dedupe opportunity remains high: 17,337 raw bytes collapse to 7,238 bytes after selector+declaration consolidation (10,099 bytes saved, 58.25%).
- Repeated declarations across all fixtures indicate strong consolidation candidates (title, table baseline, metadata paragraphs, direction/margin baselines).
- `extcss-*` selectors are currently single-use within each individual fixture output (100% single-use ratio), suggesting consolidation should target cross-fixture bundle assembly and declaration canonicalization rather than per-file selector collapsing.

Decision:
- Step 1 review and Step 2 audit generation are complete for the current core fixture set.
- Next action is to formalize consolidation/canonicalization rules and apply them in export packaging logic.
