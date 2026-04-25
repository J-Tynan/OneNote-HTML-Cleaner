<!-- markdownlint-disable MD022 MD024 MD032 -->

# Homepage Implementation Spec

Status
- Approved implementation baseline for homepage layout.
- Selected layout: Sketch A from `docs/Homepage-Implementation-Layout-Sketches.md`.
- Date selected: 2026-04-25.
- Purpose: define the exact homepage structure to implement in `index.html`, `styles.css`, and related UI logic.

## Scope

This document translates the approved homepage direction into an implementation-ready structure.

It covers:
- exact section order
- semantic page structure
- current control mapping
- desktop and mobile breakpoint behavior
- styling responsibilities between Tailwind utilities and app-owned semantic classes
- acceptance criteria for the first implementation pass

This document does not define final visual polish, icon design, or animation details.

## Implementation Intent

The homepage should ship as a compact split workbench:
- left column for setup and import
- right column for results and progress
- header and footer spanning full width

The first action must remain obvious within a few seconds:
- identify the tool
- understand supported input
- trust that processing stays local
- click Browse files or drag files in

## Structural Rules

The implementation must preserve these rules:
- `Browse files` is the primary CTA.
- `Convert queued files` remains visible but secondary.
- `Download ZIP` is contextual and must not appear as a first-stage primary action.
- `Advanced options` stays collapsed by default.
- `Auto-convert` remains enabled by default.
- results must have a prepared empty state instead of disappearing entirely.
- help content remains in the modal, not expanded into the homepage body.

## Semantic Page Structure

The homepage should use this top-level structure inside `index.html`.

```text
body
|- header.home-header
|  |- div.page-shell
|     |- div.home-header__inner
|        |- div.home-header__identity
|        |- div.home-header__actions
|- main.home-main
|  |- div.page-shell
|     |- div.home-layout
|        |- div.home-layout__primary
|        |  |- section.home-start-card
|        |  |- section.home-advanced-card
|        |  |- section.home-dropzone-card
|        |- aside.home-results-column
|           |- section.home-results-card
|- footer.home-footer
|  |- div.page-shell
|- div#helpModal
```

## Section Order

Desktop and mobile must share the same logical order.

Visual order:
1. Header
2. Start card
3. Advanced options
4. Dropzone
5. Results card
6. Footer
7. Help modal outside normal page flow

DOM order should keep the left-column surfaces before the results column. This preserves reading order and avoids awkward keyboard traversal.

## Container And Layout Contract

### Page shell
- Keep one shared centered wrapper with a max width.
- Continue using the existing max-width approach rather than full-bleed content.
- A `max-w-6xl` shell is acceptable for the first implementation pass.

### Desktop layout
- Use a two-column grid from the large breakpoint upward.
- Left column target width: approximately 56 percent.
- Right column target width: approximately 44 percent.
- A 12-column grid should map to:
  - left column `lg:col-span-7`
  - right column `lg:col-span-5`

### Mobile layout
- Below the large breakpoint, stack sections in a single column.
- The start card must appear before any advanced or diagnostic surface.
- The results card must remain below the dropzone in the document flow.

### Spacing
- Keep one consistent vertical rhythm between cards.
- The start card should feel like the visual anchor.
- The dropzone should not visually overpower the start card.

## Header Specification

### Purpose
- establish product identity
- provide one-sentence reassurance
- expose Help and theme actions

### Required content
- product name
- short promise
- help button
- theme toggle

### Approved copy
- Title: OneNote HTML Cleaner
- Promise: Convert exported OneNote pages into clean HTML locally in your browser.

### Control mapping
- Keep `#helpButton`.
- Keep `#themeToggle`.
- Keep `#themeToggleIcon`.

### Implementation notes
- The header should remain one compact row on desktop.
- On narrow screens the identity block may wrap, but the action cluster must stay discoverable.
- The header promise should be shorter than the current intro paragraph.

## Start Card Specification

### Purpose
- provide the main task framing
- state supported input
- state local-processing reassurance
- present the primary and secondary actions

### Required block order
1. heading
2. one-sentence support text
3. supported-input note
4. local-processing note
5. primary and secondary action row

### Approved copy
- Heading: Convert exported OneNote pages
- Support text: Add one or more MHT or MHTML files to clean and export them locally.
- Supported input note: Supported input: .mht, .mhtml
- Local-processing note: Files stay on your device
- Primary action label: Browse files
- Secondary action label: Convert queued files

### Control mapping
- Keep `#importButton` as the primary action.
- Keep `#convertButton` as the secondary action.
- Keep `#convertTooltip` and its wrapper behavior.
- Move `#downloadZip` out of the start card.

### Required implementation change
- The current `Download ZIP` button must no longer appear in the start/import card.
- The current start card should be rewritten around the Browse-first hierarchy.

### Layout notes
- On desktop, Browse and Convert should sit in one action row when space permits.
- On mobile, stack the buttons vertically with Browse first.
- The Convert action must remain visibly secondary through styling, placement, and emphasis.

## Advanced Options Specification

### Purpose
- keep optional controls available without displacing the main task

### Required structure
- one card surface
- one `details` accordion
- short label and optional helper text in the closed state
- grouped controls inside the opened state

