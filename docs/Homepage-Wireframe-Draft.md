<!-- markdownlint-disable MD022 MD024 MD032 -->

# Homepage Wireframe Draft

Status
- Draft wireframe for UI and UX testing.
- Baseline source: `docs/Homepage-Specification-Approved.md`.
- Purpose: turn the approved homepage direction into a concrete section model before visual polish or code changes.

## Purpose

This document defines the first homepage wireframe pass for OneNote HTML Cleaner.

The wireframe is intended to answer three questions:
- What is the section order?
- What is the visual and interaction hierarchy?
- What should a first-time user see, understand, and do first?

This is a layout and content structure draft, not implementation code.

## Wireframe Goals

The homepage should feel like a compact workbench built for quick first success.

The wireframe should:
- prioritize one-off and occasional users
- keep auto-convert as the default behavior
- keep Advanced options collapsed by default
- make import the primary action
- keep results and ZIP download contextual to the output stage
- make trust signals visible near the main action
- keep the help path available without overloading the main screen

## Out Of Scope For This Draft

This wireframe draft is not intended to settle:
- final visual styling tokens
- final typography choices
- final iconography
- animation or motion details
- implementation-level HTML, CSS, or JavaScript decisions
- secondary feature expansion beyond the approved homepage baseline

Keeping these items out of scope will help the wireframe stay focused on hierarchy, flow, and testing intent.

## Information Hierarchy

Approved hierarchy for the homepage:

1. Product identity and trust.
2. Primary conversion action.
3. Optional settings.
4. Results and download actions.
5. Support and provenance.

The homepage should not feel like a settings dashboard. It should feel like a focused utility with a clear first action.

## Desktop Layout Model

The desktop wireframe uses a compact two-column workbench layout.

### Left Column
- Header summary and product promise at the top.
- Main import/start card immediately below.
- Advanced options below the main card, collapsed by default.
- Dropzone area below the settings card.

### Right Column
- Conversion results panel.
- Per-file output rows.
- ZIP download action when output exists.
- Optional technical details in a collapsed subsection.

### Page Order
- Header spans full width.
- Main content uses a two-column layout below the header.
- Footer spans full width at the bottom.

### Wireframe Sketch

```text
+------------------------------------------------------------------+
| Header: title | short promise | Help | Theme                      |
+------------------------------------------------------------------+
| Left column                         | Right column                |
|-------------------------------------|-----------------------------|
| Main start card                     | Conversion results          |
| - outcome heading                   | - status summary            |
| - supported input                   | - per-file rows             |
| - privacy note                      | - per-file downloads        |
| - Browse files                      | - ZIP download when ready   |
| - manual Convert (de-emphasized)    | - technical details toggle  |
|-------------------------------------|-----------------------------|
| Advanced options (collapsed)        |                             |
| - conversion behavior               |                             |
| - output format                     |                             |
| - export packaging                  |                             |
| - exported-page enhancements        |                             |
| - experimental features             |                             |
|-------------------------------------|-----------------------------|
| Dropzone                            |                             |
| - drag and drop                     |                             |
| - local processing reassurance      |                             |
+------------------------------------------------------------------+
| Footer: docs | GitHub | local processing reminder                |
+------------------------------------------------------------------+
```

## Mobile Layout Model

The mobile wireframe should preserve the same hierarchy while collapsing the workbench into a single-column flow.

### Mobile section order
- Header.
- Main start card.
- Advanced options.
- Dropzone.
- Results panel.
- Footer.

### Mobile priorities
- Keep the primary import action above the fold when practical.
- Avoid side-by-side action groups where vertical stacking is clearer.
- Keep the de-emphasized manual Convert action visibly secondary to Browse files.
- Make the results area feel like a continuation of the action flow, not a detached second page.

### Mobile wireframe sketch

```text
+---------------------------------------------------+
| Header: title | Help | Theme                      |
+---------------------------------------------------+
| Main start card                                   |
| - outcome heading                                 |
| - supported input                                 |
| - privacy note                                    |
| - Browse files                                    |
| - manual Convert (secondary/de-emphasized)        |
+---------------------------------------------------+
| Advanced options (collapsed)                      |
+---------------------------------------------------+
| Dropzone                                          |
| - drag and drop                                   |
| - local processing reassurance                    |
+---------------------------------------------------+
| Results                                           |
| - status summary                                  |
| - per-file rows                                   |
| - ZIP download when ready                         |
+---------------------------------------------------+
| Footer                                            |
+---------------------------------------------------+
```

