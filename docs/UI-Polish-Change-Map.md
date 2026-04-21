# UI Polish Change Map

Purpose: capture a small, low-risk map for polishing the homepage PWA UI before screenshots.

Status: living design note. This document should track the current homepage shell, the current runtime states, and the safest polish moves for screenshot preparation.

## Scope

- Homepage PWA only: header, import column, advanced options, dropzone, status/results panel, footer, and help modal.
- Focus on visual polish, layout rhythm, state clarity, and screenshot readiness.
- Keep the current product contract intact: MHTML-first flow, local/offline messaging, accessible controls, and responsive stability.
- Do not treat this guide as a redesign plan or a request to add a third-party UI library.

## Screenshot States To Design For

### 1. Empty/default state

- Header visible with Help and theme actions.
- Import card visible with `Convert` and `Download ZIP` disabled.
- Advanced options collapsed.
- Dropzone visible with `Browse files` as the main CTA.
- No status/results panel yet.

### 2. Advanced options state

- Advanced options expanded.
- Conversion controls, selects, and helper copy visible.
- Still reads as approachable for a first-time user.

### 3. Queue/results state

- Status panel visible with multiple generated file rows.
- Badge, status pills, remove buttons, and per-file download actions all readable.
- Diagnostics panel optional, but only if it improves the screenshot narrative.

### 4. Optional help-modal state

- Use only if a documentation/help screenshot is needed.
- Modal should feel like part of the same product rather than a separate visual style.

## Current Homepage Model

### Static shell in `index.html`

- Header: title, supporting copy, Help button, theme toggle.
- Left column: import summary card, advanced options card, dropzone card.
- Right column: status/results panel, hidden until files exist.
- Footer: local-processing reassurance and documentation link.
- Help modal: hidden by default, opened from the Help button or `?`.

### Runtime-generated UI in `src/ui.js`

- `#statusPanel` is hidden until the queue has items.
- `#appStateBadge` switches between `Empty` and `<count> queued`.
- `renderFileList()` creates each `.file-item` row, status pill, remove button, and per-file download button.
- `#diagnosticsPanel` stays hidden until diagnostics exist.
- `#convertTooltip` is shown only when manual convert is unavailable.

### Layout model

- Layout A: desktop workbench (`>= 1024px`).
- Layout B: tablet/laptop (`640px` to `1023px`).
- Layout C: mobile (`< 640px`).
- Recent responsive fixes intentionally prevent horizontal overflow in Layout B and Layout C.

## Styling Stack

There are three styling layers on the homepage now:

1. Tailwind utility classes in `index.html`
   - Used for grid, spacing, widths, responsive layout, and a few local one-off adjustments.
   - Best for per-element changes that should not affect the rest of the UI.

2. App-owned semantic classes in `styles.css`
   - Used for the shared visual system.
   - Main classes include `.card-panel`, `.card-panel--soft`, `.card-section`, `.option-panel`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.form-control`, `.surface-soft`, and `.surface-card`.

3. Runtime state classes and attributes
   - Generated or toggled by `src/ui.js`.
   - Main examples: `.file-item`, `.status-pill--*`, `#appStateBadge[data-state]`, `.tooltip.hidden`, and the `hidden` state on panels and modal containers.

Simple rule:

- Use `styles.css` when the change should affect the shared visual language.
- Use `index.html` Tailwind utilities when the change should affect only one specific control or one specific container.
- Touch `src/ui.js` only when the polish target is runtime-generated markup or state behavior.

Important note:

- The project uses Tailwind CSS for utilities and layout.
- The project does not use a third-party Tailwind UI library.

## Primary Edit Locations

- `styles.css`
  - Main source of truth for tokens, shared surfaces, buttons, status pills, tooltip styling, and help-modal polish.
- `index.html`
  - Main source of truth for layout, responsive container spacing, per-element utilities, and the static homepage shell.
- `src/ui.js`
  - Edit only if the screenshot target depends on the generated queue rows, diagnostics visibility, or state presentation.
- `src/styles/tailwind.css`
  - Tailwind v4 CSS-first entry file that imports `../../styles.css`, keeps preflight disabled, and registers explicit scan sources.
- `package.json`
  - Build commands only.

Do not edit `assets/tailwind-output.css` directly.

## Current Shared UI Tokens And Components

### Shared primary action tokens in `styles.css`

Current light-theme values:

