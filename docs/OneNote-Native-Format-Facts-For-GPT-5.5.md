# OneNote Native Format Facts for GPT-5.5

This document is source material for drafting the `v1.0` native support contract. It is intentionally narrower than a design spec. It separates facts from the Microsoft `.one` format specification from repo-derived facts about `.onepkg` packaging.

## Source scope

- Primary format source: [docs/OneNote File Format.docx](docs/OneNote%20File%20Format.docx)
- Current repo-native context: [docs/Architecture.md](docs/Architecture.md), [docs/Contracts.md](docs/Contracts.md)
- Current `.onepkg` extraction references: [tools/Extract-OnePkg.ps1](tools/Extract-OnePkg.ps1), [src/importers/onepkg.js](src/importers/onepkg.js)

## Hard facts from the Microsoft `.one` spec

### Format scope

- The Microsoft document is `[MS-ONE]: OneNote File Format`.
- It describes a persistence format for digital notes stored as hierarchical sets of sections and pages.
- In the extracted text reviewed here, the document does not directly mention `.onepkg`.
- The spec treats `.one` as a OneNote revision store file.

### Core hierarchy

- A section is a container for pages, metadata, and properties, and maps to a `.one` file.
- A notebook is a collection of section files stored in the same directory.
- Notebook structure is defined by a table-of-contents file with the `.onetoc2` extension.
- A page is a container for user-defined content including text, lists, tables, page titles, images, and note tags.
- Pages can participate in a hierarchical page-series model where subpages are attached beneath a top-level page.

### Content model

- Most page content lives inside outlines.
- An outline is a container for text, lists, tables, and images.
- Outlines can appear anywhere on a page and can overlap with other outlines.
- A page is not required to contain outlines, and some content can be placed directly on the page.
- The spec models content as properties, property sets, and file data objects.
- File data objects can contain pictures, embedded files, or audio/video content.

### Page and title details

- A page title is optional.
- If present, a title can include title text plus optional date and time metadata.
- Pages expose metadata and layout properties including read-only state, conflict-page state, and right-to-left layout.

### Layout implications

- The native model is layout-aware, not purely linear.
- Outlines can overlap and can be positioned freely on the page.
- The page model includes explicit page-size and margin concepts.
- The page model includes a `LayoutResolveChildCollisions` property, and the spec says this value must be set to `true`.
- Right-to-left page layout is explicitly modeled through `EditRootRTL`.

### Lists, tables, images, links, and tags

- Lists have dedicated native structures for numbered and bulleted list items.
- Tables have dedicated native structures with explicit row and column counts.
- Images have dedicated native structures.
- Images can carry optional alternative text.
- Objects can carry hyperlink strings.
- Note tags are first-class native data, not just presentation glyphs.
- A note tag can be associated with a paragraph or other object on a page.
- The spec distinguishes normal note tags from task tags.
- Normal note tags have labels; task tags are tied to due-date semantics and constrained shape values.

### Embedded files and sidecar storage

- Inserted file data can be stored either internally in the `.one` file or externally in a sibling `onefiles` folder.
- The `onefiles` folder name is derived from the section file name, for example `section.one` -> `section_onefiles`.
- Embedded-file metadata can include the embedded file name and the original source file path.
- Embedded files can be positioned directly on a page or contained within an outline element.

### Audio and video

- The native format explicitly models audio/video as embedded-file content.
- The spec includes `AudioRecordingGuid`, `AudioRecordingDuration`, and `IRecordMedia` fields.
- `AudioRecordingGuid` must be set for these listed file extensions: `.wma`, `.mp3`, `.wav`, `.wmv`, `.avi`, `.mpg`.
- The presence of these structures means the format can represent embedded media; it does not by itself mean your `v1.0` release should claim full multimedia support.

### Conflict and history structures

- The format includes conflict objects and conflict pages.
- A conflict object is generated when multiple users change a structure and those changes are saved and synchronized.
- The format also includes version-history pages and version-history object spaces.
- These are strong signals that not all pages in a `.one` file represent simple end-user page content.

### Versioning behavior

- The spec describes explicit schema-version fields for read and write.
- In the reviewed text, both `SchemaRevisionInOrderToRead` and `SchemaRevisionInOrderToWrite` are specified as `0x00000028`.
- The spec states that implementations encountering other schemas will ignore and not change the data defined by those schemas.

