<!-- markdownlint-disable MD022 MD024 MD032 -->

# Homepage Review Checklist

Use this checklist during the visual/manual review pass for the Sketch A homepage redesign.

Baseline references:
- [docs/Homepage-Implementation-Spec.md](Homepage-Implementation-Spec.md)
- [docs/Homepage-Implementation-Layout-Sketches.md](Homepage-Implementation-Layout-Sketches.md)

## Before You Start

- [x] Load the app locally and open the homepage in a browser.
- [x] Keep the browser console open for warnings or layout errors.
- [x] Review the page once with no files queued.
- [x] Review the page again after adding one valid file.
- [x] Review the page again with auto-convert turned off.
- [x] Review the page in both light and dark theme.
- [x] Review the page at desktop width and at a narrow mobile width.

## First Impression

- [x] The page feels like a focused utility, not a marketing page or settings dashboard.
- [x] The product name and one-line promise are clear quickly.
- [x] The first action is obviously `Browse files`.
- [x] `Convert queued files` is visible but clearly secondary.
- [x] The header feels compact and reassuring rather than heavy.
- [x] Help and theme controls are visible without competing with the main action.
- [x] Footer content is visible and links to documentation.

## Start Card

- [x] The start card feels like the visual anchor of the page.
- [x] Supported input is easy to understand: `.mht` and `.mhtml`.
- [x] The local-processing reassurance is easy to find near the main action.
- [x] The Browse and Convert buttons stack cleanly on mobile.
- [x] The Convert action still feels secondary when auto-convert is on.
- [x] The Convert tooltip or helper behavior is understandable when manual convert is disabled.

## Advanced Options

- [x] Advanced options remain collapsed by default.
- [x] The advanced section is available but not visually dominant.
- [x] The option groups do not distract from the primary Browse flow.
- [x] The advanced controls still look discoverable when expanded.

## Dropzone

- [x] The dropzone feels supportive rather than like a second primary CTA.
- [x] The dropzone text is short and clear.
- [x] The dropzone height feels reasonable on desktop and mobile.
- [x] The dropzone does not overpower the start card.

## Results Card

- [x] The results card is visible even when the queue is empty.
- [x] The empty state looks intentional and prepared, not broken or blank.
- [x] The results heading, badge, summary, and disabled ZIP action all make sense together.
- [x] The empty-state placeholder area has enough visual weight to read as a real panel.
- [x] The results card feels like a continuation of the workflow after a file is added.
- [x] The badge text and summary text update as queue state changes.
- [x] The ZIP action only feels relevant once output exists.
- [x] Per-file rows remain readable and do not feel cramped.
- [x] Status meaning is understandable without relying only on color.

## Desktop Layout

- [x] The page reads as a split workbench.
- [x] The left column carries setup and import.
- [x] The right column carries results and progress.
- [x] The results column does not feel detached from the main flow.
- [x] The card spacing feels consistent from top to bottom.
- [x] There is no horizontal overflow.

## Mobile Layout

- [x] The order remains correct on small screens: header, start card, advanced options, dropzone, results, footer.
- [x] No section feels unusually large or crowded on mobile.
- [x] The header wraps cleanly and stays readable.
- [x] The results card still feels stable and intentional on mobile.
- [x] The dropzone remains supportive and does not dominate the viewport.

## Theme And Contrast

- [ ] Light theme CTA contrast is strong and readable.
- [x] Dark theme CTA contrast is strong and readable.
- [x] The page does not look like a mixed-theme surface after reload.
- [x] Dark theme is reviewed by reloading with the persisted theme state, not by manually toggling classes.
- [ ] Card borders, backgrounds, and text colors feel coherent in both themes.

## Accessibility And Keyboard Flow

- [x] Help is reachable by keyboard.
- [x] Help popup closes with keyboard.
- [x] Theme toggle is reachable by keyboard.
- [x] Browse files is reachable by keyboard.
- [x] Advanced options can be focused and expanded by keyboard.
- [x] The dropzone remains usable and discoverable by keyboard.
- [x] The results area does not create a confusing focus trap.
- [x] Focus order feels natural from top to bottom.

## Behavior Checks

- [x] Adding a file updates the queue and results area correctly.
- [x] Manual convert still works when auto-convert is disabled.
- [x] ZIP download still appears in the results area when output exists.
- [x] The homepage still passes the existing smoke flow after the redesign.
- [x] Console output remains free of new warnings or errors during the review flow.

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
- Observation: In the matte LCD laptop screenshots, the Help and Theme buttons sat near the top edge of the window instead of aligning with the page title.
  Impact: The header felt slightly unbalanced and less intentional on the desktop light-theme layout.
  Suggestion: Align the header action buttons with the page-title text rather than the header top edge. Addressed on 2026-07-08 in `styles.css`.
  Severity: Polish

- Observation: In the matte LCD laptop screenshots, the collapsed Advanced options section appeared as a card nested inside another card.
  Impact: The duplicate border and padding made the section feel heavier than intended and less consistent with the surrounding cards.
  Suggestion: Keep Advanced options as a single card surface while preserving the existing collapsed/expanded details behavior. Addressed on 2026-07-08 in `styles.css`.
  Severity: Polish

