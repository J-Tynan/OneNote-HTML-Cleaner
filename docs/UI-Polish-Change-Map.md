# UI Polish Change Map

Purpose: capture a small, low-risk map for polishing the homepage PWA UI before screenshots.

Status: planning only. No code changes are implied by this document.

## How to read this guide

There are two different ways the homepage UI is styled in this repo:

1. Plain CSS in `styles.css`
	 - Best when you want to change the shared look of several controls at once.
	 - Example: changing the primary button background for `Convert`, `Download ZIP`, and `Browse files` together.

2. Tailwind utility classes in `index.html`
	 - Best when you want to change one specific element.
	 - Example: making just the Help button larger with `w-10 h-10`.

Simple rule:
- Use `styles.css` for shared button colors, spacing, radius, borders, and shadows.
- Use `index.html` Tailwind classes for one-off sizing, spacing, width, and layout tweaks.

## Primary edit locations

The main place to tweak homepage UI appearance is `styles.css`.
That file contains the shared button styling and the light/dark theme color tokens.

Relevant files:
- `styles.css`
- `index.html`
- `src/styles/tailwind.css`
- `package.json`

## Important beginner note: CSS tokens vs Tailwind classes

The homepage buttons mix both systems:

- Shared primary buttons use the `.btn-primary` class from `styles.css`.
- Shared icon buttons use the `.btn-ghost` class from `styles.css`.
- Some sizing still comes from Tailwind classes in `index.html`.

That means:

- If you edit `.btn-primary`, all three main action buttons change together.
- If you edit `#helpButton` or `#themeToggle` classes in `index.html`, only those buttons change.
- If you add new Tailwind classes, rebuild Tailwind so the generated CSS includes them.

## Current values at a glance

### Shared primary button tokens in `styles.css`

Current light-theme values:

- `--cta-bg: #0ea5b3`
- `--cta-bg-hover: #0891b2`
- `--cta-bg-active: #056b6d`
- `--btn-radius: 0.375rem`
- `--btn-padding-x: 1rem`
- `--btn-padding-y: 0.5rem`
- `--btn-shadow: 0 1px 2px rgba(2,6,23,0.06)`
- `--btn-focus-ring: rgba(14,165,179,0.12)`

### Shared primary button rule in `styles.css`

Current `.btn-primary` uses:

- `text-sm`
- `font-medium`
- `focus:ring-2`
- `focus:ring-offset-2`
- `border: none`
- `padding: var(--btn-padding-y) var(--btn-padding-x)`
- `box-shadow: var(--btn-shadow)`

Important detail:
- The visible button shadow is mainly controlled by `--btn-shadow`, because the rule sets `box-shadow` directly.
- The visible focus glow is mainly controlled by `--btn-focus-ring`, because `.btn-primary:focus` also sets `box-shadow` directly.

### Shared ghost button rule in `styles.css`

Current `.btn-ghost` uses:

- `rounded`
- `px-2 py-1`
- `text-sm`
- `background: transparent`
- `border: 1px solid transparent`
- hover background: `rgba(2,6,23,0.04)`

### Current homepage button classes in `index.html`

Current header buttons:

- `#helpButton`: `btn-ghost inline-flex items-center justify-center rounded w-8 h-8 text-sm`
- `#themeToggle`: `btn-ghost inline-flex items-center justify-center w-8 h-8 p-0 text-2xl leading-none`

Current main action buttons:

- `#convertButton`: `btn-primary`
- `#downloadZip`: `btn-primary`
- `#importButton`: `btn-primary`

## Small Change Map

### 1. Strengthen the main button colors first

Edit the light-theme CTA tokens in `styles.css`:

- `--cta-bg`
- `--cta-bg-hover`
- `--cta-bg-active`

Current values:

- `--cta-bg: #0ea5b3`
- `--cta-bg-hover: #0891b2`
- `--cta-bg-active: #056b6d`

Why:

- This is the fastest way to improve contrast for `Convert`, `Download ZIP`, and `Browse files` all at once.