## Repo-derived facts about `.onepkg`

These points are not taken from the Microsoft `.one` format document above. They come from current repo code and tooling and should be labeled accordingly when fed to GPT-5.5.

- The repo currently treats `.onepkg` as a notebook package format, not as the same thing as a raw `.one` section file.
- [docs/Contracts.md](docs/Contracts.md) describes `.onepkg` as a OneNote notebook package and labels it a CAB container in the deferred worker contract.
- [tools/Extract-OnePkg.ps1](tools/Extract-OnePkg.ps1) accepts `.onepkg`, uses `expand.exe`, and extracts `.one` section files plus `.onetoc2` files.
- [src/importers/onepkg.js](src/importers/onepkg.js) validates an `MSCF` CAB signature and parses CAB folder and file tables.
- The current importer code treats `.onepkg` as something that may need package extraction before `.one`-level content handling can happen.
- The repo already assumes `.onepkg` can expose notebook hierarchy and section membership.
- The repo contains placeholder and deferred logic for section-level extraction and hierarchy handling, which implies `.onepkg` support is materially different from direct `.one` support.

## Facts that should constrain the support contract

- `.one` is not a simple linear rich-text format. Its native model includes positioned outlines, overlapping content regions, subpages, embedded files, note tags, conflict data, and version-history data.
- A safe `v1.0` contract should distinguish semantic preservation from layout-perfect reproduction.
- Notebook support is not the same as section support. The notebook concept depends on multiple files and a `.onetoc2` table of contents.
- `.onepkg` should be treated as a packaging and extraction problem on top of the underlying `.one` parsing problem.
- Multimedia exists in the format and should not be treated as hypothetical.
- Embedded file content may live outside the main `.one` file in a sibling `onefiles` directory, which affects portability, extraction, and partial-failure behavior.
- Because outlines can overlap and some content can live directly on the page, layout flattening is likely to be a deliberate product tradeoff, not just an implementation bug.
- Conflict pages and version-history objects are likely exclusion candidates unless you explicitly define them as supported.
- Right-to-left layout exists natively and should be either tested or explicitly excluded.

## Known evidence gaps

- The reviewed Microsoft document gives strong facts for `.one`, but it does not directly document `.onepkg` in the extracted text reviewed for this brief.
- This brief does not establish a Microsoft-spec source for password protection or encryption behavior.
- This brief does not establish a Microsoft-spec source for vector-ink fidelity guarantees.
- This brief does not establish a release-ready claim for full multimedia rendering, only that the format models embedded audio/video.
- This brief does not prove that every `.onepkg` encountered in the wild will extract cleanly through the same CAB path.

## Suggested factual input block for GPT-5.5

Use or adapt the following block when asking GPT-5.5 to draft the support contract:

- The Microsoft `[MS-ONE]` spec reviewed here is a `.one` revision-store format source, not a full `.onepkg` spec.
- `.one` is a section file format with pages, subpages, outlines, outline elements, properties/property sets, and file data objects.
- Pages can contain text, lists, tables, page titles, images, note tags, and other content.
- Most content is in outlines, but some content can live directly on the page.
- Outlines can overlap and can appear anywhere on the page.
- Notebook structure depends on multiple section files plus a `.onetoc2` table-of-contents file.
- Inserted file data can live internally or in a sibling `onefiles` folder.
- Embedded files can include metadata like original file name and source path.
- The format explicitly models audio/video-related embedded content.
- The format includes conflict objects/pages and version-history structures.
- `.onepkg` should be treated as a separate packaging/extraction layer around notebook content, with support claims based on extraction evidence rather than assumed parity with `.one`.
- The support contract should prefer a narrow, testable release claim over broad format completeness.

## Practical recommendation for the contract draft

- Use the Microsoft spec as the factual basis for `.one` structure and content categories.
- Treat `.onepkg` claims as narrower unless you have fixture-backed evidence for extraction, hierarchy handling, and section/page conversion behavior.
- Make unsupported or partially supported cases explicit for conflict pages, version history, complex overlapping layout, embedded files, right-to-left pages, and multimedia.
- Require representative fixtures for notebook TOC handling, subpages, overlapping outlines, embedded files, media-bearing pages, and sidecar `onefiles` cases before claiming broad native support.