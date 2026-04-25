<!-- markdownlint-disable MD022 MD024 MD032 -->

# Homepage Implementation Layout Sketches

Status
- Implementation-ready layout options.
- Baseline source: `docs/Homepage-Wireframe-Draft.md`.
- Purpose: provide two concrete homepage layouts that can be translated into HTML and CSS with minimal ambiguity.

## How To Use This Document

Each sketch below is intentionally concrete.

Each one defines:
- section order
- desktop and mobile structure
- exact content blocks
- action hierarchy
- implementation notes for markup and styling

These are layout-ready models, not final visual design comps.

## Shared Rules

Both sketches must preserve these approved decisions:
- Browse files is the primary action.
- Auto-convert remains on by default.
- Advanced options stay collapsed by default.
- ZIP download appears only when output exists.
- Help remains available but secondary.
- Trust messaging stays close to the first action.
- The page should feel like a focused utility, not a marketing homepage.

## Sketch A: Split Workbench

This version keeps the compact two-column workbench as the main desktop pattern.

### Best fit
- Strongest choice if results should remain visible during repeated use.
- Best choice if the team wants the homepage to feel like a working tool immediately.

### Desktop layout

```text
+-----------------------------------------------------------------------------------+
| Header                                                                            |
| [OneNote HTML Cleaner] [Short promise]                    [Help] [Theme toggle]   |
+-----------------------------------------------------------------------------------+
| Left column  min 420px / ideal 56%            | Right column min 320px / 44%     |
|------------------------------------------------|----------------------------------|
| Start card                                     | Results card                     |
| - Heading                                      | - Results heading                |
| - Supporting sentence                          | - Status summary                 |
| - Supported input note                         | - File result rows               |
| - Privacy note                                 | - Per-file actions               |
| - Browse files                                 | - ZIP action when available      |
| - Convert queued files                         | - Technical details toggle       |
|------------------------------------------------|----------------------------------|
| Advanced options accordion                     |                                  |
|------------------------------------------------|                                  |
| Dropzone card                                  |                                  |
| - Drag and drop text                           |                                  |
| - Local processing reassurance                 |                                  |
+-----------------------------------------------------------------------------------+
| Footer: Docs | GitHub | Local processing reminder                                  |
+-----------------------------------------------------------------------------------+
```

### Mobile layout

```text
+---------------------------------------------------------------+
| Header                                                        |
+---------------------------------------------------------------+
| Start card                                                    |
+---------------------------------------------------------------+
| Advanced options                                              |
+---------------------------------------------------------------+
| Dropzone                                                      |
+---------------------------------------------------------------+
| Results                                                       |
+---------------------------------------------------------------+
| Footer                                                        |
+---------------------------------------------------------------+
```

### Section-by-section content

#### 1. Header
- Left side: product name and short promise.
- Right side: Help button then theme toggle.
- Keep the header height compact and single-row on desktop.

Recommended copy:
- Title: OneNote HTML Cleaner
- Promise: Convert exported OneNote pages into clean HTML locally in your browser.

#### 2. Start card
- Primary heading.
- One supporting sentence.
- Two support facts.
- One primary button.
- One visible but secondary manual convert button.

Recommended copy:
- Heading: Convert exported OneNote pages
- Supporting sentence: Add one or more MHT or MHTML files to clean and export them locally.
- Support fact 1: Supported input: .mht, .mhtml
- Support fact 2: Files stay on your device
- Primary button: Browse files
- Secondary button: Convert queued files

Implementation note:
- Primary and secondary actions should sit in one action row on desktop and stack on mobile.

#### 3. Advanced options
- Use one accordion surface.
- Keep the closed state short and quiet.
- Group settings using the existing option families already present in the app.

Closed-state label:
- Advanced options

Closed-state helper text:
- Optional settings for export behavior and output format

#### 4. Dropzone
- Keep this as a separate card below advanced options.
- Do not visually compete with the primary Browse files button.

Recommended copy:
- Heading: Drag and drop files
- Supporting line: Drop exported OneNote pages here to start conversion
- Support note: Local browser processing only

#### 5. Results card
- Keep this visible on desktop even when empty.
- Empty state should look prepared, not blank.

Empty-state copy:
- Heading: Conversion results
- Body: Added files will appear here with progress, status, and downloads

Filled-state blocks:
- status summary row
- file result list
- ZIP action row when output exists
- technical details toggle

#### 6. Footer
- Keep minimal.
- Use it for provenance and support links, not primary guidance.

### Implementation notes
- Use a page wrapper with a max width rather than full-bleed content.
- Desktop should switch to a two-column grid only after the start card and results card both have comfortable minimum widths.
- Results should stay pinned to the right column on desktop, not fall below the fold unless the viewport is narrow.
- The start card is the visual anchor of the page, not the dropzone.

