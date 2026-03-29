# Emoji Mapping Research — OneNote Default Tags

This document captures the proposed emoji equivalents for Microsoft OneNote’s default tags.  
The goal is to provide a **portable, license‑safe, and semantically clear** representation that works across HTML, Markdown, summaries, and plain‑text contexts.

Emoji are treated as **renderers**, not data. The underlying tag semantics remain independent of visual representation.

---

## Task & Priority Tags

| OneNote Tag | Emoji |
|------------|-------|
| To Do (unchecked) | ⬜ |
| To Do (checked) | ☑️ |
| To Do priority 1 (unchecked) | ❗⬜ |
| To Do priority 1 (checked) | ❗☑️ |

**Notes**
- ⬜ / ☑️ are visually stable and widely supported.
- Priority is expressed by composition (❗ + checkbox), not color alone.

---

## Emphasis & Meaning

| OneNote Tag | Emoji |
|------------|-------|
| Important | ❗ |
| Critical | 🔥 |
| Question | ❓ |
| Remember for later | ⏰ |
| Definition | 📖 |
| Highlight | ✨ |
| Idea | 💡 |
| Password | 🔑 |

---

## Contact & Communication

| OneNote Tag | Emoji |
|------------|-------|
| Contact | 👤 |
| Address | 📍 |
| Phone number | 📞 |
| Web site to visit | 🌐 |
| Send in email | ✉️ |
| Call back (unchecked) | 📞⬜ |
| Call back (checked) | 📞☑️ |
| Schedule meeting (unchecked) | 📅⬜ |
| Schedule meeting (checked) | 📅☑️ |

---

## Discussion Tags (with state)

| OneNote Tag | Emoji |
|------------|-------|
| Discuss with Person A (unchecked) | 💬⬜ |
| Discuss with Person A (checked) | 💬☑️ |
| Discuss with Person B (unchecked) | 💬⬜ |
| Discuss with Person B (checked) | 💬☑️ |
| Discuss with manager (unchecked) | 💼⬜ |
| Discuss with manager (checked) | 💼☑️ |

**Notes**
- Person A / B share the same icon; identity is conveyed by the label.
- Manager discussions use 💼 to indicate role/context.

---

## Media & Reference

| OneNote Tag | Emoji |
|------------|-------|
| Movie to see | 🎬 |
| Book to read | 📘 |
| Remember for e‑reader | 📱 |
| Music to listen to | 🎵 |
| Source for article | 📄 |
| Remember for blog | ✍️ |

---

## Projects & Requests

| OneNote Tag | Emoji |
|------------|-------|
| Project A | 📁 |
| Project B | 📁 |
| Client request (unchecked) | 📋⬜ |
| Client request (checked) | 📋☑️ |

**Notes**
- Project differentiation is handled by labels, not icon shape.
- 📋 conveys “request / intake” clearly in summaries.

---

## Design Principles

- Emoji are **composable** to express state (checked / unchecked).
- No reliance on color alone for meaning.
- Works cleanly in Markdown, HTML, and plain text.
- Emoji size and alignment can be normalized via CSS.
- Emoji renderer can be swapped for SVG icons later without changing semantics.

---

## Canonical Tag Representation (example)

```html
<span class="onenote-tag" data-tag="todo" data-state="checked">
  <span class="tag-emoji">☑️</span>
  <span class="tag-label">To Do</span>
</span>
```

This structure allows:
- Emoji rendering today.
- SVG (Heroicons) rendering later.
- Tag summaries and filters to operate on data, not visuals.

---

## Conclusion
Emoji can fully represent the default OneNote tag set, including multiple checkbox styles, in a way that is:
- portable
- accessible
- license‑safe
- future‑proof

They are a strong primary or fallback renderer and pair cleanly with an SVG‑based UI where higher visual polish is required.