- Observation: In the AMOLED phone screenshot with Advanced options expanded, the controls remain readable but the section becomes a long, dense mobile surface before users reach results.
  Impact: First-time mobile users may lose workflow context or need more scrolling than expected after opening Advanced options.
  Suggestion: Treat this as a post-review polish follow-up if it still feels heavy after the single-card Advanced options fix; possible approaches include tightening helper copy, grouping advanced controls more clearly, or reducing low-value vertical spacing on mobile.
  Severity: Polish

- Observation: In the AMOLED phone screenshot after a dark-theme reload, homepage surfaces, text, status pills, and results card separation remain readable with no obvious mixed-theme regression.
  Impact: The dark-theme mobile baseline looks usable on AMOLED for the queued-file workflow.
  Suggestion: No blocker-grade fix required from this evidence; keep monitoring CTA saturation under the existing button-color follow-up note.
  Severity: Polish

- Observation: The Browse and Convert buttons stack badly on desktop layout (`Layout A · Desktop`). The `Browse files` button is bigger than the `Convert queued files` button.
  Impact: First impression this looks unprofessional.
  Suggestion: Make the Browse and Convert buttons the same size on `Layout A · Desktop`.
  Severity: Follow-up

- Observation: The Convert button tooltip appears beneath the Start card.
  Impact: First impression this looks unprofessional.
  Suggestion: Move the Convert button tooltip to appear under the user's mouse.
  Severity: Follow-up.

- Observation: The advanced section doesn't immediately tell the user this is a collapsed section that can expand when clicked on.
  Impact: This could create delays in user interaction and negatively impact the impression of our tool.
  Suggestion: Include a visual aid for the user such as icons that represent the collapsed/expanded section state or a short text hint such as "Click to expand"/"Click to collapse".
  Severity: Follow-up.

- Observation: In the advanced section there are layout inconsistencies: Checkboxes of different sizes, dropdown menus with different fonts, text labels have different indentations.
  Impact: First-time users could consider this unprofessional and not use our PWA.
  Suggestion: We tidy up the design of the advanced section: Consistent use of fonts, consistent use of checkboxes, re-align text labels to appear consistent.
  Severity: Blocker

- Observation: When a user unchecks the advanced option for automatic conversion, the layout shifts upwards becse the following text dissapears "Files are converted automatically when added to the queue.
You can change this behaviour in Advanced options."
  Impact: Layout shifting when changing options gives a negative first impression and will be confusing to first-time users.
  Suggestion: The layout should stay static when a user changes options. Instead of hiding this text label when the user changes the auto-convert option, the text copy could change to reflect the expected conversion behaviour (such as "Add files to the queue and when you're ready, click the button "Convert queued files".)
  Severity: Blocker

- Observation: The dropzone is hard to reach when a user has expanded the advanced options section.
  Impact: If a first-time user is in a rush to use our tool, they could expand the advanced options section and forget there is a dropzone to drag'n'drop files.
  Suggestion: Move the dropzone from below the advanced options section to below the Start card.
  Severity: Polish

- Observation: For the Start card, the advanced options section and the results card, the inner border/padding is too large.
  Impact: Text labels appear cramped and the card surfaces feel less polished.
  Suggestion: Reduce the inner border/padding for the Start card, advanced options section, and results card to create a more balanced and visually appealing layout.
  Severity: Polish

- Observation: When viewed on a mobile device (Samsung S23 Ultra using Samsung Browser), the footer is too large.
  Impact: The unused space makes it hard for a first-time user to discover the link to our documentation.
  Suggestion: Reduce the height of the footer on both `Layout B · Tablet / Laptop` and `Layout C · Mobile`.
  Severity: Polish

- Observation: Testing this PWA on a laptop with a display that is anti-glare/matte type, the Light theme is not contrasty enough to distinguish seperate cards and sections and buttons.
  Impact: Users may have difficulty distinguishing different sections and buttons, leading to a poor user experience.
  Suggestion: Increase the contrast between cards, sections, and buttons in the Light theme to improve visibility.
  Severity: Follow-up

- Observation: When navigating the homepage with keyboard shortcurts in Dark theme, buttons have a gentle highlight instead of a strong highlight.
  Impact: Users may have difficulty identifying the currently focused button, leading to a poor user experience.
  Suggestion: Increase the highlight intensity for focused buttons in Dark theme to improve visibility.
  Severity: Follow-up

- Observation: Sometimes when the browser window is not in focus, the list of queued files/converted files refreshes and the user loses their work.
  Impact: Users may lose their progress and have to re-add files, leading to frustration and potential data loss.
  Suggestion: Implement a mechanism to preserve the state of the queue and converted files when the browser window is not in focus.
  Severity: Blocker

- Observation: In both the Light theme and the Dark theme, the buttons `Browse files` and `Download ZIP` have the same colour and style but the colours are too contrasty/saturated compared to the rest of the page.
  Impact: The buttons may draw too much attention and disrupt the visual hierarchy of the page.
  Suggestion: Adjust the button colours to be more harmonious with the overall page design while maintaining sufficient contrast for accessibility.
  Severity: Follow-up

- Observation: The "Help" popup shows too much text and is visually overwhelming.
  Impact: Lack of clarity in the Help section may discourage users from seeking assistance, leading to a poor user experience.
  Suggestion: Minor redesign of the "Help" popup text. Perhaps use collapsable sections (using CSS or HTML details/summary elements) to break down the information into more digestible parts.
  Severity: Follow-up.

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
