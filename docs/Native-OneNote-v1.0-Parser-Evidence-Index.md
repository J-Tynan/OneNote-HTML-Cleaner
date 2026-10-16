# Native OneNote v1.0 Parser Evidence Index

## Purpose

This index records which native `.one` concepts are supported by the local
Microsoft format source and which implementation claims remain unproven. It
keeps the native importer from treating string recovery or guessed byte
patterns as format parsing.

Primary source: [OneNote File Format.docx](OneNote%20File%20Format.docx).
Supporting summary: [OneNote-Native-Format-Facts-For-GPT-5.5.md](OneNote-Native-Format-Facts-For-GPT-5.5.md).

## Evidence Status

| Native concept | Source evidence | Implementation status | v1.0 treatment |
| --- | --- | --- | --- |
| Section signature | The documented OneNote section signature occupies the first 16 bytes of a `.one` file. | `src/importers/one/section-header.js` reads exactly those 16 bytes through the bounded `BinaryReader`; `Tests/native-one-binary-reader.unit.js` and `Tests/native-one-preflight.unit.js` cover valid, invalid, and truncated signatures. | Direct preflight evidence only. A valid signature permits later parsing but does not itself establish a supported page/content claim. |
| Root file-node reference | MS-ONE section 2.2.1 defines `FileNodeListRootFileNode` at header offset `0x30` as a 12-byte `FileChunkReference64x32`: 8-byte `stp` followed by 4-byte `cb`. | `src/importers/one/revision-store.js` reads this reference through `BinaryReader`; `Tests/native-one-revision-store.unit.js` asserts its byte layout and truncated-range rejection. | Direct reader primitive only. Do not follow the reference or emit pages until the fragment/node traversal layout and a positive native fixture are recorded. |
| Typed native HTML rendering | The HTML output standard requires one `main`, one page-level `h1`, semantic list/table/image markup, escaped content, and sanitization. This is an output contract, not evidence of a native record traversal. | `src/importers/one/render.js` accepts only explicit typed blocks and routes its HTML through `runPipeline()`; `Tests/native-one-render.unit.js` covers semantic output, pipeline processing, and invalid-model rejection. | Rendering infrastructure only. It does not promote paragraphs, lists, tables, or images until their native source records and fixtures are directly evidenced. |
| Schema revisions | Sections 2.3.69 and 2.3.97 define `SchemaRevisionInOrderToRead` and `SchemaRevisionInOrderToWrite`. | The reviewed source establishes the fields and supported revision policy, but this repository has not verified their byte locations. | Do not parse or enforce a schema value until a fixture-backed field layout is recorded. |
| Page object spaces | The source names `PageObjectSpace` and `ConflictPageObjectSpace`. | No object-space traversal is implemented. | Do not claim page discovery or conflict exclusion from the current importer. |
| Outlines and outline elements | The source identifies pages, outlines, and outline elements as native content structures. | No outline record layout is implemented. | Do not claim structural paragraph, list, or table fidelity from recovered strings. |
| Properties and property sets | The source models content through properties and property sets. | No property-set parser is implemented. | Treat metadata recovery as heuristic. |
| File data objects | The source allows picture, embedded-file, and audio/video binary data. | The importer scans binary signatures only. | Report detected resources as heuristic candidates; do not claim native object association or media support. |
| External `onefiles` storage | The source permits file data outside the section in a sibling `onefiles` folder. | Browser imports receive only the selected file. | Do not resolve sidecars; later support needs explicit directory/sidecar fixtures. |
| Conflict and version-history data | The source includes conflict objects/pages and version-history object spaces. Version-history page role is `0x1`. | No detection or exclusion parser is implemented. | Do not claim all pages are normal user pages. |
| Right-to-left layout | `EditRootRTL` specifies right-to-left page layout. | No property parser is implemented. | Do not claim RTL detection or support. |

## Parser Rules

- A feature is `directly evidenced` only after this repository records its
  field layout, fixture, and assertions.
- A feature is `heuristic` when it comes from printable-string recovery or
  binary signature scanning without native object association.
- A feature is `excluded` when the format supports it but the importer cannot
  identify and handle it reliably.
- Native fixture manifests must name the evidence level for every expected
  output claim.

## Transitional Fixture Classification

| Fixture | Evidence level | Release eligibility | Required treatment |
| --- | --- | --- | --- |
| [Tests/Test section.one](Tests/Test%20section.one) | Heuristic printable-string and binary-signature recovery | No | Keep its result `partial`, require heuristic warnings, and use it only for development regression coverage. |
| [Tests/Test notebook.onepkg](Tests/Test%20notebook.onepkg) | Heuristic package extraction plus contained-section recovery | No | Keep package conversion disabled in the worker and use this file only for inventory/extraction research coverage. |
| [Tests/one-invalid-signature-001.one](Tests/one-invalid-signature-001.one) | Direct signature preflight rejection | No output claim | Require a `hard-failure` before parser traversal, with `ONE_INVALID_SIGNATURE`. |

The fixture manifest enforces that heuristic fixtures are `transitional` and
`releaseEligible: false`. A fixture may become release eligible only after its
direct field layout, positive and negative fixture pair, expected output, and
warning assertions are recorded.

## Next Direct-Parsing Prerequisites

Before adding binary record detection, record all of the following for one
fixture-backed feature:

1. The source section and field/record definition.
2. The verified byte layout or traversal path used by the implementation.
3. A fixture containing the feature and a negative or unsupported case.
4. Expected output and warning behavior.

Until those prerequisites exist, the importer must continue to report
heuristic recovery as partial output.

## Implemented Header Boundary

`src/importers/one/binary-reader.js` provides bounded little-endian integer,
GUID, UTF-16LE, and slice reads with typed range and read-budget failures.
`src/importers/one/section-header.js` currently validates only the documented
signature at byte offset zero. It does not parse schema revisions, fragment
offsets, or any other header field until the required direct evidence exists.