- `--cta-bg: #0ea5b3`
- `--cta-bg-hover: #0891b2`
- `--cta-bg-active: #056b6d`
- `--btn-radius: 0.375rem`
- `--btn-padding-x: 1.25rem`
- `--btn-padding-y: 0.75rem`
- `--btn-shadow: 0 1px 2px rgba(2,6,23,0.06)`
- `--btn-focus-ring: rgba(14,165,179,0.12)`

### Shared primary action scope

`.btn-primary` now affects more than the three static homepage buttons.

Static controls:

- `#convertButton`
- `#downloadZip`
- `#importButton`

Runtime-generated controls:

- per-file download buttons created in `renderFileList()` inside `src/ui.js`

That means any shared `.btn-primary` change should be judged both in the empty homepage shell and in the populated queue/results state.

### Shared secondary action scope

- `.btn-ghost` affects Help, theme toggle, and Help-modal close.
- `.btn-secondary` affects generated Remove buttons in the file list.

### Shared surface system

- `.card-panel` is the main shell panel.
- `.card-panel--soft` softens contextual regions like advanced options and status/results.
- `.card-section` and `.option-panel` create nested hierarchy inside the advanced-options flow.
- `.surface-soft` and `.border-default` are used directly on the dropzone and diagnostics panel.

## Small Change Map For The Current PWA

### 1. Strengthen CTA hierarchy

Edit in: `styles.css`

Best knobs:

- `--cta-bg`
- `--cta-bg-hover`
- `--cta-bg-active`
- `--btn-shadow`
- `--btn-focus-ring`

Why this is low risk:

- It improves the most important actions without changing layout structure.
- It automatically updates both static actions and runtime file-download actions.

Watch-outs:

- If the primary buttons get too visually heavy, the queue/results screenshot can start to look noisy because every successful row inherits that stronger treatment.

### 2. Improve header affordance

Edit in: `index.html` for size changes, `styles.css` for shared `.btn-ghost` styling.

Current controls:

- `#helpButton`: `btn-ghost inline-flex items-center justify-center rounded w-8 h-8 text-sm`
- `#themeToggle`: `btn-ghost inline-flex items-center justify-center w-8 h-8 p-0 text-2xl leading-none`

Low-risk moves:

- Increase `w-8 h-8` to `w-10 h-10` for better screenshot balance and touch-target feel.
- Slightly strengthen `.btn-ghost` hover or border only if the header actions feel too faint.

Watch-outs:

- Keep the header light and compact. Oversized icon buttons can overpower the title block.

### 3. Tighten panel rhythm and hierarchy

Edit in: `styles.css` and, if needed, container utilities in `index.html`

Current shared panel spacing:

- `.card-panel`: `padding: 1.25rem`
- `.card-section`: `padding: 1rem`
- `.option-panel`: `padding: 1rem`
- Mobile overrides reduce nested panel padding to `1rem` and `0.75rem`

Low-risk moves:

- Slightly strengthen border contrast before increasing panel shadows.
- Adjust internal spacing so the import card, advanced options card, and dropzone feel intentionally related rather than independently padded.
- If the page feels vertically cramped, consider adjusting the header container or main container spacing in `index.html` before touching every component class.

Watch-outs:

- Do not introduce padding or width changes that bring back horizontal overflow in Layout B or Layout C.

### 4. Increase dropzone emphasis

Edit in: `index.html` and `styles.css`

Current structure:

- `#dropzone` uses `surface-soft border-default rounded-2xl border-2 border-dashed p-6 transition-colors`
- `#importButton` is the main dropzone CTA.
- Supporting copy reinforces local processing.

Low-risk moves:

- Increase visual separation between the dropzone border and surrounding panel surface.
- Slightly deepen the drag-highlight state using `--dropzone-highlight` if the active state feels too subtle.
- Increase the dropzone’s perceived importance through spacing before adding more decorative styling.

Watch-outs:

- Preserve the privacy/local-processing message. It is part of the product story, not filler copy.

### 5. Improve advanced-options scannability

Edit in: `styles.css` first, `index.html` second

Current model:

- The whole area is a `.card-panel card-panel--soft` container.
- `details#advancedOptions` uses `.card-section`.
- Each group inside uses `.option-panel`.
- Selects use `.form-control`.
- Checkboxes still rely partly on local Tailwind utility classes in the markup.

Low-risk moves:

- Improve separation between headings, help text, and grouped controls.
- Tighten muted-copy rhythm so the panel reads clearly in screenshots.
- Strengthen the summary/header row only if the expanded state does not read clearly enough.

Watch-outs:

- Avoid turning advanced options into the visual hero of the homepage. It should stay secondary to the import/dropzone flow.

