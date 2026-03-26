A11Y Exported HTML Triage

Summary
- Source: `Tests/exports-from-mht/` (converted MHT exports)
- Reports: `Tests/reports/exports/*.json`
- Scope: 4 exported pages audited (Communicate using Markdown, DevToys, Resolve merge conflicts, Test File)

Common Violations (observed)
- document-title (impact: serious)
  - Description: Missing or empty <title> element.
  - Fix: Ensure pipeline emits a non-empty <title> (use exported filename or first H1). Add <title> to `<head>`.
  - Files to change: `src/pipeline/pipeline.js` or `src/pipeline/format.js`.

- html-has-lang (impact: serious)
  - Description: `<html>` lacks `lang` attribute.
  - Fix: Emit `<html lang="en">` (default) or detect language from source metadata. Prefer explicit `lang` attribute in generated HTML.
  - Files to change: `src/pipeline/mht.js` / pipeline output wrapper.

- landmark-one-main (impact: moderate)
  - Description: No `<main>` landmark in document.
  - Fix: Wrap primary document content in `<main>`; if a top-level H1 exists, place it inside `<main>` as the primary heading.
  - Files to change: pipeline formatter that writes the final body.

- page-has-heading-one (impact: moderate)
  - Description: No level-1 heading present.
  - Fix: If document has no H1, synthesize one from filename or title and insert as `<h1>` inside `<main>`.
  - Files to change: same as above.

- region (impact: moderate)
  - Description: Page content (e.g., `<pre>Forbidden</pre>`) is not contained within landmarks.
  - Fix: Ensure all meaningful page content — including preformatted blocks — is inside `<main>` (or other landmarks). Avoid orphaned top-level elements.

Notes on color-contrast findings
- Exported-page color-contrast findings are non-blocking for release when they preserve OneNote-authored styling. Do not fail the exported HTML audit on those findings unless product requirements change.

Recommended Implementation Plan (Option A sequence)
1. Add triage doc (this file) and pick 1-2 representative pages for iterative fixes (suggest: `Communicate using Markdown` and `DevToys`).
2. Update pipeline to inject `lang` and `title` into generated HTML head.
   - Prefer: title from metadata or first heading; fallback to filename without extension.
   - Example: `<html lang="en"><head><meta charset="utf-8"><title>Communicate using Markdown</title>`
3. Wrap exported body content in `<main>` and ensure a single top-level `<h1>` exists inside it.
   - If a heading exists but is not H1, promote it or insert a new H1.
4. Re-run `node ./Tests/playwright-a11y-exports.js --dir Tests/exports-from-mht` and inspect reports.
5. Add small regression test(s) under `Tests/` that assert generated HTML contains `lang`, `title`, `main`, and `h1` using the existing audit harness.
6. Keep `color-contrast` findings informational for exported pages while source-authored OneNote styling remains fidelity-critical.

Quick patch examples (for implementer reference)
- Inject `lang` and `title` into serialized HTML head:

  const title = metadata.title || inferredTitleFromFirstHeading || path.basename(filename, '.html');
  html = html.replace(/^<html(?![^>]*\blang=)/i, `<html lang="en"`);
  html = html.replace(/<head>/i, `<head>\n  <meta charset="utf-8">\n  <title>${escapeHtml(title)}</title>`);

- Wrap body contents in `<main>` if missing:

  if (!/<main[\s>]/i.test(html)) {
    html = html.replace(/<body\b[^>]*>/i, m => m + '\n<main>');
    html = html.replace(/<\/body>/i, () => '</main>\n</body>');
  }

Next steps
- If you approve, I'll implement the pipeline changes for `lang`/`title`/`main` and create regression tests. I will modify `src/pipeline/*` and run the exports audit again.

Reports referenced
- `Tests/reports/exports/Communicate using Markdown-light.json`
- `Tests/reports/exports/DevToys-light.json`
- `Tests/reports/exports/Resolve merge conflicts-light.json`
- `Tests/reports/exports/Test File-light.json`