### Mobile testing question
- Does the page still feel calm and obvious when every major surface is stacked vertically?

## Header Wireframe

The header should be compact and informative.

### Content
- Product name.
- One-sentence promise.
- Help control.
- Theme toggle.

### Approved intent
- The header should reassure, not sell.
- It should communicate that the app is safe, local, and intentionally scoped.
- The help control should be clearly labeled and feel finished.

### Header copy direction
- Title: OneNote HTML Cleaner.
- Promise: Convert exported OneNote pages into clean HTML using local browser processing.
- Trust strip: Local processing, MHT/MHTML supported, auto-convert on by default.

### Header copy budget
- One headline.
- One short supporting sentence.
- A compact trust strip only if it improves clarity.
- No long explanatory paragraph in the header.

## Main Start Card Wireframe

The main start card is the primary homepage action surface.

### Content order
1. Outcome-oriented heading.
2. Short supporting sentence.
3. Supported input note.
4. Privacy note.
5. Primary Browse files action.
6. Manual Convert action, visible but de-emphasized when auto-convert is on.

### Approved behavior
- The primary browse/import action should be the most visually prominent control.
- Supported input should be stated directly in the card.
- The privacy note should be close to the action, not buried in the footer.
- The manual Convert control should not compete with import when auto-convert is active.

### Recommended copy baseline
- Heading: Convert exported OneNote pages.
- Supporting sentence: Add one or more MHTML files to clean and export them locally in your browser.
- Supported input: .mht and .mhtml.
- Privacy note: Files stay on your device.
- Main action: Browse files.
- Secondary action: Convert queued files.

### Start card copy budget
- One clear heading.
- One short supporting sentence.
- Up to two short support notes.
- Avoid turning the card into a documentation block.

## Advanced Options Wireframe

Advanced options should remain collapsed by default.

### Section structure
- Conversion behavior.
- Export packaging.
- Output format.
- Exported page enhancements.
- Experimental features.

### Approved intent
- Stable options should appear before more experimental controls.
- The section should remain optional and non-blocking.
- Short helper text is acceptable, but the main homepage should stay lightweight.

### Suggested group content

#### Conversion behavior
- Auto-convert when files are added.
- Helper text explaining that this is recommended for most users.

#### Export packaging
- Externalize CSS to separate files.
- External CSS mode selector.

#### Output format
- Experimental export formats toggle.
- Export format selector.
- Markdown flavor selector.

#### Exported page enhancements
- Theme toggle for exported HTML pages.
- OLED black option.
- Toolbar for exported HTML pages.

#### Experimental features
- A short warning that stable HTML remains the default.
- The experimental tier should remain visually secondary.

## Dropzone Wireframe

The dropzone should remain available as an alternate way to add files.

### Content
- Short drag-and-drop prompt.
- Browse files button or clear pointer to the primary browse action.
- Local processing reassurance.

### Approved intent
- The dropzone should feel calm and trustworthy.
- It should not compete with the main start card.
- It should support the main action rather than duplicate it.

### Copy baseline
- Drag files here or use the Browse files button above.
- Files are processed locally in your browser. Nothing is uploaded.

## Help Modal Wireframe

The Help modal should remain available as the deeper-detail support surface.

### Content
- What the tool does.
- Supported file types.
- Local processing and privacy reassurance.
- When ZIP download is useful.
- Short note on advanced and experimental features.
- Link to GitHub or project documentation.

### Approved intent
- The modal should provide deeper guidance without becoming required reading before first use.
- The modal should be scannable, not paragraph-heavy.
- The homepage itself should carry the critical trust and action guidance, with the modal acting as backup detail.

### Help modal rule
- If information is required for a successful first conversion, it belongs on the homepage.
- If information is useful but secondary, it may live in the modal.

### Help modal copy budget
- Use short grouped sections instead of long uninterrupted paragraphs.
- Prefer scanning and quick lookup over narrative explanation.

## Results Wireframe

The results area should feel like the natural follow-through after import.