### Control mapping
- Keep `#advancedOptions`.
- Keep `#statusControls` as the internal option container if it still fits the implementation.
- Keep existing option controls and IDs, including:
  - `#autoConvertEnabled`
  - `#externalizeCssEnabled`
  - `#externalizeCssMode`
  - `#experimentalExportEnabled`
  - `#exportFormat`
  - `#markdownFlavor`
  - `#convertedPageThemeToggleEnabled`
  - `#convertedPageThemeToggleOledBlack`
  - `#toolbarEnabled`

### Closed-state copy
- Label: Advanced options
- Helper text: Optional settings for export behavior and output format

### Implementation notes
- Preserve the current option families rather than redesigning their logic during the layout pass.
- This phase is layout restructuring, not option model simplification.

## Dropzone Specification

### Purpose
- provide drag-and-drop import as a supportive input path
- reinforce that processing is local

### Required block order
1. short heading or action line
2. drag-and-drop support text
3. local-processing note
4. hidden file input preserved for import binding

### Approved copy direction
- Heading: Drag and drop files
- Support line: Drop exported OneNote pages here to start conversion
- Support note: Local browser processing only

### Control mapping
- Keep `#dropzone`.
- Keep `#fileInput`.
- Preserve dropzone keyboard focusability.

### Required implementation change
- The dropzone should no longer contain the visually dominant Browse button.
- Browse should live in the start card only.

## Results Card Specification

### Purpose
- show queue state, progress, per-file outcomes, downloads, and technical details

### Required block order
1. results heading row
2. status summary text
3. optional ZIP action row
4. file result list
5. technical details accordion

### Approved copy
- Heading: Conversion results
- Empty-state summary: Added files will appear here with progress, status, and downloads

### Control mapping
- Keep `#statusPanel` as the main results card container.
- Keep `#appStateBadge`.
- Keep `#statusSummary`.
- Keep `#fileList`.
- Keep `#diagnosticsPanel`.
- Keep `#diagnosticsCount`.
- Keep `#diagnosticsList`.
- Move `#downloadZip` into this card.

### Required implementation change
- Do not fully hide the results card when the queue is empty.
- Replace the current fully hidden empty state with a visible prepared empty panel.
- ZIP should render inside the results area and stay disabled or hidden until output exists.

### Behavioral implication
- The current `updateStatusVisibility()` behavior in `src/ui.js` will need to stop toggling the entire results card off when the queue is empty.
- Instead, it should switch the card between empty, queued, working, success, unsupported, and error presentation states.

## Footer Specification

### Purpose
- provide provenance and documentation links without carrying primary guidance

### Required content
- short local-processing reminder
- documentation link
- optional GitHub link if retained

### Approved copy direction
- Local reminder: Offline-capable local processing. Files stay on your device.

### Implementation notes
- Footer text should remain short and low-emphasis.

## Help Modal Specification

### Purpose
- keep detailed guidance out of the homepage body

### Control mapping
- Keep `#helpModal`.
- Keep `#helpModalTitle`.
- Keep `#helpCloseButton`.

### Implementation notes
- Modal content can be edited later for brevity, but that is not required to complete the layout pass.
- The homepage should rely on the modal for secondary explanations, not inline page paragraphs.

## Styling Responsibility Split

The repo styling contract should remain:
- Tailwind utilities for layout, spacing, sizing, and responsive behavior
- `styles.css` semantic classes for app-owned component presentation

### Tailwind responsibility
- page shell width
- grid and stack behavior
- spacing rhythm
- alignment
- breakpoint changes

### `styles.css` responsibility
- card treatment
- button hierarchy styling
- dropzone presentation
- status badge treatment
- results row presentation
- tooltip treatment

### Constraint
- Do not introduce a new styling framework or reintroduce Flowbite.

## Current-to-Target Mapping

The first implementation pass should reshape the existing structure instead of replacing everything.

### Keep and reposition
- `#helpButton`
- `#themeToggle`
- `#importButton`
- `#convertButton`
- `#advancedOptions`
- `#dropzone`
- `#statusPanel`
- `#downloadZip`

### Keep with behavioral change
- `#statusPanel` should become visible in the empty state.
- `#downloadZip` should move from the import card to the results card.
- `#convertButton` stays visible but remains secondary.

### Keep unchanged for this phase
- help modal structure
- advanced option IDs and internal logic
- theme toggle behavior
- worker/bootstrap architecture

## Acceptance Criteria

The layout implementation is correct when all of the following are true:
- header shows title, short promise, Help, and theme toggle in a compact structure
- the left column contains start card, advanced options, and dropzone in that order on desktop
- the right column contains a visible results card on desktop even before files are added
- `Browse files` is the visually dominant action
- `Convert queued files` is visible but clearly secondary
- `Download ZIP` only appears in the results area
- the dropzone supports drag-and-drop without duplicating the main CTA hierarchy
- mobile stacks sections in the approved order without putting results above the primary action
- keyboard access remains intact for Help, theme toggle, Browse, dropzone, and advanced options

## Recommended Implementation Order

1. Restructure `index.html` to match the selected section order.
2. Move `#downloadZip` into the results card.
3. Rewrite start-card and header copy to match the approved baseline.
4. Adjust the grid split so desktop uses a left-heavy workbench.
5. Update `src/ui.js` empty-state behavior so results stay visible.
6. Update `styles.css` to reinforce action hierarchy and card roles.

## Out Of Scope For The First Pass

These items should not block the first implementation pass:
- help modal copy cleanup
- deeper advanced-options IA changes
- animation refinements
- iconography refinement
- diagnostics UX redesign beyond placement and visibility

<!-- markdownlint-enable MD022 MD024 MD032 -->