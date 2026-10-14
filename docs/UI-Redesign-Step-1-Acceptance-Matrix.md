# UI Redesign Step 1 Acceptance Matrix

Prepared: 2026-10-14
Status: active baseline

## Goal

Create a reproducible baseline and acceptance contract for the approved homepage redesign before implementation changes begin.

The approved screenshot is the visual source of truth. The current UI screenshot is the before-state reference.

## Scope

In scope:

- Homepage presentation at desktop, tablet, and mobile widths
- Empty, queued, converting, completed, unsupported, and selected-item result states
- Light and dark themes
- Layout geometry, overflow, keyboard reachability, contrast, and action-row stability
- Mapping target visuals to existing DOM controls and UI owners

Out of scope:

- Native `.one` parsing, conversion, notebook extraction, or support claims
- Importer, worker, pipeline, and exported-page changes
- Changes to the MHT/MHTML acceptance contract

The notebook, section, and page rows in the target are illustrative presentation. They do not add `.one` support. `.one` must continue to use the existing unsupported path.

## Viewport Matrix

| Context | Viewport | Required states | Review focus |
| --- | --- | --- | --- |
| Desktop | 1366 x 900 | Empty, queued, completed, unsupported, selected | Aligned panes, dense results table, action-row fit |
| Tablet | 820 x 1180 | Empty, queued, selected | Stacked layout, no clipped controls, readable option labels |
| Mobile | 390 x 844 | Empty, queued, expanded options | No horizontal overflow, tap targets, readable action groups |

Capture each viewport in light theme. Capture desktop and mobile again in dark theme. Before capture, wait for the existing 150 ms surface/theme transition to settle.

## Target-to-Current Control Map

| Target region | Existing controls and owner | Step 1 contract |
| --- | --- | --- |
| Header identity and actions | `.home-header`, `#helpButton`, `#themeToggle` in `index.html`; modal/theme behavior in `src/ui.js` and `src/theme.js` | Keep behavior and accessible names while visual structure changes later. |
| Import actions | `#importButton`, `#folderImportButton`, `#fileInput`, `#folderInput` in `index.html`; bindings in `src/ui.js` | Browse remains primary; folder import remains available; accepted extensions stay `.mht,.mhtml`. |
| Dropzone | `#dropzone` in `index.html`; drag/drop handling in `src/ui.js` | Remains keyboard-focusable and a supportive import path. |
| Advanced options | `#advancedOptions`, `#statusControls`; state logic in `src/ui-options.js` | Starts open, as required by the approved screenshot and `layout-shift-playwright.js`. |
| Manual queue action | `#convertButton`, `#convertTooltip`, `.queue-action-strip`; behavior in `src/ui.js` | Retains auto-convert and disabled-tooltip behavior. |
| Results workbench | `#statusPanel`, `#appStateBadge`, `#statusSummary`, `#workbenchSearch`, `#workbenchFilter`, `#fileList`; rendering in `src/ui.js` and model in `src/ui-workbench-model.js` | Keeps empty, queued, working, success, error, and unsupported presentation states. |
| Result actions | `#downloadSelected`, `#downloadZip`, `#clearFilesButton`, `#selectionSummary`; behavior in `src/ui.js` | Retains selection, individual download, ZIP, and clear behavior. |
| Footer | `.home-footer` in `index.html` | Retains local-processing reminder and project links. |

## Acceptance Checks

### Geometry and Fit

- Desktop has two top-aligned panes; the results pane is at least as wide as the import pane.
- Tablet and mobile have no horizontal document overflow.
- Text, action labels, selects, status chips, and menus remain inside their containers.
- Expanding or toggling option state does not shift the primary import action or cause the result actions to jump.

### State Presentation

- Empty state visibly prepares the results area without implying a conversion has happened.
- Queued, working, successful, error, and unsupported entries have discernible status treatment.
- Search, filter, selection, and action controls retain their enabled/disabled states.
- An unsupported `.one` upload remains unsupported and exposes no download action.

### Accessibility and Themes

- All controls have a visible keyboard focus state and a usable accessible name.
- Accordion, result tree, overflow menu, and Help dialog remain keyboard operable.
- Light and dark themes preserve readable contrast and distinguish interactive controls from disabled controls.
- Decorative target icons are excluded from the accessibility tree when introduced in later steps.

## Required Baseline Evidence

| Evidence | Method | Expected result |
| --- | --- | --- |
| Structural shell | `npm run test:header-edge` | Header is edge-to-edge; expected panel structure works at desktop, tablet, and mobile. |
| Layout stability | `npm run test:layout-shift` | Advanced options start open; status text changes do not introduce width or action-position shifts. |
| MHT/MHTML-only input contract | `npm run test:folder-import` | Folder input keeps `.mht,.mhtml` acceptance and relative-path hierarchy behavior. |
| Native `.one` exclusion | `npm run test:unsupported-file` | `.one` remains unsupported with no download action. |
| Accessibility baseline | `npm run test:playwright:a11y` | No serious or critical issues in light or dark themes. |

## Decision Record

- The approved screenshot takes precedence over older layout documentation where they conflict.
- Advanced options remains open by default; the current implementation and layout test already follow that decision.
- The target's notebook hierarchy is not a functional requirement for native OneNote files.
- Future redesign work must preserve MHT/MHTML browse, folder import, drag/drop, conversion, downloads, clear, draft restore, search/filter, and option gating.

## Baseline Run: 2026-10-14

Passed:

- `npm run test:header-edge`
- `npm run test:layout-shift`
- `npm run test:folder-import`
- `npm run test:unsupported-file`

Observed accessibility follow-up:

- `npm run test:playwright:a11y` reports one serious `color-contrast` rule violation in both themes.
- Light-theme instances are `.product-version` (4.2:1), `.workflow-support` (4.01:1), and `.results-heading__support` (4.01:1), each below the 4.5:1 threshold for their text size.
- The redesign styling step must correct these token/component colors and rerun the audit. This is a recorded baseline defect, not authorization to change the UI during Step 1.
