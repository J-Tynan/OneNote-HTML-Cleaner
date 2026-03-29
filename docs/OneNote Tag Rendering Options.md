# Research Summary — OneNote Tag Rendering Options

## Option A — Emoji‑based tags

**Strengths**
- Zero licensing risk.
- Works everywhere (HTML, Markdown, summaries, plain text).
- Easy to size and align consistently using CSS.
- Excellent for text‑first workflows and exports.

**Limitations**
- Visual style varies by operating system.
- Less “app‑like” than SVG icons.
- Requires careful styling for dense toolbars.

**Best uses**
- Markdown export.
- Summarize Tags tool.
- Plain‑text fallback.
- Accessibility‑first views.

---

## Option B — Heroicons (SVG) www.heroicons.com

**Strengths**
- Clean, professional appearance.
- Consistent sizing and alignment.
- Strong semantic coverage for OneNote’s default tags.
- Ideal for Edit Mode toolbar and converted HTML output.

**Limitations**
- Requires SVG plumbing and asset management.
- Slightly heavier than emoji.
- Needs a fallback for non‑SVG contexts.

**Best uses**
- Edit Mode toolbar.
- Converted HTML output.
- Live demos and screenshots.

---

## Key conclusion

These options are **complementary, not mutually exclusive**.

The recommended approach is:

> **One canonical tag model, multiple renderers.**

Tags should be treated as semantic data first. Emoji or SVG icons are simply different renderers layered on top of the same underlying structure.

---

## Architectural principle to lock in

> **Tags are semantic metadata; visual representations are interchangeable.**

This principle allows emoji and SVG icons to coexist without refactoring and keeps future features (summaries, filters, exports) stable.

---

## Practical direction

- Emoji can serve as the default and fallback renderer.
- SVG icons (Heroicons) can be layered in where visual polish matters most.
- Both approaches plug into the same canonical tag schema.

This keeps the system flexible, legally safe, and future‑proof.