### 6. Improve queue/results screenshot readiness

Edit in: `styles.css`, and `src/ui.js` only if generated markup structure must change

Current runtime-generated pieces:

- `.file-item`
- `.status-pill`
- `.status-pill--queued`
- `.status-pill--working`
- `.status-pill--success`
- `.status-pill--error`
- `.status-pill--unsupported`
- `.btn-secondary` for Remove
- `.btn-primary` for per-file download

Low-risk moves:

- Increase contrast between file rows and the surrounding status panel.
- Improve badge and pill readability before changing layout structure.
- If queue rows feel soft, strengthen `.file-item` hover or border treatment before adding extra controls.

Watch-outs:

- `#appStateBadge` only has shell-level `empty` and `queued` states right now. Do not document or style it as if it reflected every per-file status.

### 7. Keep the convert tooltip polished and contained

Edit in: `styles.css` and `src/ui.js` only if behavior changes are required

Current model:

- `#convertButton` sits inside `.convert-button-wrapper`.
- `#convertTooltip` is hidden/shown by runtime conditions.
- Tooltip is right-aligned and constrained to the viewport to avoid overflow.

Low-risk moves:

- Improve tooltip surface contrast or copy rhythm if it looks cramped.
- Keep it visually aligned with the button stack.

Watch-outs:

- Do not undo the right-aligned placement or viewport max-width guardrails that were added to stop horizontal overflow.

### 8. Review help-modal polish separately

Edit in: `styles.css` and `index.html`

Current model:

- Modal shell uses `.surface-card`.
- Width and padding are already tuned per breakpoint.
- Focus styling is explicitly handled in `styles.css`.

Low-risk moves:

- Improve spacing and readability of long-form help copy.
- Refine modal surface contrast and close-button balance if the help screenshot is part of the capture set.

Watch-outs:

- Keep accessibility visible. Focus treatment and readable copy are part of the value here.

### 9. Review dark mode only after light mode is settled

Edit in: `styles.css`

Current dark base tokens live under `html.dark`.
Additional variants exist for testing, but they are not the primary homepage UI surface.

Low-risk moves:

- Tune dark CTA contrast.
- Tune dark shadows and panel separation.
- Confirm that status pills still separate clearly in dark mode.

Watch-outs:

- Do not start the polish pass in dark mode first. Light mode is the clearest baseline for screenshot work on this screen.

## Screenshot-Specific Guidance

### Main app screenshot

Prioritize:

- header balance
- import card clarity
- dropzone emphasis
- primary CTA contrast

Keep hidden:

- status/results panel if the goal is the first-time-user shell
- diagnostics panel

### Advanced options screenshot

Prioritize:

- summary row clarity
- nested panel hierarchy
- form-control readability
- helper copy rhythm

Avoid:

- making advanced options visually heavier than the import path

### Queue/results screenshot

Prioritize:

- row contrast
- status-pill readability
- balance between Remove and Download actions
- clear spacing between file rows

Avoid:

- over-styling successful rows so the screen becomes too visually loud

## Guardrails

- Preserve the PWA/local-processing identity. The UI should still read as local, private, and utility-focused.
- Preserve responsive stability. No new horizontal overflow in Layout B or Layout C.
- Preserve the disabled/manual-convert tooltip behavior and viewport containment.
- Preserve the hidden-until-needed behavior for `#statusPanel`, `#diagnosticsPanel`, and `#helpModal`.
- Preserve accessible focus treatment rather than removing it for cleaner screenshots.
- Do not reintroduce Flowbite or another UI library just for visual polish.

## Build And Confidence Checks

After UI-polish code changes:

1. Run `npm run build:tailwind`.
2. If layout or spacing changed, run `npm run test:header-edge`.
3. If theme polish changed tokens or dark mode, run `npm run test:theme`.

Reminder:

- If you change `styles.css`, rebuild Tailwind so `assets/tailwind-output.css` stays current.
- If you add new Tailwind utility classes in `index.html`, rebuild Tailwind so those utilities are emitted.

## Suggested First Pass

Use this sequence for the biggest visible improvement with the least product risk:

1. Slightly deepen the shared CTA tokens and shadow in `styles.css`.
2. Increase Help and theme-toggle button size in `index.html` from `w-8 h-8` to `w-10 h-10`.
3. If needed, add a minimum width to the three static primary actions so the empty-state screenshot feels more deliberate.
4. Strengthen queue-row and status-pill contrast for the results screenshot.
5. Tighten advanced-options spacing and helper-text hierarchy without changing the control set.