### Content
- Results heading.
- Short status summary.
- Per-file rows.
- Single-file download actions.
- ZIP download action when output exists.
- Optional technical details subsection.

### Approved intent
- Results should be clear and calm.
- ZIP download should be contextual to output.
- Diagnostics should not dominate the normal workflow.

### Row content
Each file row should show:
- file name.
- status label.
- file-specific download action when available.
- concise error or unsupported message when needed.

## Footer Wireframe

The footer should be quiet and supportive.

### Content
- Local processing reminder.
- Documentation link.
- GitHub link.

### Approved intent
- Reinforce trust without adding friction.
- Provide a clear path to more detail for users who need it.

## Empty State Wireframe

The empty state should not feel broken or incomplete.

### When no files are present
- Show the main start card.
- Show the dropzone.
- Keep results hidden or show a very light empty-state panel, depending on which version feels clearer during testing.
- Keep Advanced options collapsed.

### Empty state message
- No files are in the queue yet.
- Add files to begin conversion.

## Conversion State Wireframe

When a file is added, the UI should make progress obvious.

### States to support
- queued.
- converting.
- success.
- unsupported.
- error.

### Approved intent
- Status labels should be short and clear.
- Color may help, but text must remain understandable on its own.
- The user should always know what happened to each file.

### Unsupported file behavior
- Unsupported files should remain visible in results with a clear explanation.
- The unsupported state should feel deliberate and informative, not like a broken conversion attempt.
- The message should reinforce the current supported input without implying silent failure.

## Manual Convert Behavior

Manual Convert stays visible but de-emphasized when auto-convert is on.

### Wireframe rule
- The control should not look like a second primary action during normal first-time use.
- A tooltip or helper explanation should clarify why it is disabled or inactive when auto-convert is enabled.

## Trust Signals To Verify In UI Testing

The wireframe should keep these trust signals visible:
- Files stay on your device.
- Supported input is MHT/MHTML.
- Auto-convert is on by default.
- Help is available.
- The stable HTML path is the default.

## Accessibility And Responsive Verification

The wireframe should also be checked against a small structural verification list.

### Accessibility checks
- Primary actions are understandable from labels alone.
- Status meaning is understandable without relying only on color.
- Help and theme controls remain clearly focusable and discoverable.
- Optional and experimental controls do not visually overpower the stable path.

### Responsive checks
- Desktop keeps a clear two-column workbench layout.
- Mobile preserves the same hierarchy without crowding the first action.
- The stacked mobile layout still makes results feel contextual rather than separate.
- Trust and support notes remain visible without overwhelming the page on smaller screens.

## UX Testing Questions

This wireframe should be tested against these questions:
- Can a first-time user understand what the tool does within a few seconds?
- Can the user tell what file type is supported?
- Is the primary action obvious?
- Does auto-convert feel expected rather than confusing?
- Does the page still feel calm when advanced settings are visible?
- Is ZIP download clearly a follow-through action rather than an initial task?
- Does the layout feel like a focused utility rather than a settings dashboard?

## Variants To Test

The wireframe includes a few choices that are better validated through lightweight comparison rather than assumed in advance.

### Variant 1: Results empty state
- Option A: keep results hidden until files are added.
- Option B: show a lightweight prepared empty-state panel from the start.
- Test question: which version feels calmer while still making the workflow obvious?

### Variant 2: Dropzone emphasis
- Option A: dropzone includes its own Browse files button.
- Option B: dropzone points to the main Browse files action and acts as a drag-and-drop surface only.
- Test question: which version gives the clearest action hierarchy without feeling redundant?

### Variant 3: Trust-strip placement
- Option A: trust strip in header.
- Option B: trust strip in the main start card.
- Option C: a very light trust presence in both places.
- Test question: which version feels most credible without creating repetition?

### Variant 4: ZIP visibility
- Option A: ZIP action appears only in the results panel when output exists.
- Option B: ZIP action has a placeholder location in results even before output exists.
- Test question: which version best reinforces ZIP as a contextual action?

## Next Step

If this wireframe draft is accepted, the next step is to turn it into a more exact homepage wireframe model with section-by-section variations for desktop and mobile testing.

<!-- markdownlint-enable MD022 MD024 MD032 -->
