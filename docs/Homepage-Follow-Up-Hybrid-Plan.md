<!-- markdownlint-disable MD022 MD032 -->

# Homepage Follow-Up Hybrid Plan

Status
- Draft planning document.
- Source review artifact: `docs/Homepage-Review-Checklist.md`.
- Purpose: keep a durable execution plan that maps each homepage review finding to likely implementation files, validation paths, and delivery phases.

## How To Use This Document

This document is the planning bridge between the completed homepage review and the next implementation passes.

Use it to:
- classify each review finding
- identify the likely owning code surface
- choose the narrowest validation path
- schedule work in coherent batches instead of one mixed patch

This plan should be read alongside:
- `docs/Homepage-Review-Checklist.md`
- `docs/Homepage-Implementation-Spec.md`
- `docs/Homepage-Implementation-Layout-Sketches.md`

## Processing Approach

The homepage review should be processed in two passes.

### Pass 1: Normalize And Classify

Convert the completed review checklist into one actionable row per finding.

Each row should be assigned to one bucket:
- Blocker
- Follow-up
- Polish
- Investigation
- Defer

### Pass 2: Deliver In Batches

Do not implement the findings in note order.

Instead, group them by implementation surface and validation path so local layout fixes, interaction refinements, and investigation-only behavior reports do not get mixed together.

Recommended delivery phases:
1. Phase 1: confirmed blocker fixes that are local and reproducible
2. Phase 2: isolated interaction and accessibility follow-ups
3. Phase 3: broader theme and visual polish refinements
4. Phase 4: investigation-only behavior work and deliberate defers

## Task Map

### 1. Light theme CTA contrast remains weak

- Bucket: Follow-up
- Likely files:
  - `styles.css`
- Likely owning surface:
  - light-theme CTA tokens
  - primary-action emphasis
  - button contrast treatment
- Likely validation path:
  - `Tests/theme-playwright.js`
  - `Tests/playwright-a11y.js`
  - focused manual light-theme review
- Delivery phase: Phase 3

### 2. Card borders, backgrounds, and text colors are not yet coherent in both themes

- Bucket: Follow-up
- Likely files:
  - `styles.css`
- Likely owning surface:
  - theme tokens for background, border, and card surfaces
  - semantic homepage card classes
- Likely validation path:
  - `Tests/theme-playwright.js`
  - `Tests/header-edge-to-edge-playwright.js`
  - manual light and dark comparison
- Delivery phase: Phase 3

### 3. Browse and Convert buttons feel mismatched on desktop

- Bucket: Follow-up
- Likely files:
  - `styles.css`
  - `index.html`
- Likely owning surface:
  - desktop action row treatment
  - CTA sizing
  - button wrapper spacing
- Likely validation path:
  - `Tests/convert-button-smoke-playwright.js`
  - `Tests/header-edge-to-edge-playwright.js`
  - manual desktop-width comparison
- Delivery phase: Phase 2

### 4. Convert tooltip positioning is visually awkward

- Bucket: Follow-up
- Likely files:
  - `styles.css`
  - `index.html`
  - `src/ui.js`
- Likely owning surface:
  - convert tooltip positioning rules
  - convert-button wrapper
  - tooltip visibility logic
- Likely validation path:
  - `Tests/convert-button-smoke-playwright.js`
  - manual hover and focus verification at desktop and narrow widths
- Delivery phase: Phase 2

### 5. Advanced section does not clearly communicate collapsed or expandable state

- Bucket: Follow-up
- Likely files:
  - `index.html`
  - `styles.css`
- Likely owning surface:
  - advanced `<details>/<summary>` presentation
  - affordance icon or helper text
- Likely validation path:
  - `Tests/export-format-controls-playwright.js`
  - `Tests/playwright-a11y.js`
  - manual first-impression review
- Delivery phase: Phase 2

### 6. Advanced section internal controls look inconsistent

- Bucket: Blocker
- Likely files:
  - `styles.css`
  - `index.html`
- Likely owning surface:
  - checkbox sizing
  - select styling
  - label alignment
  - option-group spacing
- Likely validation path:
  - `Tests/export-format-controls-playwright.js`
  - `Tests/header-edge-to-edge-playwright.js`
  - manual advanced-options review at desktop and mobile widths
- Delivery phase: Phase 1

### 7. Auto-convert toggle causes visible layout shift

- Bucket: Blocker
- Likely files:
  - `src/ui.js`
  - `index.html`
  - `styles.css`
- Likely owning surface:
  - auto-convert notice rendering
  - helper-text visibility behavior
  - start-card layout stability
- Likely validation path:
  - `Tests/auto-convert-manual-playwright.js`
  - `Tests/layout-shift-playwright.js`
  - manual toggle verification
- Delivery phase: Phase 1

### 8. Dropzone is harder to reach after advanced options expand

- Bucket: Defer unless product direction changes
- Likely files:
  - `index.html`
  - `styles.css`
- Likely owning surface:
  - section order
  - vertical rhythm
  - repeated-use import flow
