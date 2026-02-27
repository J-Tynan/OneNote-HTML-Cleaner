# HTML Output Standard (Internal)

This document defines the guarantees, constraints, and non‑goals for HTML produced by the MHTML → HTML conversion pipeline.

The objective is to emit **clean, modern, semantic HTML** that conforms to the HTML Living Standard, is stable under sanitization and formatting, and is free from authoring‑tool artifacts.

This is an internal engineering standard used to guide pipeline behavior, sanitization rules, regression tests, and release decisions.

---

## 1. Target Standard

- Output must be valid under the **HTML Living Standard (WHATWG)**.
- Documents must be **UTF‑8 encoded**.
- Output must not rely on deprecated, obsolete, or authoring‑tool‑specific   markup.
- Output must render correctly in modern evergreen browsers without polyfills.

The goal is **conformance and predictability**, not strict visual parity with the source authoring tool.

---

## 2. Document Structure Guarantees

Converted documents must satisfy the following structural rules:

- Exactly **one `<main>` element** per document.
- Exactly **one page‑level `<h1>`**.
- Logical heading order must be preserved (`h1 → h2 → h3`).
- Semantic elements should be used where appropriate:
  - `<article>`, `<section>`, `<nav>`, `<aside>`
- Lists must be represented using:
  - `<ul>`, `<ol>`, `<li>`
  - Bullet glyphs or numbering characters must not be used as list markers.

These guarantees are enforced via sanitization and regression tests.

---

## 3. Forbidden Markup (Artifact Removal)

The pipeline must not emit the following under any circumstances:

### Office / OneNote artifacts
- `mso-*` styles or attributes
- XML namespaces such as:
  - `xmlns:o`, `xmlns:v`, `xmlns:w`
- Authoring‑tool navigation artifacts:
  - `Main-File`, `File-List`, or similar links

### Deprecated or obsolete HTML
- Elements:
  - `<font>`, `<center>`, `<strike>`
- Attributes:
  - `bgcolor`, `align`, `border`, `summary`
- Legacy table layout attributes used for presentation

Any appearance of the above is considered a **conversion defect**.

---

## 4. Attributes and Styling

- Inline styles should be **minimized and normalized**.
- Repetitive inline styles should be collapsed into shared rules where feasible.
- Attributes must exist only if they add:
  - Semantic meaning
  - Accessibility information
  - Required behavior
- Visual fidelity must not depend on authoring‑tool‑specific styles.

The pipeline may remove or normalize styles that exist solely for layout or editor‑specific rendering.

---

## 5. Encoding and Character Safety

- Output must be UTF‑8 encoded.
- Exported HTML must not contain **C0 control characters** (`U+0000..U+001F`, excluding TAB, LF, CR).
- Charset fallback logic must be:
  - Deterministic
  - Test‑covered
  - Documented if lossy
- Any normalization that removes or replaces characters must be justified and covered by regression tests.

Encoding correctness is a **release‑blocking requirement**.

---

## 6. Accessibility Baseline

The pipeline guarantees a minimal accessibility baseline:

- Exactly one page‑level `<h1>`.
- Presence of a `<main>` landmark.
- Non‑decorative images must include `alt` text.

This baseline does not aim for full WCAG compliance, but avoids introducing accessibility regressions.

---

## 7. Stability and Idempotence

Converted output must satisfy the following stability properties:

- Formatting the HTML must not materially change structure.
- Sanitization must be **idempotent**.
- Re‑running conversion on the same input must produce equivalent output.
- Regression fixtures must lock expected structure and semantics.

Stability is prioritized over aggressive transformation.

---

## 8. Non‑Goals

The following are explicitly out of scope for this standard:

- XHTML or XML‑style output
- Pixel‑perfect visual parity with OneNote or Office
- Preservation of editor‑specific quirks
- Automatic microdata, schema.org, or ARIA enrichment beyond the baseline

These may be explored in future milestones but are not required for compliance.

---

## 9. Enforcement

This standard is enforced through:

- Pipeline sanitization rules
- Unit and regression tests
- Playwright smoke tests
- Manual review of cleaned fixtures

Any change that violates this standard must be:
- Justified
- Documented
- Covered by tests