Plain CSS options:

- Very small change: keep the same hue, just darken a little.
	- `--cta-bg: #0891b2`
	- `--cta-bg-hover: #0e7490`
	- `--cta-bg-active: #155e75`
- More blue and slightly less teal:
	- `--cta-bg: #0284c7`
	- `--cta-bg-hover: #0369a1`
	- `--cta-bg-active: #075985`
- More teal and less pastel:
	- `--cta-bg: #0f766e`
	- `--cta-bg-hover: #115e59`
	- `--cta-bg-active: #134e4a`

Tailwind equivalents if you want to test a direction mentally:

- Current color is close to a cyan/teal family.
- Small darker step: `bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800`
- More blue: `bg-sky-600 hover:bg-sky-700 active:bg-sky-800`
- More teal: `bg-teal-600 hover:bg-teal-700 active:bg-teal-800`

Recommendation:

- For this project, prefer editing the CSS tokens rather than adding one-off Tailwind background classes to each primary button.
- That keeps the three main action buttons consistent.

### 2. Increase button padding

Edit these button tokens in `styles.css`:

- `--btn-padding-x`
- `--btn-padding-y`
- optionally `--btn-radius`

Current values:

- `--btn-padding-x: 1rem`
- `--btn-padding-y: 0.5rem`
- `--btn-radius: 0.375rem`

Why:

- This gives bigger buttons and more breathing room around labels without changing layout too aggressively.

Plain CSS options:

- Safe first tweak:
	- `--btn-padding-x: 1.125rem`
	- `--btn-padding-y: 0.625rem`
	- keep `--btn-radius: 0.375rem`
- Slightly bolder:
	- `--btn-padding-x: 1.25rem`
	- `--btn-padding-y: 0.75rem`
	- `--btn-radius: 0.5rem`
- Rounder screenshot look:
	- `--btn-padding-x: 1.25rem`
	- `--btn-padding-y: 0.75rem`
	- `--btn-radius: 0.625rem`

Tailwind equivalents:

- Current values are roughly:
	- `px-4`
	- `py-2`
	- `rounded-md`
- Slightly larger:
	- `px-[1.125rem]` or `px-5`
	- `py-2.5`
	- `rounded-lg`
- Larger again:
	- `px-5`
	- `py-3`
	- `rounded-[0.625rem]`

Recommendation:

- For all primary buttons together, edit the CSS tokens.
- Use Tailwind padding classes only if one specific button needs to be different.

### 3. Make the main buttons feel more solid

Edit the `.btn-primary` rule in `styles.css`.

Current shared values:

- text weight: `font-medium`
- shadow token: `--btn-shadow: 0 1px 2px rgba(2,6,23,0.06)`
- border: `none`
- focus glow token: `--btn-focus-ring: rgba(14,165,179,0.12)`

Why:

- If the UI feels washed out on matte displays, this matters almost as much as the color tokens.

Best small knobs:

- text weight
- shadow
- focus ring
- border

Plain CSS options:

- Text weight:
	- change `font-medium` to `font-semibold`
- Shadow:
	- `--btn-shadow: 0 4px 10px rgba(2,6,23,0.10)`
	- or `--btn-shadow: 0 6px 16px rgba(2,6,23,0.12)` for a more obvious screenshot look
- Border:
	- replace `border: none` with something subtle like `border: 1px solid rgba(15,23,42,0.08)`
- Focus ring:
	- slightly stronger glow, for example `rgba(14,165,179,0.18)`

Tailwind equivalents:

- `font-medium` -> `font-semibold`
- `shadow-sm` -> `shadow-md` or `shadow-lg`
- border option: `border border-slate-300/50`
- stronger focus feel: `focus:ring-4`

Important note:

- In this codebase, the direct `box-shadow` in `.btn-primary` matters more than the Tailwind `shadow-sm` utility.
- So if the goal is to deepen the shared shadow, change `--btn-shadow` first.

Recommendation:

