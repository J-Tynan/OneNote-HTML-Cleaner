# v0.2 Before / After Comparison Notes

Use this note set when describing the same OneNote page in two states: the default OneNote `.mht` / `.mhtml` export opened directly in the browser, and the cleaned HTML output produced by this app.

Keep the comparison factual. The goal is to show the difference in readability and browser behavior without overstating the product or inventing claims that the screenshots do not support.

## Reusable Note Set

- Before: Opening the default OneNote export directly in the browser can surface compatibility warnings, slower load behavior, and a harder-to-read page shaped by authoring markup and layout scaffolding rather than normal web content.
- After: The cleaned HTML output removes much of that noise, restores clearer headings, lists, tables, and images, and behaves more like a normal standalone HTML page in the browser.
- Why it matters: The difference is not only visual. The cleaned result is easier to read, inspect, reuse, and share without asking the reader to work around the friction of the raw export.

## Usage Guardrails

- Reuse this note set only for comparisons backed by the existing before/after screenshots in `assets/release/`.
- Keep references to dark-mode-friendly viewing optional, not default, because the converted-page theme toggle remains opt-in.
- Do not broaden the claim into native `.one` support, `.docx` export, or a general browser-compatibility guarantee.

## Source Of Truth

- `README.md` contains the fuller before/after explanation and the paired screenshots.
- `RELEASE_NOTES.md` contains the release-facing scope and known-limitations wording that this note set should stay aligned with.
- `docs/Release-Screenshot-Shot-List.md` contains the caption and alt-text wording that should remain consistent with any public reuse of this comparison.