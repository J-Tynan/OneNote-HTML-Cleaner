# OneNote Tag Parsing Research

This document bridges the renderer research to the future parser work.

The stable release does **not** yet normalize OneNote tags into canonical semantic HTML. This document locks the pre-release scaffolding so the post-release parser can be implemented against a stable contract.

---

## Locked Decisions

- Tags are semantic data first; emoji and SVG are interchangeable renderers.
- The canonical tag contract is **public markup**, not an internal-only `data-onc-*` contract.
- The first parser scope is limited to **built-in default OneNote tags only**.
- The first parser scope is limited to **block-leading detection only**: start-of-paragraph, start-of-list-item, or equivalent block-leading positions.
- Parser work should target exported OneNote **tag markers** in MHTML/HTML, not assume unicode glyphs.

---

## Canonical Semantic Contract

Recommended canonical HTML representation:

```html
<span class="onenote-tag" data-tag="todo" data-label="To Do" data-state="unchecked">
  <span class="tag-label">To Do</span>
</span>
```

Field definitions:

- `class="onenote-tag"`: stable public hook for styling, summaries, and downstream export logic.
- `data-tag`: required stable semantic ID such as `todo`, `todo-priority-1`, `important`, `question`, `discuss-person-a`, or `client-request`.
- `data-label`: required human-readable label used for accessibility, summaries, and round-tripping.
- `data-state`: optional state marker for stateful tags such as `checked` or `unchecked`.
- `data-variant`: optional future-safe field for cases where a tag family needs additional taxonomy without changing the primary semantic ID.

Additional rules:

- Visible label text should remain in the DOM by default.
- For the built-in default tag set, priority is encoded in `data-tag` (for example `todo-priority-1`) rather than a separate `data-priority` attribute.
- Renderer-specific children such as emoji spans or SVG icons are additive and must not redefine tag meaning.

---

## Export Evidence From Test Tag List.mht

Primary evidence fixture: `Tests/Test Tag List.mht`

Observed export patterns:

- Most built-in tags export as a block-leading `img` marker followed by a non-breaking space and visible label text.
- The observed image-backed markers are typically 16x16 and carry useful `alt` text such as `To Do`, `Important`, `Question`, or `Client request`.
- At least `Remember for later` and `Definition` appear as text-only paragraphs with highlight styling rather than an inline icon image.
- Some exported tags reuse the same image asset across different labels, so asset identity alone is not a reliable semantic source.
- At least one `Discuss with <Person B> (checked)` row appears with visible label text for Person B while the exported `alt` text still says Person A, so label text must outrank `alt` text when they disagree.

Implications:

- Tag parsing must not rely on image filenames alone.
- Tag parsing must not assume every built-in tag has an icon-backed representation.
- Style-only tags need a secondary detection path separate from icon-backed tags.

Recommended evidence order for the future parser:

1. Visible label text
2. `alt` text on the leading icon image
3. Image identity as a weak fallback only
4. Highlight/style heuristics for known text-only tags

---

## Deferred Pipeline Shape

Recommended future insertion point:

- Run the dedicated tag-annotation pass after `sanitize.removeNbsp(doc)` in `src/pipeline/pipeline.js`.
- Run it before `sanitize.ensureMainHeading(doc)` and before later semantic/layout normalization so the parser sees cleaned-but-not-yet-restructured content.

Deferred responsibilities for that future pass:

- Detect built-in block-leading OneNote tag markers from exported MHTML/HTML.
- Normalize them into canonical `onenote-tag` markup.
- Preserve readable label text.
- Remain idempotent across repeated pipeline runs.

Explicitly out of scope for the stable release:

- shipping parser logic
- Markdown tag serialization
- toolbar tag insertion
- renderer-specific SVG plumbing
- custom tag support
- broad inline or mid-sentence tag detection

---

## Regression Scaffolding Decision

- Keep `Tests/Test Tag List.mht` as the primary reverse-engineering fixture for default OneNote tags.
- Make the fixture explicit in `Tests/fixtures.js`, but do **not** add it to the stable locked-fixture or `native-regression.json` requirements until parser output exists and a locked cleaned baseline can be justified.
- When post-release parser work starts, use this fixture for:
  - unit assertions around tag detection
  - pipeline idempotence coverage
  - locked cleaned output once canonical semantic markup is emitted

---

## Related Docs

- `docs/OneNote Tag Rendering Options.md`
- `docs/Emoji Mapping Research.md`
- `docs/Heroicons Mapping Research.md`
- `docs/OneNote Tag List.txt`
- `docs/Architecture.md`
- `docs/Contracts.md`