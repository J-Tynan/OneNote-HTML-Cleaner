# Native OneNote v1.0 Fixture Traceability Matrix

This document is Step 2 for the locked native-support contract in [docs/Native-OneNote-v1.0-Support-Contract.md](docs/Native-OneNote-v1.0-Support-Contract.md). Its job is to translate contract language into concrete fixtures, expected outcomes, and test targets.

This is not the implementation plan for native parsing. It is the evidence plan for proving or disproving the current `v1.0` support claim.

## Purpose

- Turn each default `v1.0` native claim into at least one real fixture plus automated assertions.
- Separate default-release proof from conditional-promotion proof.
- Make fixture gaps visible before parser work expands scope.
- Give the repo a single traceability table for native fixtures, expected states, warning behavior, and test ownership.

## Current baseline

Current native fixtures already present in the repo:

- [Tests/Test Section.one](Tests/Test%20Section.one)
- [Tests/Test Notebook.onepkg](Tests/Test%20Notebook.onepkg)

Current native-oriented automated tests already present in the repo:

- [Tests/semantic-native-parser.js](Tests/semantic-native-parser.js)
- [Tests/metadata-onepkg-parser.js](Tests/metadata-onepkg-parser.js)
- [Tests/warning-code-contract.js](Tests/warning-code-contract.js)

Current package scripts already relevant to native work:

- [package.json](package.json): `test:semantic:native`
- [package.json](package.json): `test:metadata:onepkg`
- [package.json](package.json): `test:warnings:contract`

Current gap:

- The repo does not yet have the fixture breadth required by the locked contract.
- Step 2 therefore needs both a traceability matrix and a fixture-acquisition backlog.

## Conventions

### Result states

- `success`: output created and complete within the default or promoted claim.
- `partial`: output created, but at least one detected class of content was skipped, flattened, downgraded, or withheld with warnings.
- `hard-failure`: no output created because safe conversion could not continue.
- `unsupported`: input recognized or classified, but conversion is outside the current claim.

### Support buckets

- `default-one`: required to ship the default `.one` `v1.0` claim.
- `default-onepkg`: required to ship the default `.onepkg` recognition/preflight/inventory claim.
- `conditional-one`: only required if the team promotes ordering, links, hierarchy, tags, nested lists, or advanced tables.
- `conditional-onepkg`: only required if the team promotes browser-only package conversion.
- `manual`: required for the short locked manual acceptance pass.

### Suggested fixture naming

Use a stable file-prefix convention so the fixture inventory, expected results, and tests stay aligned.

- `.one`: `one-<area>-<case>-###.one`
- `.onepkg`: `onepkg-<area>-<case>-###.onepkg`
- Expected result manifest entry: same id without extension

Examples:

- `one-basic-title-paragraph-001.one`
- `one-invalid-signature-001.one`
- `onepkg-inventory-basic-001.onepkg`
- `onepkg-unsupported-compression-001.onepkg`

### Expected-result manifest fields

Each real fixture should eventually have one manifest entry with these fields:

- `id`
- `fileName`
- `sourceKind`
- `supportBucket`
- `expectedState`
- `shouldCreateHtml`
- `shouldCreateZip`
- `expectedPageCount`
- `expectedSectionCount`
- `expectedWarnings`
- `expectedWarningCodes`
- `expectedManualCheck`
- `automationTarget`
- `notes`

## Phase order

Implement Step 2 in this order:

1. Default `.one` preflight and happy-path proof.
2. Default `.one` unsupported and partial-result proof.
3. Default `.onepkg` recognition, preflight, and inventory proof.
4. Manual acceptance pack.
5. Conditional `.one` promotion only if the team chooses to widen scope.
6. Conditional `.onepkg` promotion only if browser-only extraction proof is strong enough.

## Traceability matrix

## A. Default `.one` release claim

