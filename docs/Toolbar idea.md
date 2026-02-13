# Future / Advanced Feature Ideas

This note captures post‑milestone ideas for advanced functionality to explore toward the end of development. All items below are **optional, opt‑in, and non‑destructive by design**, intended to augment the converted HTML output without destabilising the core conversion pipeline.

---

## 1. Injected Output Toolbar (Opt‑In)

Introduce an optional toolbar injected into converted HTML output.

### Goals
- Provide post‑conversion tooling without modifying the source pipeline.
- Keep enhancements self‑contained, reversible, and profile‑driven.
- Improve usability, accessibility, and long‑term maintainability of exported notes.

### Design Notes
- Inject a single, namespaced container (e.g. `#onenote-cleaner-toolbar`) at the top of `<body>`.
- Use `position: sticky` or `position: fixed` with reserved layout space to avoid content overlap.
- Bundle toolbar JS + CSS as a single module.
- Enable via conversion flag or profile option.
- Reuse existing Tailwind baseline where possible.

---

## 2. Post‑Edit Mode (Text‑Focused)

Allow limited editing of converted notes directly in the browser.

### Scope (Initial)
- Enable `contenteditable` on:
  - Paragraphs
  - List items
  - Table cells (especially Cornell cues/notes)
- Explicitly exclude:
  - Structural containers (tables, sections)
  - Semantic wrappers (`cornell-*`)
  - Headings and layout scaffolding

### Save Model
- Serialize edited DOM back to HTML.
- Export as:
  - Updated HTML file, or
  - HTML + embedded JSON patch (diff‑style) for portability.

### Rationale
- Supports light correction and annotation without becoming a full editor.
- Preserves semantic structure established by the pipeline.

---

## 3. Convert Back to OneNote (Experimental)

Explore round‑trip workflows back into OneNote.

### Realistic First Step
- Export **OneNote‑compatible HTML** rather than native `.one` files.
- Target structures and styles that OneNote re‑imports cleanly.
- Preserve Cornell semantics where possible.

### Native Export (Long‑Term / Experimental)
- Investigate native `.one` authoring using Microsoft’s documented file format
  (see `docs/OneNote File Format.pdf`).
- Treat as best‑effort and clearly label as experimental.
- Isolate behind a toolbar action or advanced export option.

---

## 4. Accessibility Review Tools

Add optional accessibility diagnostics to the output.

### Ideas
- Highlight:
  - Missing `alt` text
  - Heading level jumps
  - Low‑contrast text
- Provide inline hints rather than auto‑fixing.
- Pair well with Cornell notes used for study and revision.

---

## 5. Layout & View Modes

Leverage explicit semantics to offer alternate views.

### Possible Modes
- Default (default)
- Linear reading view
- Print‑friendly view

Primarily implemented via CSS toggles.

---

## 6. Provenance & Metadata Panel

Expose conversion metadata for long‑term clarity.

### Display
- Source file name(s)
- Conversion profile used
- Pipeline version
- Conversion timestamp

Useful when revisiting notes months or years later.

---

## Guiding Principles

- All advanced features must be:
  - Opt‑in
  - Non‑destructive
  - Reversible
- Core conversion pipeline remains stable and testable.
- Experimental features are clearly labelled and isolated.
- Semantics first; layout and styling are secondary.

---

## Notes

These ideas are intentionally captured early to avoid scope creep during stabilisation.
Implementation should only proceed once the core pipeline is considered stable.
