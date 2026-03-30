# Heroicons Mapping Research — OneNote Default Tags

This document captures the proposed mapping between Microsoft OneNote’s default tags and equivalent icons from the **Heroicons v2** set from website https://www.heroicons.com/
The goal is to achieve **similar visual weight, fast recognition, and consistent sizing** while remaining license‑safe and cross‑platform.

Heroicons are used as **renderers**, not as data. Tag semantics remain independent of icon choice.

---

## Core Mapping Principle

> **Icon = category. State = outline vs solid. Label = specificity.**

This keeps the UI readable at small sizes and avoids icon overload.

---

## Task & Priority Tags

| OneNote Tag | Heroicon | State Handling |
|------------|----------|----------------|
| To Do | `check-circle` | Outline = unchecked |
| To Do (checked) | `check-circle` | Solid = checked |
| To Do priority 1 | `exclamation-circle` | Outline = unchecked |
| To Do priority 1 (checked) | `exclamation-circle` | Solid = checked |

**Notes**
- Same icon, same size; state is conveyed by outline vs solid.
- Priority is encoded by icon choice, not color alone.

---

## Emphasis & Meaning

| OneNote Tag | Heroicon |
|------------|----------|
| Important | `exclamation-triangle` |
| Critical | `fire` |
| Question | `question-mark-circle` |
| Remember for later | `clock` |
| Definition | `book-open` |
| Highlight | `sparkles` |
| Idea | `light-bulb` |
| Password | `key` |

These icons remain legible at 16–18 px and communicate intent quickly.

---

## Contact & Communication

| OneNote Tag | Heroicon |
|------------|----------|
| Contact | `user` |
| Address | `map-pin` |
| Phone number | `phone` |
| Web site to visit | `globe-alt` |
| Send in email | `envelope` |
| Call back | `phone-arrow-up-right` |
| Schedule meeting | `calendar` |

**State handling**
- Outline = pending
- Solid = completed

---

## Discussion Tags

| OneNote Tag | Heroicon | Rationale |
|------------|----------|-----------|
| Discuss with Person A | `chat-bubble-left-right` | Neutral discussion |
| Discuss with Person B | `chat-bubble-left-right` | Same icon; label differs |
| Discuss with manager | `briefcase` | Role‑specific context |

Identity is conveyed by the label, not the icon.

---

## Media & Reference

| OneNote Tag | Heroicon |
|------------|----------|
| Movie to see | `film` |
| Book to read | `book-open` |
| Remember for e‑reader | `device-tablet` |
| Music to listen to | `musical-note` |
| Source for article | `document-text` |
| Remember for blog | `pencil-square` |

These icons have strong silhouettes and minimal interior detail.

---

## Projects & Requests

| OneNote Tag | Heroicon |
|------------|----------|
| Project A | `folder` |
| Project B | `folder` |
| Client request | `clipboard-document-check` |

**Notes**
- Project differentiation is handled by labels, not icon shape.
- Avoid encoding A/B or numbers into the icon itself.

---

## Size & Consistency Guidance

- Use **outline icons** at 16–18 px in toolbars.
- Use **solid icons** only to indicate completion or emphasis.
- Avoid mixing outline and solid in the same row unless conveying state.

Example CSS:

```css
.tag-icon {
  width: 18px;
  height: 18px;
  stroke-width: 1.75;
}
```

---

## Canonical Tag Markup (Heroicons‑ready)

```html
<span class="onenote-tag" data-tag="todo" data-state="checked">
  <svg class="tag-icon solid">…</svg>
  <span class="tag-label">To Do</span>
</span>
```
This structure allows:
- Heroicons rendering in the UI.
- Emoji rendering in Markdown or summaries.
- Future renderer swaps without refactoring.

---

## Conclusion
Heroicons can map cleanly to every default OneNote tag while preserving:
- visual consistency
- fast readability
- clear state handling
- legal safety

The key is disciplined use:
- one icon per concept
- outline vs solid for state
- labels for specificity

This mapping is suitable for Edit Mode toolbars, converted HTML output, and live demos.