| Fixture ID | Source file to collect/create | Contract slice | Expected state | Output expectation | Required assertions | Initial automation target | Current status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `one-basic-title-paragraph-001` | `one-basic-title-paragraph-001.one` | Valid section, title, paragraphs | `success` | 1+ HTML pages, no ZIP required unless multi-page packaging chooses ZIP | Valid `.one` signature; preflight pass; page title present; paragraph text present; no unsupported-state message | New `Tests/native-one-preflight.unit.js`; expand [Tests/semantic-native-parser.js](Tests/semantic-native-parser.js) or add `Tests/native-one-conversion.unit.js` | Missing fixture |
| `one-multipage-basic-001` | `one-multipage-basic-001.one` | Valid section with multiple normal pages | `success` | Multiple HTML page outputs or deterministic grouped output, per contract | Page count stable; each page has title or deterministic fallback; no hidden dropped page | New `Tests/native-one-conversion.unit.js` | Missing fixture |
| `one-basic-lists-001` | `one-basic-lists-001.one` | Explicit single-level ordered/unordered lists | `success` | HTML output contains semantic `ul`/`ol` structure | Native list structure mapped without glyph fallback; warnings absent for supported list blocks | New `Tests/native-one-conversion.unit.js` | Missing fixture |
| `one-basic-table-001` | `one-basic-table-001.one` | Explicit basic rectangular table | `success` | HTML output contains one semantic table | Row/column counts preserved; cell text present; no guessed structure warning | New `Tests/native-one-conversion.unit.js` | Missing fixture |
| `one-raster-image-001` | `one-raster-image-001.one` | Resolvable embedded raster images | `success` | HTML output contains image element or embedded resource reference | Resolved image bytes; stable count; no silent image omission | New `Tests/native-one-resources.unit.js` | Missing fixture |
| `one-existing-smoke-001` | [Tests/Test Section.one](Tests/Test%20Section.one) | Existing parser smoke fixture | `success` for current direct importer test only | Existing semantic HTML output | Keep as transitional smoke coverage while dedicated contract fixtures are added | [Tests/semantic-native-parser.js](Tests/semantic-native-parser.js); [Tests/warning-code-contract.js](Tests/warning-code-contract.js) | Existing fixture |

## B. Default `.one` unsupported and partial-result proof

| Fixture ID | Source file to collect/create | Contract slice | Expected state | Output expectation | Required assertions | Initial automation target | Current status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `one-invalid-signature-001` | `one-invalid-signature-001.one` | Wrong signature / non-OneNote content with `.one` extension | `hard-failure` or `unsupported` depending on classifier boundary | No HTML, no ZIP | Signature rejection; specific user-facing invalid-file message | New `Tests/native-one-preflight.unit.js` | Missing fixture |
| `one-corrupt-truncated-001` | `one-corrupt-truncated-001.one` | Truncated/corrupted section | `hard-failure` | No output | Corrupt-file message; no partial output leak | New `Tests/native-one-preflight.unit.js` | Missing fixture |
| `one-unsupported-schema-001` | `one-unsupported-schema-001.one` | Unsupported schema / missing required parser structure | `unsupported` or `hard-failure` | No output | Stable unsupported-schema classification; exact warning/error code | New `Tests/native-one-preflight.unit.js` | Missing fixture |
| `one-conflict-or-history-001` | `one-conflict-or-history-001.one` | Conflict or version-history content | `unsupported` or `partial` only if isolated away from supported pages | Output only if supported normal pages remain | No claim of supported conversion; conflict/history detected and messaged | New `Tests/native-one-unsupported.unit.js` | Missing fixture |
| `one-rtl-001` | `one-rtl-001.one` | Right-to-left page exclusion | `unsupported` | No output | Exact unsupported RTL message | New `Tests/native-one-unsupported.unit.js` | Missing fixture |
| `one-overlap-layout-001` | `one-overlap-layout-001.one` | Overlapping outlines | `partial` if readable output is still produced | HTML output with layout-flattened warning | Warning required; no layout-fidelity claim; no silent omission of visible text | New `Tests/native-one-warnings.unit.js` | Missing fixture |
| `one-attachment-placeholder-001` | `one-attachment-placeholder-001.one` | Unsupported embedded attachment rendering | `partial` | HTML output plus placeholder if page remains otherwise supported | Placeholder/warning path present; no silent drop | New `Tests/native-one-resources.unit.js` | Missing fixture |
| `one-missing-image-bytes-001` | `one-missing-image-bytes-001.one` | Missing or unresolved image bytes | `partial` or `hard-failure` based on contract severity for the page | Output only if page text is still supportable | Missing-resource warning required; no silent image omission | New `Tests/native-one-resources.unit.js` | Missing fixture |
| `one-sidecar-soft-001` | `one-sidecar-soft-001.one` plus sibling `onefiles` dependency | Sidecar dependency with convertible text still present | `partial` | HTML output allowed | Missing sidecar warning required; text preserved | New `Tests/native-one-sidecar.unit.js` | Missing fixture |
| `one-sidecar-hard-001` | `one-sidecar-hard-001.one` plus sibling `onefiles` dependency | Sidecar dependency blocks required content | `hard-failure` | No output | Hard-failure message required; no false success | New `Tests/native-one-sidecar.unit.js` | Missing fixture |
| `one-size-limit-001` | Oversized `.one` fixture or synthetic size harness | Explicit size-limit gate | `unsupported` or `hard-failure` per preflight policy | No output | Size-limit classification and user guidance | New `Tests/native-one-preflight.unit.js` | Missing harness |

