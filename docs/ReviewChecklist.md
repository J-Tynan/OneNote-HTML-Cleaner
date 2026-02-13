# Cleaned HTML Review Checklist

Use this checklist to track visual regressions when comparing cleaned HTML output to the original OneNote export.

## Preparation
- [ ] Load the PWA locally (e.g., via `npm start` or `npx serve`) so you can import files from `Tests/`.
- [ ] Open each cleaned HTML result in a browser tab side-by-side with its source if possible.
- [ ] Keep the browser console open for any warnings or errors during processing.

## Visual Review Criteria
1. **Structure**: headings/titles preserved; no collapsed `<body>`.
2. **Content**: text is readable, no missing paragraphs, page title and timestamps preserved, headings preserved (H1–H3) where present, glyphs preserved.
3. **Images & Media**: embedded images load; data URIs preserved (if expected).
4. **Links**: hyperlinks still open the intended destination (relative/absolute).
5. **Tables/List Layout**: tables/lists remain legible with borders/indents.
6. **Whitespace & Margins**: layout spacing remains reasonable; no overflow (horizontal scroll).
7. **Metadata**: `<meta charset>` set to UTF-8; `<title>` meaningful.
8. **MHTML Artifacts**: no `--` MIME boundaries, `From:` headers, or duplicate `<html>` wrappers.
9. **Accessibility**: headings in logical order; interactive elements still keyboard focusable.

## Automation Mapping (`npm run test:smoke:native`)

The native smoke test provides starter automated coverage for a subset of the checklist.

| Criterion | Coverage | Current automated checks |
| --- | --- | --- |
| 1. Structure | Partial automation | `<!doctype html>`, `<body>` presence, `<h1>` exists for native `.one` pages |
| 2. Content | Partial automation | Basic readable text present, native conversion marker text, `.onepkg` section path metadata |
| 3. Images & Media | Manual review | Verify images/media render correctly in browser |
| 4. Links | Manual review | Verify relative/absolute links open correctly |
| 5. Tables/List Layout | Manual review | Verify table/list legibility and layout |
| 6. Whitespace & Margins | Manual review | Verify spacing and overflow visually |
| 7. Metadata | Automated | UTF-8 charset meta + meaningful title present |
| 8. MHTML Artifacts | Automated | Detect MHTML boundary/header artifacts in output HTML |
| 9. Accessibility | Manual review | Verify heading order and keyboard focus behavior |

Use smoke-test output as an early warning signal; manual review remains required for visual fidelity criteria.

Mark expected cleanup changes (e.g., branding removal) as “pass with notes” if intentional.

## Review Log Template
| File | Criteria Covered | Result | Notes |
| --- | --- | --- | --- |
| `Tests/DevToys.mht` | Structure, Content, Images, Links | ✅ Pass | Images load, no MIME artifacts. |
| `Tests/Communicate using Markdown.mht` | Tables, Metadata, Accessibility | ⚠️ Needs follow-up | Table lost borders; consider adding `border-collapse`. |
| `Tests/Resolve merge conflicts.mht` | Structure, Content, Links, Metadata |  |  |
| `Tests/Test File.mht` | Structure, Content, Images |  |  |

Use `✅` for pass, `⚠️` for issues to investigate, `❌` for blockers. Keep notes brief but precise.