- Best low-risk first pass:
	- `font-medium` -> `font-semibold`
	- deepen `--btn-shadow` slightly
	- leave the border alone unless the button still feels too soft

### 4. Enlarge the header icon buttons

Edit the Help and theme-toggle button classes in `index.html`.

Current classes:

- `#helpButton`: `... rounded w-8 h-8 text-sm`
- `#themeToggle`: `... w-8 h-8 p-0 text-2xl leading-none`

Current size:

- `w-8 h-8` means `2rem x 2rem`

Good first tweak:

- `w-8 h-8` -> `w-10 h-10`

Other options:

- `w-9 h-9` for a very small increase
- `w-10 h-10` for the recommended touch target improvement
- `w-11 h-11` if screenshots still look cramped

Tailwind-only examples:

- Help button:
	- `class="btn-ghost inline-flex items-center justify-center rounded w-10 h-10 text-sm"`
- Theme toggle:
	- `class="btn-ghost inline-flex items-center justify-center w-10 h-10 p-0 text-2xl leading-none"`

Optional tweak for the theme icon if it looks small after the button grows:

- keep `text-2xl`
- or try `text-[1.75rem]`

Recommendation:

- This is a good Tailwind change because it is very local and easy to read in the HTML.

### 5. Give the three main homepage actions a minimum width if needed

Apply this only if the actions still feel visually weak after token changes.

Targets in `index.html`:

- `#convertButton`
- `#downloadZip`
- `#importButton`

Current state:

- no explicit minimum width is applied
- button width is currently based on label text and padding

Why:

- This makes the action area feel more deliberate and helps screenshots look cleaner.

Tailwind options:

- `min-w-[9rem]`
- `min-w-[10rem]`
- if you want the stacked `Convert` and `Download ZIP` buttons to align neatly, give both the same `min-w-*`

Plain CSS option:

- You could add a shared rule in `styles.css`, but that would affect every `.btn-primary`.
- Because this change is usually visual and per-button, Tailwind is the cleaner choice here.

Recommendation:

- Prefer Tailwind for this one.
- Start with `min-w-[9rem]` before trying `min-w-[10rem]`.

### 6. Tune secondary button styling

Edit `.btn-ghost` in `styles.css`.

Current values:

- `px-2 py-1`
- `background: transparent`
- `border: 1px solid transparent`
- hover background: `rgba(2,6,23,0.04)`

Why:

- This is the right place if secondary controls are readable on OLED but too faint on the laptop.

Best small tweaks:

- add a visible border instead of transparent
- slightly stronger hover background
- a bit more padding

Plain CSS options:

- Border:
	- `border: 1px solid var(--border-muted)`
- Hover background:
	- change `rgba(2,6,23,0.04)` to `rgba(2,6,23,0.07)` or `rgba(2,6,23,0.08)`
- Padding:
	- change `px-2 py-1` equivalent to something closer to `px-3 py-2`

Tailwind equivalents:

- `border border-slate-200`
- `hover:bg-slate-100`
- `px-3 py-2`

Recommendation:

- If you want all ghost buttons to improve together, change `.btn-ghost` in `styles.css`.
- If you only want the Help button stronger, add Tailwind classes on that button alone.

### 7. Improve surface contrast if the page still looks washed out

Edit these tokens in `styles.css`:

- `--bg-page`
- `--bg-card`
- `--bg-soft`
- `--border-muted`

Current light values:

- `--bg-page: #f8fafc`
- `--bg-card: #ffffff`
- `--bg-soft: #f8fafc`
- `--border-muted: #e2e8f0`

Why:

- Sometimes the real issue is weak contrast between buttons and surrounding surfaces, not the button colors alone.

Suggested direction:

- keep cards a touch whiter
- make borders slightly stronger
- if needed, make soft panels slightly darker than the page so sections separate more clearly

Plain CSS options:

- Very safe contrast bump:
	- keep `--bg-card: #ffffff`
	- change `--bg-soft: #f1f5f9`
	- change `--border-muted: #cbd5e1`