## C. Default `.onepkg` recognition, preflight, and inventory proof

| Fixture ID | Source file to collect/create | Contract slice | Expected state | Output expectation | Required assertions | Initial automation target | Current status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `onepkg-inventory-basic-001` | `onepkg-inventory-basic-001.onepkg` | Recognized package with readable package table | `unsupported` for conversion, `success` for inventory path | No HTML by default; inventory/result metadata only | Signature recognized; inventory stable; unsupported-conversion message present | New `Tests/native-onepkg-preflight.unit.js`; new `Tests/native-onepkg-inventory.unit.js` | Missing fixture |
| `onepkg-inventory-multi-entry-001` | `onepkg-inventory-multi-entry-001.onepkg` | Deterministic listing of multiple entries | `unsupported` for conversion, `success` for inventory path | No HTML by default | Stable entry count/names; no implied conversion claim | New `Tests/native-onepkg-inventory.unit.js` | Missing fixture |
| `onepkg-invalid-signature-001` | `onepkg-invalid-signature-001.onepkg` | Non-package content with `.onepkg` extension | `hard-failure` or `unsupported` | No output | Invalid package signature message | New `Tests/native-onepkg-preflight.unit.js` | Missing fixture |
| `onepkg-unsupported-compression-001` | `onepkg-unsupported-compression-001.onepkg` | Unsupported compression | `unsupported` | No output | Specific unsupported-compression message | New `Tests/native-onepkg-preflight.unit.js` | Missing fixture |
| `onepkg-corrupt-table-001` | `onepkg-corrupt-table-001.onepkg` | Corrupted package tables | `hard-failure` | No output | Corrupt package message | New `Tests/native-onepkg-preflight.unit.js` | Missing fixture |
| `onepkg-size-limit-001` | Oversized `.onepkg` fixture or synthetic size harness | Explicit package size-limit gate | `unsupported` or `hard-failure` per preflight policy | No output | Size-limit message; no extraction attempt beyond policy | New `Tests/native-onepkg-preflight.unit.js` | Missing harness |
| `onepkg-existing-smoke-001` | [Tests/Test Notebook.onepkg](Tests/Test%20Notebook.onepkg) | Existing deferred parser smoke fixture | Transitional only; do not treat as default-release proof yet | Existing importer output | Keep only as dev coverage until inventory-only contract tests replace it | [Tests/metadata-onepkg-parser.js](Tests/metadata-onepkg-parser.js); [Tests/warning-code-contract.js](Tests/warning-code-contract.js) | Existing fixture |

## D. Conditional `.one` promotion matrix

