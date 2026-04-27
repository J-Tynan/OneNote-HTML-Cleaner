<!-- markdownlint-disable MD022 MD024 MD032 -->

# Homepage Review Checklist

Use this checklist during the visual/manual review pass for the Sketch A homepage redesign.

Baseline references:
- [docs/Homepage-Implementation-Spec.md](Homepage-Implementation-Spec.md)
- [docs/Homepage-Implementation-Layout-Sketches.md](Homepage-Implementation-Layout-Sketches.md)

## Before You Start

- [ ] Load the app locally and open the homepage in a browser.
- [ ] Keep the browser console open for warnings or layout errors.
- [ ] Review the page once with no files queued.
- [ ] Review the page again after adding one valid file.
- [ ] Review the page again with auto-convert turned off.
- [ ] Review the page in both light and dark theme.
- [ ] Review the page at desktop width and at a narrow mobile width.

## First Impression

- [ ] The page feels like a focused utility, not a marketing page or settings dashboard.
- [ ] The product name and one-line promise are clear quickly.
- [ ] The first action is obviously `Browse files`.
- [ ] `Convert queued files` is visible but clearly secondary.
- [ ] The header feels compact and reassuring rather than heavy.
- [ ] Help and theme controls are visible without competing with the main action.

## Start Card

- [ ] The start card feels like the visual anchor of the page.
- [ ] Supported input is easy to understand: `.mht` and `.mhtml`.
- [ ] The local-processing reassurance is easy to find near the main action.
- [ ] The Browse and Convert buttons stack cleanly on mobile.
- [ ] The Convert action still feels secondary when auto-convert is on.
- [ ] The Convert tooltip or helper behavior is understandable when manual convert is disabled.

## Advanced Options

- [ ] Advanced options remain collapsed by default.
- [ ] The advanced section is available but not visually dominant.
- [ ] The option groups do not distract from the primary Browse flow.
- [ ] The advanced controls still look discoverable when expanded.

## Dropzone

- [ ] The dropzone feels supportive rather than like a second primary CTA.
- [ ] The dropzone text is short and clear.
- [ ] The dropzone height feels reasonable on desktop and mobile.
- [ ] The dropzone does not overpower the start card.

## Results Card

- [ ] The results card is visible even when the queue is empty.
- [ ] The empty state looks intentional and prepared, not broken or blank.
- [ ] The results heading, badge, summary, and disabled ZIP action all make sense together.
- [ ] The empty-state placeholder area has enough visual weight to read as a real panel.
- [ ] The results card feels like a continuation of the workflow after a file is added.
- [ ] The badge text and summary text update as queue state changes.
- [ ] The ZIP action only feels relevant once output exists.
- [ ] Per-file rows remain readable and do not feel cramped.
- [ ] Status meaning is understandable without relying only on color.

## Desktop Layout

- [ ] The page reads as a split workbench.
- [ ] The left column carries setup and import.
- [ ] The right column carries results and progress.
- [ ] The results column does not feel detached from the main flow.
- [ ] The card spacing feels consistent from top to bottom.
- [ ] There is no horizontal overflow.

## Mobile Layout

- [ ] The order remains correct on small screens: header, start card, advanced options, dropzone, results, footer.
- [ ] No section feels unusually large or crowded on mobile.
- [ ] The header wraps cleanly and stays readable.
- [ ] The results card still feels stable and intentional on mobile.
- [ ] The dropzone remains supportive and does not dominate the viewport.

## Theme And Contrast

- [ ] Light theme CTA contrast is strong and readable.
- [ ] Dark theme CTA contrast is strong and readable.
- [ ] The page does not look like a mixed-theme surface after reload.
- [ ] Dark theme is reviewed by reloading with the persisted theme state, not by manually toggling classes.
- [ ] Card borders, backgrounds, and text colors feel coherent in both themes.

## Accessibility And Keyboard Flow

- [ ] Help is reachable by keyboard.
- [ ] Theme toggle is reachable by keyboard.
- [ ] Browse files is reachable by keyboard.
- [ ] Advanced options can be focused and expanded by keyboard.
- [ ] The dropzone remains usable and discoverable by keyboard.
- [ ] The results area does not create a confusing focus trap.
- [ ] Focus order feels natural from top to bottom.

## Behavior Checks

- [ ] Adding a file updates the queue and results area correctly.
- [ ] Manual convert still works when auto-convert is disabled.
- [ ] ZIP download still appears in the results area when output exists.
- [ ] The homepage still passes the existing smoke flow after the redesign.
- [ ] Console output remains free of new warnings or errors during the review flow.

## Blockers

- [ ] The primary action is not visually dominant.
- [ ] The empty results state feels broken or unfinished.
- [ ] Mobile ordering is incorrect or cramped.
- [ ] Keyboard access is broken.
- [ ] Dark theme surfaces look inconsistent after reload.
- [ ] Any homepage control stopped working during the redesign.

## Notes

- Pass with notes is acceptable for small spacing or copy refinements if the page still meets the approved implementation intent.
- Treat any blocker above as a follow-up issue before merge.

## Note Template

Use this shorthand when recording review notes:

Observation -> Impact -> Suggestion

Optional severity labels:
- Blocker
- Follow-up
- Polish

### Short Note Format

- Observation:
- Impact:
- Suggestion:
- Severity:

### Example Notes

- Observation: The light theme palette feels too muted and the start card blends into the page.
  Impact: The homepage feels flatter than intended and the primary action loses emphasis.
  Suggestion: Increase contrast between the page background and the key card surfaces, especially around the start card.
  Severity: Polish

- Observation: The primary button does not stand out enough compared with nearby controls.
  Impact: First-time users may not immediately identify the main action.
  Suggestion: Strengthen CTA contrast, size, or visual separation from secondary actions.
  Severity: Follow-up

- Observation: The empty results state still feels visually unfinished on mobile.
  Impact: The results area can read as inactive or broken before files are added.
  Suggestion: Increase empty-state framing and improve spacing in the results card at small widths.
  Severity: Follow-up

- Observation: Dark theme card surfaces look slightly inconsistent after reload.
  Impact: The page feels less polished and could reduce trust.
  Suggestion: Recheck dark theme token consistency across header, start card, and results card.
  Severity: Blocker

### Reviewer Note Rules

- Keep notes short and factual.
- Describe what you saw before suggesting a fix.
- Prefer one issue per note.
- Mark something as Blocker only if it should stop merge or further rollout.
- Use Polish for minor visual improvements that do not block approval.

<!-- markdownlint-enable MD022 MD024 MD032 -->