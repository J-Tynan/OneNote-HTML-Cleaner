# Cross-Display UI Review Plan

Prepared: 2026-06-01
Status: planned, waiting for manual screenshot evidence

## Goal

Run a final cross-display UI polish review for the PWA homepage and results surfaces before the next screenshot-oriented `v0.2` step.

This is a review-and-triage task first, not an implementation task. The aim is to inspect the current UI across the most important display contexts, record any remaining readability or contrast issues, and then decide whether a narrow follow-up fix slice is needed.

## Task Anchor

Source task in `TODO.md`:

- `[ ] [P1] Do a cross-display UI polish review as the last pre-screenshot v0.2 UI task and record any remaining readability or contrast fixes needed for the PWA.`

## Scope

In scope:

- Homepage start card
- Advanced options section
- Dropzone section
- Results card and empty state
- CTA and secondary control readability
- Light/dark theme contrast and surface separation
- Keyboard focus visibility
- Layout stability and responsive density

Out of scope unless new evidence appears:

- Exported-page rendering
- Toolbar-injected converted page chrome
- Broad post-release structural refactors
- Rebaselining generated report artifacts

## Primary Files

Likely review and fix surfaces:

- `index.html`
- `styles.css`
- `src/theme.js`
- `docs/Homepage-Review-Checklist.md`
- `TODO.md`

Supporting validation files:

- `Tests/theme-playwright.js`
- `Tests/playwright-a11y.js`
- `Tests/header-edge-to-edge-playwright.js`
- `Tests/layout-shift-playwright.js`
- `package.json`

## Existing Review Baseline

The review should reuse existing project criteria rather than invent a new standard.

Relevant baseline documents:

- `docs/Homepage-Review-Checklist.md`
- `docs/Homepage-Implementation-Spec.md`
- `docs/Release-Screenshot-Shot-List.md`

Important risks already captured in existing notes:

- Light theme may feel too flat on matte or low-contrast displays
- Dark-theme focus indicators may be too subtle
- Advanced options clarity and layout consistency need rechecking
- Mobile density around footer, results, and expanded advanced controls may still need refinement

## Review Strategy

### Phase 1: Reconfirm scope and baseline

- Use the homepage review checklist as the primary rubric.
- Re-check prior observations to determine which are already fixed and which remain visible.
- Keep the task focused on review and evidence collection.

### Phase 2: Automated baseline validation

Run the narrow existing checks that can disconfirm likely regressions before manual review expands:

```powershell
npm run test:theme
npm run test:playwright:a11y
npm run test:header-edge
npm run test:layout-shift
```

These cover:

- persisted theme startup and theme variants
- app accessibility in light and dark themes
- header responsiveness and overflow
- layout stability when advanced controls change state

### Phase 3: Manual cross-display review

Minimum manual review matrix:

- Desktop light theme
- Desktop dark theme
- Narrow mobile width
- One matte or low-contrast desktop/laptop pass
- One OLED dark-theme phone pass if available

For each context, inspect:

- CTA prominence
- card and panel separation
- muted/help-text legibility
- advanced-options clarity
- results-card readability
- keyboard focus visibility
- oversaturated or overly flat surfaces
- cramped mobile layout or oversized low-value sections

### Phase 4: Record findings and triage

Record findings using the existing repo note format:

- Observation
- Impact
- Suggestion
- Severity

Severity labels:

- Blocker
- Follow-up
- Polish

Preferred destination for findings:

- `docs/Homepage-Review-Checklist.md`

Decision rule after findings are recorded:

- If no blocker-grade issues remain, mark the review task complete in `TODO.md`.
- If issues remain, convert only the highest-value readability, contrast, spacing, or focus issues into the next narrow implementation slice.

## Highest-Risk Areas To Inspect First

1. Light-theme card and button separation on matte or low-contrast screens.
2. Dark-theme keyboard focus visibility.
3. Advanced-options clarity and stability when expanded or collapsed.
4. Mobile density around the header, footer, and results card.

## User Evidence Requested

The first manual evidence batch should focus on the highest-value display contexts.

Confirmed device coverage:

- Matte laptop or low-contrast desktop
- OLED phone in dark theme

Requested screenshot batch:

1. Empty homepage in light theme on the matte or low-contrast display
2. One queued file in light theme on the matte or low-contrast display
3. One queued file in dark theme after a full reload on the OLED phone
4. Advanced options expanded on mobile width

For each screenshot, include:

1. device and display type
2. theme
3. state shown
4. short note on what feels too flat, too saturated, too cramped, too subtle, or hard to read

Recommended feedback format:

```text
Observation:
Impact:
Suggestion:
Severity: Blocker | Follow-up | Polish
```

## Current Next Step

Wait for the first screenshot batch, compare it against the homepage review checklist, then decide whether the next action is:

1. record findings only
2. prepare a focused fix plan
3. request one more targeted screenshot pass for an unresolved display-specific issue

## Notes

- User-supplied real-hardware observations should take priority when they conflict with synthetic browser checks, especially for matte-screen light-theme contrast and OLED dark-theme readability.
- If the review finds only small polish issues, batch them into one narrow follow-up implementation slice rather than reopening broader homepage layout decisions.
- Generated report files under `Tests/reports/` are not required deliverables for this review unless a deliberate rebaseline becomes necessary later.