Do not add these to the default `v1.0` claim unless the team explicitly promotes them.

| Fixture ID | Source file to collect/create | Promotion claim | Expected state | Required assertions | Initial automation target | Current status |
| --- | --- | --- | --- | --- | --- | --- |
| `one-ordering-series-001` | `one-ordering-series-001.one` | Multi-page ordering fidelity | `success` only if native ordering evidence is parsed | Parsed page-series or equivalent ordering evidence; no heuristic ordering claim | New `Tests/native-one-ordering.unit.js` | Missing fixture |
| `one-hyperlink-direct-001` | `one-hyperlink-direct-001.one` | Direct hyperlink fidelity | `success` only if link target/display relationship is directly parsed | Semantic link emitted; no string inference fallback counted as support | New `Tests/native-one-links.unit.js` | Missing fixture |
| `one-subpage-hierarchy-001` | `one-subpage-hierarchy-001.one` | Subpage hierarchy | `success` only if parent/child relationships are parsed | Hierarchy metadata/output matches fixture; no silent flattening while claiming hierarchy | New `Tests/native-one-hierarchy.unit.js` | Missing fixture |
| `one-tag-basic-001` | `one-tag-basic-001.one` | Built-in note/task tags | `success` only if canonical tag mapping is explicit | Stable identifier parsing; canonical `.onenote-tag` output; warning behavior for unsupported tags | New `Tests/native-one-tags.unit.js` | Missing fixture |
| `one-nested-lists-001` | `one-nested-lists-001.one` | Nested lists | `success` only if nesting is directly parsed | Nested structure preserved without glyph heuristics | New `Tests/native-one-lists-advanced.unit.js` | Missing fixture |
| `one-advanced-table-001` | `one-advanced-table-001.one` | Non-rectangular/merged-cell table support | `success` only if explicit support is promoted | Advanced cell structure preserved or explicitly declined | New `Tests/native-one-tables-advanced.unit.js` | Missing fixture |

## E. Conditional `.onepkg` promotion matrix

Do not attempt this until default `.onepkg` recognition/inventory coverage is complete and browser-only extraction proof exists.

| Fixture ID | Source file to collect/create | Promotion claim | Expected state | Required assertions | Initial automation target | Current status |
| --- | --- | --- | --- | --- | --- | --- |
| `onepkg-browser-extract-basic-001` | `onepkg-browser-extract-basic-001.onepkg` | Browser-only extraction for one named compression mode | `partial` or `success` depending on contained `.one` results | Browser-only extraction works without Windows tools; inventory deterministic | New `Tests/native-onepkg-extraction.unit.js` | Missing fixture |
| `onepkg-browser-extract-multi-001` | `onepkg-browser-extract-multi-001.onepkg` | Multiple extracted sections | `partial` or `success` | Per-section results reported; no package-level false success | New `Tests/native-onepkg-extraction.unit.js` | Missing fixture |
| `onepkg-partial-section-failure-001` | `onepkg-partial-section-failure-001.onepkg` | Per-section failure reporting | `partial` | One section succeeds, one fails, summary state remains partial | New `Tests/native-onepkg-extraction.unit.js` | Missing fixture |
| `onepkg-filename-collision-001` | `onepkg-filename-collision-001.onepkg` | Collision-safe naming under package conversion | `success` or `partial` | Stable unique file names and ZIP entries | New `Tests/native-onepkg-downloads.unit.js` | Missing fixture |
| `onepkg-hierarchy-001` | `onepkg-hierarchy-001.onepkg` plus `.onetoc2` evidence | Package hierarchy fidelity | `success` only if hierarchy is promoted | Parsed package/TOC hierarchy reflected in output or metadata | New `Tests/native-onepkg-hierarchy.unit.js` | Missing fixture |

## F. Boundary and cross-cutting fixtures