- Slightly stronger overall separation:
	- `--bg-page: #f5f7fb`
	- `--bg-card: #ffffff`
	- `--bg-soft: #eef2f7`
	- `--border-muted: #cbd5e1`

Tailwind equivalents:

- `#f8fafc` is close to `bg-slate-50`
- `#ffffff` is `bg-white`
- stronger soft surface is close to `bg-slate-100`
- stronger border is close to `border-slate-300`

Recommendation:

- This is usually a second-pass tweak, not the first thing to change.
- Try the CTA and padding changes before touching the page surfaces.

### 8. Review dark mode separately

If light mode looks good but dark mode feels weak, edit the dark token set in `styles.css`:

- `--cta-bg`
- `--cta-bg-hover`
- `--cta-bg-active`
- `--btn-shadow`

Current dark values:

- `--cta-bg: #ff8a00`
- `--cta-bg-hover: #ff6a00`
- `--cta-bg-active: #e65a00`
- `--btn-shadow: 0 1px 2px rgba(0,0,0,0.6)`

Why:

- Dark-mode button contrast is controlled independently from the light theme.

Plain CSS options:

- More depth without changing hue too much:
	- `--btn-shadow: 0 4px 14px rgba(0,0,0,0.55)`
- Slightly brighter default CTA if the orange feels flat:
	- `--cta-bg: #ff950f`
	- `--cta-bg-hover: #ff7a1a`
	- `--cta-bg-active: #e85f0c`
- Slightly deeper orange if the button looks too neon:
	- `--cta-bg: #f97316`
	- `--cta-bg-hover: #ea580c`
	- `--cta-bg-active: #c2410c`

Tailwind equivalents:

- brighter orange direction: `bg-orange-500 hover:bg-orange-600 active:bg-orange-700`
- deeper orange direction: `bg-orange-600 hover:bg-orange-700 active:bg-orange-800`

Recommendation:

- Review dark mode after light mode is settled.
- It is easier to judge one theme at a time.

## Practical edit order

Use this sequence for the biggest visible improvement with the least code churn:

1. CTA colors
2. Button padding
3. Button font weight and shadow
4. Header icon size
5. Minimum width on main actions
6. Ghost button polish
7. Surface contrast
8. Dark mode review

## Current code map

### Shared button tokens and styles

In `styles.css`:

- Light CTA colors: `--cta-bg`, `--cta-bg-hover`, `--cta-bg-active`
- Button shape and spacing: `--btn-radius`, `--btn-padding-x`, `--btn-padding-y`
- Button shadow and focus: `--btn-shadow`, `--btn-focus-ring`
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

Beginner reminder:

- If you change `styles.css`, rebuild Tailwind so the generated output stays current.
- If you add new Tailwind utility classes in `index.html`, rebuild Tailwind so those utilities are emitted into `assets/tailwind-output.css`.

## Suggested next step

When implementation starts, prefer a very small first pass using only 5 edits:

1. Darken the primary CTA colors a little in `styles.css`.
2. Increase `--btn-padding-x`.
3. Increase `--btn-padding-y`.
4. Change `.btn-primary` from `font-medium` to `font-semibold`.
5. Enlarge Help/theme icon buttons from `w-8 h-8` to `w-10 h-10` in `index.html`.

## Recommended Tailwind-only tweaks worth considering

These are the most useful Tailwind changes for this page because they are local, low-risk, and easy to undo:

- Header icon buttons:
	- `w-10 h-10` on `#helpButton` and `#themeToggle`
- Main action width:
	- `min-w-[9rem]` on `#convertButton`, `#downloadZip`, and `#importButton`
- If the import area still feels small:
	- increase dropzone padding in `index.html` from `p-6` to `p-7` or `p-8`
- If the heading area feels cramped:
	- increase header container spacing from `py-6` to `py-7`

Recommendation:

- Prefer Tailwind for per-element spacing and sizing.
- Prefer `styles.css` for shared color and button-style decisions.