- Likely validation path:
  - `Tests/header-edge-to-edge-playwright.js`
  - manual repeated-use workflow review
- Delivery phase: Phase 4

### 9. Card inner padding feels too large

- Bucket: Polish
- Likely files:
  - `styles.css`
- Likely owning surface:
  - semantic card spacing tokens
  - start, advanced, and results surface padding
- Likely validation path:
  - `Tests/header-edge-to-edge-playwright.js`
  - manual desktop and mobile comparison
- Delivery phase: Phase 3

### 10. Mobile footer feels too large

- Bucket: Polish
- Likely files:
  - `styles.css`
  - `index.html`
- Likely owning surface:
  - mobile footer spacing
  - footer link density
  - breakpoint padding
- Likely validation path:
  - `Tests/header-edge-to-edge-playwright.js`
  - manual small-screen review
- Delivery phase: Phase 3

### 11. Dark-theme keyboard focus highlight is too subtle

- Bucket: Follow-up
- Likely files:
  - `styles.css`
- Likely owning surface:
  - focus ring styling for homepage controls in dark theme
- Likely validation path:
  - `Tests/theme-playwright.js`
  - `Tests/playwright-a11y.js`
  - manual keyboard navigation review
- Delivery phase: Phase 2

### 12. Queue or results appear to refresh or disappear when browser focus changes

- Bucket: Investigation
- Likely files:
  - `src/ui.js`
  - `src/app.js`
  - `src/worker-wrapper.js`
- Likely owning surface:
  - queue lifecycle
  - worker message reconciliation
  - page focus or visibility handling
  - bootstrap re-render paths
- Likely validation path:
  - manual reproduction with focus, blur, and visibility changes
  - targeted Playwright reproduction only if the report is confirmed
- Delivery phase: Phase 4

### 13. Browse files and Download ZIP feel too saturated against the rest of the page

- Bucket: Follow-up
- Likely files:
  - `styles.css`
- Likely owning surface:
  - CTA color tokens
  - primary and contextual action hierarchy tuning
- Likely validation path:
  - `Tests/theme-playwright.js`
  - `Tests/convert-button-smoke-playwright.js`
  - manual hierarchy review
- Delivery phase: Phase 3

### 14. Help popup content feels too dense

- Bucket: Follow-up with an explicit scope decision
- Likely files:
  - `index.html`
  - `src/ui.js`
  - `styles.css`
- Likely owning surface:
  - help modal content structure
  - heading hierarchy
  - optional collapsible sections
  - modal spacing
- Likely validation path:
  - manual Help-modal review
  - keyboard open and close verification
  - extend `Tests/playwright-a11y.js` only if this becomes an active implementation item
- Delivery phase: Phase 2 or Phase 4 depending on scope

## Recommended Delivery Order

### Phase 1: Confirmed Blockers

Recommended first batch:
- advanced-section visual consistency
- auto-convert notice layout stability

These items are local, reproducible, and directly affect homepage quality.

### Phase 2: Interaction And Accessibility Follow-Ups

Recommended second batch:
- button sizing consistency
- tooltip placement cleanup
- advanced-section expand affordance
- stronger dark-theme focus visibility
- optional Help-modal refinement if kept in scope

### Phase 3: Theme And Visual Polish

Recommended third batch:
- light-theme CTA contrast
- theme coherence across card surfaces
- CTA saturation and hierarchy tuning
- card padding refinement
- mobile footer sizing

### Phase 4: Investigation And Deferred Work

Recommended final track:
- browser-focus queue-loss investigation
- dropzone relocation decision
- any Help-modal changes that are intentionally moved out of the homepage pass

## Validation Rules

Use the narrowest practical check for each batch.

- Prefer existing homepage Playwright scripts before creating new tests.
- Re-run the matching rows in `docs/Homepage-Review-Checklist.md` after each batch.
- Do not treat investigation-only reports as confirmed defects until reproduced.
- Keep architectural changes separate from local homepage polish unless evidence upgrades them to blockers.

## Relevant Files

- `docs/Homepage-Review-Checklist.md`
- `docs/Homepage-Implementation-Spec.md`
- `docs/Homepage-Implementation-Layout-Sketches.md`
- `index.html`
- `styles.css`
- `src/ui.js`
- `src/app.js`
- `src/worker-wrapper.js`
- `Tests/convert-button-smoke-playwright.js`
- `Tests/auto-convert-manual-playwright.js`
- `Tests/layout-shift-playwright.js`
- `Tests/header-edge-to-edge-playwright.js`
- `Tests/theme-playwright.js`
- `Tests/playwright-a11y.js`
- `Tests/export-format-controls-playwright.js`

## Exit Criteria

This plan has been followed correctly when:
- every review finding maps to exactly one planned row
- every Phase 1 item has a concrete acceptance condition before implementation starts
- every Phase 4 investigation item has a reproduction path before code changes begin
- unresolved items are left as a clear residual backlog rather than being dropped silently

<!-- markdownlint-enable MD022 MD032 -->