### Strengths
- Strongest persistent results visibility.
- Closest to the approved draft, so lowest decision risk.
- Best for a utility-workbench feel.

### Risks
- Can feel slightly denser for first-time users if the empty results card is too visually heavy.

## Sketch B: Guided Flow

This version keeps the same approved content but makes the start path more linear and calm.

### Best fit
- Strongest choice if the team wants the clearest first-time flow.
- Best choice if reducing visual density matters more than persistent desktop parallelism.

### Desktop layout

```text
+-----------------------------------------------------------------------------------+
| Header                                                                            |
| [OneNote HTML Cleaner] [Short promise]                    [Help] [Theme toggle]   |
+-----------------------------------------------------------------------------------+
| Main flow column  min 640px / ideal 62%       | Side rail min 280px / 38%         |
|------------------------------------------------|----------------------------------|
| Start card                                     | Trust / support card              |
| - Heading                                      | - Local processing                |
| - Supporting sentence                          | - Supported input                 |
| - Browse files                                 | - Auto-convert default            |
| - Convert queued files                         | - Link to help                    |
|------------------------------------------------|----------------------------------|
| Advanced options accordion                     | Results summary card              |
|------------------------------------------------| - Empty or active summary         |
| Dropzone card                                  | - ZIP appears when ready          |
|------------------------------------------------|----------------------------------|
| Results list card                              |                                  |
| - File rows                                    |                                  |
| - Technical details toggle                     |                                  |
+-----------------------------------------------------------------------------------+
| Footer                                                                            |
+-----------------------------------------------------------------------------------+
```

### Mobile layout

```text
+---------------------------------------------------------------+
| Header                                                        |
+---------------------------------------------------------------+
| Start card                                                    |
+---------------------------------------------------------------+
| Trust / support card                                          |
+---------------------------------------------------------------+
| Advanced options                                              |
+---------------------------------------------------------------+
| Dropzone                                                      |
+---------------------------------------------------------------+
| Results summary                                               |
+---------------------------------------------------------------+
| Results list                                                  |
+---------------------------------------------------------------+
| Footer                                                        |
+---------------------------------------------------------------+
```

### Section-by-section content

#### 1. Header
- Same structure and copy as Sketch A.
- Keep it compact and non-promotional.

#### 2. Start card
- Same main heading as Sketch A.
- Move support facts out of the card so the primary action area feels lighter.

Recommended copy:
- Heading: Convert exported OneNote pages
- Supporting sentence: Add MHT or MHTML files and export clean HTML locally.
- Primary button: Browse files
- Secondary button: Convert queued files

#### 3. Trust / support card
- Place immediately beside the start card on desktop.
- Place directly below the start card on mobile.
- Use short checklist-style reassurance.

Recommended content:
- Files stay on your device
- Supports .mht and .mhtml
- Auto-convert is on by default
- Need details? Open Help

#### 4. Advanced options
- Same structure as Sketch A.

#### 5. Dropzone
- Same structure as Sketch A.

#### 6. Results summary card
- Separate from the full results list.
- Use it to show queue count, converting count, success count, and ZIP availability.

Empty-state copy:
- Heading: Results summary
- Body: Conversion status will appear here after files are added

#### 7. Results list card
- Keep it below the dropzone in the main flow column.
- This lets the user move down the page in a simple sequence.

### Implementation notes
- The side rail should be quieter than the main flow column.
- The results summary must not duplicate the full results list word-for-word.
- On desktop, the start card and trust card should align to the same top edge.
- On mobile, trust should appear before advanced options so reassurance stays near the first action.

### Strengths
- Calmest first-time flow.
- Strongest separation between action, reassurance, and results.
- Better if the team wants the homepage to feel simpler at first glance.

### Risks
- Results become less immediately prominent on desktop than in Sketch A.
- More section transitions may slightly lengthen the page.

## Recommendation

If the goal is the safest implementation path, choose Sketch A.

Reason:
- It stays closest to the approved wireframe draft.
- It preserves strong desktop results visibility.
- It maps cleanly onto the current workbench-style behavior already present in the app.

If the goal is the calmest possible first-time experience, choose Sketch B.

## Decision Shortcut

Choose Sketch A if these matter most:
- keeping results visible during work
- minimizing redesign risk
- preserving a compact utility feel

Choose Sketch B if these matter most:
- reducing perceived density
- making the first action path feel more guided
- separating trust messaging from the main action card

## Suggested Next Step

Pick one sketch as the primary implementation target.

After that, the next document should be a section-by-section implementation spec covering:
- exact block order in `index.html`
- semantic container structure
- component-level class responsibilities
- desktop and mobile breakpoint behavior
- which current UI controls map into each section

<!-- markdownlint-enable MD022 MD024 MD032 -->