| Fixture ID | Source file to collect/create | Why it exists | Expected state | Required assertions | Initial automation target | Current status |
| --- | --- | --- | --- | --- | --- | --- |
| `one-empty-or-title-only-001` | `one-empty-or-title-only-001.one` | Boundary case for minimal valid page content | `success` or `partial` per agreed title-only policy | No crash; stable minimal HTML; message if content is intentionally minimal | New `Tests/native-one-boundaries.unit.js` | Missing fixture |
| `one-duplicate-title-001` | `one-duplicate-title-001.one` | Duplicate title naming and collision behavior | `success` | Stable per-page naming; no overwrite/collision | New `Tests/native-one-downloads.unit.js` | Missing fixture |
| `one-unicode-filename-001` | Any supported `.one` with spaces and Unicode file name | Filename safety and export naming | `success` | Download naming remains readable and deterministic | New `Tests/native-one-downloads.unit.js` | Missing fixture |
| `one-large-image-001` | `.one` with large but supported raster image | Resource-size boundary | `success` or `partial` | No silent image drop; size behavior remains deterministic | New `Tests/native-one-resources.unit.js` | Missing fixture |
| `native-warning-contract-001` | Reuse existing fixtures plus new warning cases | Structured warning code/message parity | `success` for test harness | `warningDetails` parity; known-code enforcement; message presence | [Tests/warning-code-contract.js](Tests/warning-code-contract.js) plus expansion | Partial coverage exists |

## Suggested test-file rollout

Keep the test rollout small and contract-aligned. Start with these files before expanding further:

1. `Tests/native-one-preflight.unit.js`
2. `Tests/native-one-conversion.unit.js`
3. `Tests/native-one-resources.unit.js`
4. `Tests/native-one-sidecar.unit.js`
5. `Tests/native-onepkg-preflight.unit.js`
6. `Tests/native-onepkg-inventory.unit.js`
7. `Tests/native-warning-messages.unit.js`
8. `Tests/native-release-manual-checklist.md`

Only add these if the corresponding scope is promoted:

1. `Tests/native-one-links.unit.js`
2. `Tests/native-one-ordering.unit.js`
3. `Tests/native-one-hierarchy.unit.js`
4. `Tests/native-one-tags.unit.js`
5. `Tests/native-onepkg-extraction.unit.js`
6. `Tests/native-onepkg-hierarchy.unit.js`

## Manual acceptance pack

The short locked manual pass should stay small and match the release gates.

Required manual cases:

- One happy-path `.one` fixture from the default support bucket.
- One unsupported `.one` fixture, ideally RTL or invalid signature.
- One `.one` partial-result fixture, ideally overlap-layout or sidecar-soft.
- One `.onepkg` recognition/inventory fixture with no HTML output by default.
- One `.onepkg` unsupported-conversion or unsupported-compression message case.

For each manual case, record:

- fixture id
- UI status shown
- whether output was created
- warning/error text shown
- whether the wording matches the contract
- whether filenames/downloads behaved as expected

## Minimum definition of done for Step 2

Step 2 is complete only when all of the following are true:

- Every `default-one` row has a real fixture or an explicitly assigned collection owner.
- Every `default-onepkg` row has a real fixture or an explicitly assigned collection owner.
- Every default-row fixture has a declared expected state and expected warning behavior.
- At least one automated test file exists for `.one` preflight, `.one` happy-path conversion, `.one` warning/resource behavior, `.onepkg` preflight, and `.onepkg` inventory.
- The existing transitional tests are either mapped into the new matrix or clearly marked non-gating.
- The manual acceptance pack is defined and small enough to run before release.

## Recommended immediate next actions

1. Create a small machine-readable manifest for native fixtures, even if it starts with only the two existing files.
2. Add `default-one` and `default-onepkg` rows to that manifest before collecting more fixtures.
3. Implement `Tests/native-one-preflight.unit.js` first because it is the cheapest fail-closed proof surface.
4. Implement `Tests/native-onepkg-preflight.unit.js` and `Tests/native-onepkg-inventory.unit.js` before any package-conversion work.
5. Treat all conditional-promotion rows as out of scope until the default rows are green.