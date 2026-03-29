# UI Polish Change Map

Purpose: capture a small, low-risk map for polishing the homepage PWA UI before screenshots.

Status: planning only. No code changes are implied by this document.

## Primary edit locations

The main place to tweak homepage UI appearance is `styles.css`.
That file contains the shared button styling and the light/dark theme color tokens.

Relevant files:
- `styles.css`
- `index.html`
- `src/styles/tailwind.css`
- `package.json`

## Small Change Map

### 1. Strengthen the main button colors first

Edit the light-theme CTA tokens in `styles.css`:
- `--cta-bg`
- `--cta-bg-hover`
- `--cta-bg-active`

Why:
- This is the fastest way to improve contrast for `Convert`, `Download ZIP`, and `Browse files` all at once.

Suggested direction:
- Move the light theme CTA a bit darker and less pastel.
- Keep hover clearly darker than default.
- Keep active clearly darker than hover.

### 2. Increase button padding

Edit these button tokens in `styles.css`:
- `--btn-padding-x`
- `--btn-padding-y`
- optionally `--btn-radius`

Good first tweak:
- `--btn-padding-x`: `1rem` -> `1.125rem` or `1.25rem`
- `--btn-padding-y`: `0.5rem` -> `0.625rem` or `0.75rem`
- `--btn-radius`: `0.375rem` -> `0.5rem` or `0.625rem`

Why:
- This gives bigger buttons and more breathing room around labels without changing layout too aggressively.

### 3. Make the main buttons feel more solid

Edit the `.btn-primary` rule in `styles.css`.

Best small knobs:
- text weight
- shadow
- focus ring
- border

Safe first changes:
- `font-medium` -> `font-semibold`
- slightly deepen `box-shadow`
- optionally add a subtle border instead of `border: none`

Why:
- If the UI feels washed out on matte displays, this matters almost as much as the color tokens.

### 4. Enlarge the header icon buttons

Edit the Help and theme-toggle button classes in `index.html`.

Good first tweak:
- `w-8 h-8` -> `w-10 h-10`

Why:
- This helps the Help button and theme toggle read better and feel less fiddly on touch devices.

### 5. Give the three main homepage actions a minimum width if needed

Apply this only if the actions still feel visually weak after token changes.

Targets in `index.html`:
- `#convertButton`
- `#downloadZip`
- `#importButton`

Possible utility:
- `min-w-[9rem]`
- or `min-w-[10rem]`

Why:
- This makes the action area feel more deliberate and helps screenshots look cleaner.

### 6. Tune secondary button styling

Edit `.btn-ghost` in `styles.css`.

Best small tweaks:
- add a visible border instead of transparent
- slightly stronger hover background
- a bit more padding

Why:
- This is the right place if secondary controls are readable on OLED but too faint on the laptop.

### 7. Improve surface contrast if the page still looks washed out

Edit these tokens in `styles.css`:
- `--bg-page`
- `--bg-card`
- `--bg-soft`
- `--border-muted`

Suggested direction:
- keep cards a touch whiter
- make borders slightly stronger

Why:
- Sometimes the real issue is weak contrast between buttons and surrounding surfaces, not the button colors alone.

### 8. Review dark mode separately

If light mode looks good but dark mode feels weak, edit the dark token set in `styles.css`:
- `--cta-bg`
- `--cta-bg-hover`
- `--cta-bg-active`
- `--btn-shadow`

Why:
- Dark-mode button contrast is controlled independently from the light theme.

## Practical edit order

Use this sequence for the biggest visible improvement with the least code churn:

1. CTA colors
2. Button padding
3. Button font weight and shadow
4. Header icon size
5. Minimum width on main actions

## Current code map

### Shared button tokens and styles

In `styles.css`:
- Light CTA colors: `--cta-bg`, `--cta-bg-hover`, `--cta-bg-active`
- Button shape and spacing: `--btn-radius`, `--btn-padding-x`, `--btn-padding-y`
- Shared primary button class: `.btn-primary`
- Shared secondary/icon button class: `.btn-ghost`

### Homepage buttons in markup

In `index.html`:
- `#helpButton`
- `#themeToggle`
- `#convertButton`
- `#downloadZip`
- `#importButton`

These are the places to edit if one specific control needs a per-button size or width tweak.

### Dark theme token area

In `styles.css`, the dark token set should be reviewed separately if the homepage looks fine in light mode but still weak in dark mode.

## Build note

Do not edit `assets/tailwind-output.css` directly.

Source pipeline:
- `src/styles/tailwind.css` imports `../../styles.css`
- build commands live in `package.json`

Relevant scripts:
- `npm run build:tailwind`
- `npm run watch:tailwind`

## Suggested next step

When implementation starts, prefer a very small first pass using only 5 edits:
- darken primary CTA colors a little
- increase horizontal padding
- increase vertical padding
- make `.btn-primary` text slightly heavier
- enlarge Help/theme icon buttons from `w-8 h-8` to `w-10 h-10`
