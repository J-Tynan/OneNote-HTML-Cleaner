# Cleaned HTML Review Checklist

Use this checklist to track visual regressions when comparing cleaned HTML output to the original OneNote export.

## Preparation
- [ ] Load the PWA locally (e.g., via `npm start` or `npx serve`) so you can import files from `Tests/`.
- [ ] Open each cleaned HTML result in a browser tab side-by-side with its source if possible.
- [ ] Keep the browser console open for any warnings or errors during processing.

## Visual Review Criteria
1. **Structure**: headings/titles preserved; no collapsed `<body>`.
2. **Content**: text is readable, no missing paragraphs, glyphs preserved.
3. **Images & Media**: embedded images load; data URIs preserved (if expected).
4. **Links**: hyperlinks still open the intended destination (relative/absolute).
5. **Tables/List Layout**: tables/lists remain legible with borders/indents.
6. **Whitespace & Margins**: layout spacing remains reasonable; no overflow (horizontal scroll).
7. **Metadata**: `<meta charset>` set to UTF-8; `<title>` meaningful.
8. **MHTML Artifacts**: no `--` MIME boundaries, `From:` headers, or duplicate `<html>` wrappers.
9. **Accessibility**: headings in logical order; interactive elements still keyboard focusable.

Mark expected cleanup changes (e.g., branding removal) as “pass with notes” if intentional.

## Review Log Template
| File | Criteria Covered | Result | Notes |
| --- | --- | --- | --- |
| `Tests/DevToys.mht` | Structure, Content, Images, Links | ✅ Pass | Images load, no MIME artifacts. |
| `Tests/Communicate using Markdown.mht` | Structure, Tables, Metadata, Accessibility | ⚠️ Needs follow-up | Table lost borders; consider adding `border-collapse`. |
| `Tests/Resolve merge conflicts.mht` | Structure, Content, Links, Metadata |  |  |
| `Tests/Test File.mht` | Structure, Content, Images |  |  |

Use `✅` for pass, `⚠️` for issues to investigate, `❌` for blockers. Keep notes brief but precise.
