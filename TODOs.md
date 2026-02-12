# TODOs

## Highest priority (native fidelity)
- [ ] Replace heuristic `.one` text extraction with a structured parser that preserves page layout semantics (headings, lists, tables, whitespace, section boundaries).
- [ ] Add extraction support for embedded resources from native payloads (images, attachments, object placeholders) and map them into exported HTML.
- [ ] Preserve page metadata (title, created/modified timestamps, author fields where available) and render it consistently in output HTML.
- [ ] Improve HTML output templating for native pages so structure and spacing are represented instead of flat preview lists.

## `.onepkg` deep extraction
- [ ] Add proper in-app decode path for compressed CAB folders (LZX/MSZIP) so `.onepkg` extraction is not limited to placeholders.
- [ ] Expand section extraction to parse full page trees from extracted `.one` binaries, including nested groups/sections/pages.
- [ ] Keep browser fallback UX for unsupported compression, but include clearer post-extract import guidance and verification steps.

## Quality + validation
- [ ] Add regression fixtures for `Tests/Test Section.one` and `Tests/Test Notebook.onepkg` that check for minimum content fidelity (tables/images/metadata markers).
- [ ] Add smoke checks for native output in `Tests/Cleaned` to ensure links, ZIP export, and hierarchy rendering remain stable.
- [ ] Define acceptance criteria for “content fidelity” (structure, tables, images, whitespace, metadata) and use it as a release gate for native parsing.

## Product/docs follow-up
- [ ] Document current native limitations and expected fidelity in README/docs to set realistic user expectations until parser work lands.
- [ ] Decide tomorrow whether to prioritize in-browser decoder integration or a hybrid companion-tool workflow for compressed notebooks.
