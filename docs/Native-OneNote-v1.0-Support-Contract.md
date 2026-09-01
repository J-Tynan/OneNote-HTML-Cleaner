# Title

v1.0 Native OneNote Support Contract

## Purpose

This document defines the release support boundary for native OneNote file handling in OneNote HTML Cleaner v1.0.

It is not a PRD, roadmap, or implementation plan. It defines what the project may claim at release, what the app must reject, and what evidence is required before any native support claim is allowed.

This contract separates:

- Format facts: facts from the Microsoft `.one` format brief and repo evidence for `.onepkg` packaging.
- Product decisions: deliberate release boundaries chosen to protect user trust and deterministic behavior.
- Assumptions: unproven positions that block release claims until fixtures and acceptance tests confirm them.

No sentence in this contract is a support claim unless it appears in an in-scope, supported scenario, fidelity, or release-gate section and has a corresponding fixture category.

## Release Goal

v1.0 may add native OneNote import only for a small, testable subset of native files.

The release goal is not native format completeness. The release goal is to convert simple, valid native inputs into readable HTML without silently losing supported content or overstating fidelity.

The v1.0 standard is:

- Fail closed when the parser cannot prove support.
- Preserve supported text content, basic structure, and resolvable embedded raster images.
- Report every known unsupported or degraded content class.
- Keep `.one` and `.onepkg` claims separate.
- Prefer an unsupported message over a low-confidence conversion.
- Require fixture-backed evidence for every public claim.

## In-Scope File Types

| File type | Accepted by UI | Attempted for conversion | Guaranteed supported in v1.0 |
| --- | --- | --- | --- |
| `.one` | Yes. | Yes, only after extension, size, signature, schema, and parser preflight pass. | Narrowly supported for fixture-backed section files containing supported page content. |
| `.onepkg` | Yes. | Preflight and safe inventory only by default. Conversion is unsupported unless the explicit `.onepkg` promotion proof points in this contract are met before release. | No default conversion guarantee. At most, fixture-proven simple package inventory. |
| `.mht` / `.mhtml` | Yes. | Yes, through the existing stable workflow. | Existing support remains unchanged. |
| `.html` / `.htm` | Existing app behavior only. | Existing app behavior only. | No new claim from this contract. |
| Other files | No. | No. | No. |

Accepted by UI means the app recognizes the extension and can show a specific status.

Attempted for conversion means the worker may run native preflight. For `.one`, conversion may continue only after preflight passes. For `.onepkg`, conversion remains unsupported unless the release explicitly promotes package conversion after proof of browser-only extraction, per-section reporting, and contained-section conversion.

Guaranteed supported means the project has fixture coverage, deterministic output assertions, warning assertions, and user-message assertions for that exact class of input.

## Supported v1.0 Scenarios

v1.0 supports only content that the parser can identify directly from native structures or locked fixtures. Heuristic recovery is not part of the support claim.

Supported `.one` scenarios:

- A valid OneNote section file with normal pages only.
- Page titles when title fields are directly parseable.
- Paragraph text when page ownership is directly parsed from native page structures.
- Single-level bulleted and numbered lists when the native list structure is explicit.
- Basic rectangular tables when row, column, and cell boundaries are explicit.
- Embedded raster images when bytes, image type, and page association are resolved from the section file.

Conditionally supported `.one` scenarios:

- Multi-page ordering may be claimed only when parsed native page-series, page-node, or equivalent ordering evidence is fixture-backed. Otherwise output order is a stable app order with an informational warning, not a fidelity claim.
- Text hyperlinks may be claimed only if both target and display text are directly associated by parsed native data and covered by locked fixtures. Otherwise links are exported as plain text or omitted from the link-fidelity claim with warnings where detected.
- Subpage hierarchy may be claimed only if native parent/child relationships are parsed and fixture-backed. Otherwise subpages are exported as ordinary pages with an informational warning.
- Built-in note/task tags may be claimed only for tags with stable parsed identifiers and locked mapping tests to the canonical `.onenote-tag` HTML contract. Otherwise tag conversion is deferred.

Supported `.onepkg` scenarios in the default v1.0 claim:

- A package may be accepted by the UI for recognition, status, and specific unsupported messaging.
- A package may be preflighted for extension, size, signature, and safe package-table readability.
- A package may be inventoried when the browser reader can list entries without extracting file contents or depending on Windows-only tooling.

Conditionally promoted `.onepkg` conversion:

- `.onepkg` conversion may enter the v1.0 claim only if browser-only extraction is proven for at least one named compression mode, package inventory is deterministic, per-section result reporting is implemented, and extracted `.one` sections pass the `.one` v1.0 acceptance gates.
- Package hierarchy may be shown only when derived from parsed package or table-of-contents evidence covered by fixtures.

`.onepkg` non-claim:

- v1.0 does not guarantee `.onepkg` conversion by default.
- v1.0 does not guarantee complete notebook conversion for `.onepkg`.
- v1.0 does not guarantee all sections in a `.onepkg` will be extracted.
- v1.0 does not guarantee OneNote notebook ordering unless the ordering evidence is parsed and tested.

Supported output behavior:

- Downloadable HTML for each successfully converted page or section.
- ZIP export for multi-output native conversions.
- Per-file warnings for native conversions and per-entry warnings for `.onepkg` inventory or promoted package conversion.
- Stable, readable, collision-safe filenames.

## Explicit Exclusions and Non-Goals

The following are outside the v1.0 support claim and must not be described as supported:

- Full `.one` binary format coverage.
- Full `.onepkg` notebook/package fidelity.
- Layout-perfect reproduction of OneNote canvases.
- Heuristic reading-order reconstruction for overlapping outlines.
- Complex nested outlines not represented by directly parsed structure.
- Conflict pages, conflict objects, and merge artifacts.
- Version-history pages and revision-history object spaces.
- Password-protected, encrypted, rights-managed, or access-restricted files.
- Corrupted, truncated, malformed, or internally inconsistent native files.
- Right-to-left page layout.
- External sidecar `onefiles` resolution. If a page or section depends on sidecar resources, the text may still convert only if required page content is present in the `.one` file; each missing sidecar resource must produce a missing-resource warning. If sidecar dependency prevents page text or required page structure from being parsed, the affected page or section must hard-fail.
- Embedded files rendered as native attachments.
- Audio or video playback.
- Unsupported package compression.
- Package extraction that depends on Windows-only tools at runtime.
- Vector ink fidelity.
- OCR, handwriting recognition, or text extraction from images.
- Full author metadata, revision metadata, sync metadata, or collaboration history.
- Round-trip editing back to `.one` or `.onepkg`.
- Very large native files or packages beyond explicit release limits.
- Native conversion inside exported HTML without the app pipeline.
- Native-aware `.docx`, Markdown, or other non-HTML export claims.

If excluded content is detected inside an otherwise convertible input, the app must either fail the affected unit or produce partial output with a specific warning. Silent omission is a release blocker.

## Format-Specific Contract

`.one` contract:

- Format fact: `.one` is a OneNote section/revision-store file that can contain pages, outlines, text, lists, tables, images, links, note tags, embedded files, metadata, conflict data, and version-history data.
- Product decision: v1.0 `.one` support is limited to normal pages in valid section files.
- Product decision: unsupported object spaces, conflict data, version history, access restrictions, and malformed structures are not converted.
- Product decision: partial `.one` output is allowed only when the converted pages are useful, supported content is not silently omitted, and unsupported content is named in warnings.
- Release claim: `.one` may be called narrowly supported only for the fixture-backed content subset in this contract.

`.onepkg` contract:

- Format fact from repo evidence: `.onepkg` is treated by this project as a notebook package and extraction layer around contained `.one` files.
- Format fact from repo evidence: existing repo tools and importer code indicate cabinet-style package handling, package table parsing, and contained section discovery.
- Evidence limit: the attached Microsoft facts brief supports `.one` structure. It does not establish complete `.onepkg` format behavior.
- Product decision: `.onepkg` is not equally supported with `.one` in v1.0.
- Product decision: default v1.0 `.onepkg` support is limited to recognition, preflight, safe inventory, and unsupported-conversion messaging.
- Product decision: `.onepkg` conversion is not part of the default v1.0 claim. It may be promoted only after browser-only extraction, per-section reporting, and contained `.one` conversion are fixture-proven.
- Product decision: if package conversion is promoted, package-level output must include a per-section result list. A package with skipped or failed sections is partial success, not success.
- Release claim: `.onepkg` may be described as recognized for preflight and limited inventory. It may not be described as package import or notebook conversion unless the promotion gates pass.

Confidence boundary:

- `.one` has the stronger release basis because the project has a `.one` format facts brief.
- `.onepkg` has a weaker release basis because the evidence is extraction-oriented and repo-derived.
- Any release copy that groups `.one` and `.onepkg` under one undifferentiated “native OneNote support” claim is too broad.

## Content Fidelity Contract

Successful conversion means the app creates valid downloadable HTML for a supported page or section and reports known unsupported content.

Must preserve for supported inputs:

- Page or section name.
- Page title when directly parsed.
- Paragraph text.
- Page grouping when parsed from native page structures.
- Multi-page order only if parsed native ordering evidence is promoted through fixtures.
- Explicit single-level ordered and unordered list structure.
- Explicit basic table structure and cell text.
- Resolvable embedded raster images.
- Resolvable text hyperlinks only if promoted from conditional support by fixtures.
- Supported built-in note/task tags only if promoted from conditional support by fixtures.

May degrade only with warnings:

- Canvas position flattened into document order.
- Subpage hierarchy flattened when hierarchy parsing is not claimed.
- Unsupported note tags left as text or omitted from semantic tag output.
- Unsupported attachments represented by placeholders.
- Missing embedded or sidecar-dependent resources represented by placeholders only when the missing resource is detected and named.
- `.onepkg` entries inventoried but not converted, unless package conversion has been promoted.
- `.onepkg` sections skipped because extraction or contained `.one` preflight failed, only if package conversion has been promoted.

Acceptable v1.0 loss when disclosed:

- Exact OneNote visual positioning.
- Nonessential metadata.
- Revision, sync, and collaboration metadata.
- Unsupported attachment rendering.
- Audio and video behavior.
- Native object properties with no v1.0 HTML representation.

Release-blocking loss:

- Silent omission of page text from a supported page.
- Silent omission of a supported raster image.
- Silent omission of a sidecar-dependent missing resource warning.
- Silent flattening of hierarchy while claiming hierarchy preservation.
- Incorrect list or table structure presented as faithfully preserved when the parser guessed it.
- Reporting a partial native result as a complete conversion.
- Reporting an unsupported file as converted.
- Nondeterministic output for the same file and configuration.
- Broken downloads for successful conversions.
- Leaking local source paths or sensitive metadata not explicitly approved for export.

## Failure Modes and User Messaging

Native conversion outcomes must use one of four states: unsupported, hard failure, partial success, or success with informational warnings.

Unsupported:

- Use when the file type or detected feature is outside the v1.0 contract before conversion starts.
- No output is produced.

Example messages:

- `Native import does not support right-to-left OneNote pages in v1.0. Export this page from OneNote as .mht and convert that file instead.`
- `This .onepkg uses package compression that v1.0 cannot extract in the browser.`
- `OneNote package conversion is not supported in v1.0. This package was recognized but no HTML output was created.`

Hard failure:

- Use when preflight passes far enough to attempt native handling but conversion cannot continue safely.
- No partial output is produced unless the failure is isolated to a page or package entry already classified as partial success.

Example messages:

- `This .one file has a OneNote extension but not a supported section signature.`
- `This .one file appears incomplete or corrupted. OneNote HTML Cleaner did not create output.`
- `This .onepkg contains no extractable .one sections supported by v1.0.`
- `This native file exceeds the configured v1.0 browser import limit. Split the notebook or export from OneNote as .mht.`
- `This page depends on external onefiles resources for required content. v1.0 does not resolve sidecar folders, so this page was not converted.`

Partial success:

- Use when at least one page or section is converted and at least one known item is skipped or degraded.
- The UI must identify the affected page, section, or package entry where possible.

Example messages:

- `Converted 3 of 5 sections. Two sections were skipped because their contained .one files did not pass v1.0 preflight.`
- `Converted this page, but one embedded file is shown as a placeholder because v1.0 does not render attachments.`
- `Converted this page, but one sidecar onefiles resource is missing because v1.0 does not resolve external sidecar folders.`
- `Converted this page in readable order. Overlapping OneNote outlines were flattened and exact canvas placement was not preserved.`
- `Converted this section, but native note tags were not converted because this tag set is not in the v1.0 supported mapping.`

Success with informational warnings:

- Use when output is complete within the v1.0 contract but expected native-to-HTML differences remain.

Example messages:

- `OneNote canvas positioning was normalized into document order.`
- `This .onepkg was recognized and inventoried. Package conversion is not part of the default v1.0 claim.`
- `Revision history and sync metadata are not included in native HTML exports.`

Messaging requirements:

- Name the file, section, page, or content class affected when that information is available.
- Say whether output was created.
- Say whether the result is complete within the v1.0 contract or partial.
- Provide a next action when one exists: export as `.mht`, split the notebook, remove unsupported media, or use a simpler package.
- Do not use vague standalone messages such as `conversion failed`, `unsupported content removed`, or `notebook converted`.

## Representative Fixture Requirements

No fixture category below creates a support claim by itself. A category creates a claim only when paired with locked expected output and user-message assertions.

Required `.one` support fixtures:

- Valid section with one normal page, title, and paragraphs.
- Valid section with multiple normal pages.
- Valid section with explicit single-level ordered and unordered lists.
- Valid section with one basic rectangular table.
- Valid section with embedded raster image content.

Conditional `.one` support fixtures:

- Valid section with directly parsed text hyperlink content, if link support is claimed.
- Subpage hierarchy with parsed parent/child evidence, if hierarchy is claimed.
- Built-in note/task tags with parsed identifiers and canonical output mapping, if tag support is claimed.
- Nested lists, if nesting is claimed.
- Non-rectangular or merged-cell tables, if any behavior beyond basic tables is claimed.
- Multi-page ordering with parsed native page-series, page-node, or equivalent ordering evidence, if ordering fidelity is claimed.

Required `.one` unsupported and partial fixtures:

- Wrong signature or non-OneNote content with `.one` extension.
- Truncated or corrupted section.
- Unsupported schema or missing required parser structure.
- Conflict or version-history content, if detectable.
- Right-to-left page.
- Overlapping outlines.
- Unsupported embedded attachment.
- Missing or unresolved image bytes.
- Sidecar `onefiles` dependency with page text still convertible.
- Sidecar `onefiles` dependency that prevents required page content from being parsed.
- Native file beyond the configured size limit.

Required `.onepkg` recognition and inventory fixtures:

- Package with a valid recognized signature and readable package table.
- Package inventory listing contained entries without producing HTML output.
- Package inventory that produces a precise unsupported-conversion message.

Conditional `.onepkg` support fixtures:

- Browser-only extraction for each compression mode claimed.
- Simple extractable package with one eligible `.one` section, if package conversion is claimed.
- Simple extractable package with multiple eligible `.one` sections, if package conversion is claimed.
- Package where output filenames would collide without normalization, if package conversion is claimed.
- Package table-of-contents hierarchy, if hierarchy is claimed.
- Nested section groups, if nested hierarchy is claimed.
- Package ordering, if ordering is claimed.
- Any compression mode beyond the simplest shipped browser-supported mode.

Required `.onepkg` unsupported and partial fixtures:

- Non-package content with `.onepkg` extension.
- Package with unsupported compression.
- Package with corrupted package tables.
- Package with no extractable `.one` sections.
- Package where one contained section converts and another fails, if package conversion is claimed.
- Package beyond the configured size limit.
- Package that would require external sidecar files.

Boundary fixtures:

- Empty page and title-only page.
- Duplicate page titles.
- Long filenames.
- Filenames with spaces and Unicode characters.
- Large but supported raster image.
- Multiple generated outputs requiring ZIP export.

## Acceptance Test Matrix

| Area | Required checks | Release expectation |
| --- | --- | --- |
| Native preflight | Extension, size, signature, schema, and package checks classify files before conversion. | Unsupported files fail closed before output is created. |
| `.one` conversion | Required `.one` support fixtures produce expected HTML for titles, paragraphs, basic lists, basic tables, and images. | Every supported content claim is backed by expected output. |
| Conditional features | Links, tags, hierarchy, multi-page ordering fidelity, nested lists, and advanced tables are tested only if they remain in scope. | Unproven conditional features are absent from release claims. |
| `.onepkg` recognition and inventory | Supported packages produce deterministic preflight and inventory results without HTML output by default. | Package recognition does not imply package conversion. |
| `.onepkg` promoted conversion | If package conversion is claimed, browser-only extraction, per-section results, and contained `.one` acceptance checks all pass. | Package support does not bypass `.one` support gates. |
| Warning behavior | Unsupported content, flattened layout, missing resources, skipped sections, and partial package results produce exact expected messages. | Users can see what happened and what to do next. |
| Hard failures | Corruption, unsupported compression, size limits, and missing required structures produce exact expected messages. | No vague error state ships. |
| Download behavior | Single-output and ZIP-output native conversions have stable filenames and valid links. | Successful conversion always produces usable output. |
| Determinism | Repeated conversion of the same fixture and config is stable. | Output and warning classifications do not drift. |
| Existing workflow | Existing `.mht` / `.mhtml` gate remains green. | Native work does not regress the shipped product. |
| Security | Generated HTML and resources pass the existing sanitizer/security expectations. | Native parsing does not create unsafe output. |
| Manual acceptance | A short locked manual pass covers representative `.one` fixtures and `.onepkg` recognition/inventory fixtures. | Human-visible status, warnings, downloads, and release copy match the contract. |

## Release Gates

Release blockers:

- Any public support claim without a locked fixture, expected output, and expected message assertion.
- Any `.onepkg` conversion claim without proof of browser-only extraction for a named compression mode, deterministic package inventory, per-section reporting, and contained `.one` acceptance coverage.
- Any `.onepkg` success state that does not report per-section outcomes.
- Any use of `.onepkg` wording that implies full notebook fidelity.
- Silent omission of supported page text.
- Silent omission of supported raster images.
- Silent omission of a detected sidecar `onefiles` dependency.
- Silent omission of detected unsupported content.
- Heuristic list, table, hierarchy, link, or tag reconstruction presented as supported fidelity.
- Nondeterministic output or warnings for the same input and configuration.
- Broken native downloads or ZIP exports.
- Vague user-facing native errors.
- Native support regresses existing `.mht` / `.mhtml` tests.
- Unsafe HTML, unsafe resource handling, or unapproved local path leakage.

Documented limitations that do not block release if messaged and tested:

- Flattened canvas positioning.
- No layout-perfect OneNote canvas rendering.
- No right-to-left page support.
- No conflict or version-history export.
- No sidecar `onefiles` support.
- No rendered attachment, audio, or video support.
- `.onepkg` recognition and inventory only, unless package conversion passes promotion gates.
- No full `.onepkg` notebook fidelity.
- No tag support unless the tag subset passes conditional gates.
- No hyperlink support unless direct native association passes conditional gates.
- No hierarchy support unless hierarchy passes conditional gates.

Before v1.0 ships:

- Set explicit file and package size limits.
- Lock the native warning code list and UI message copy.
- Prove every required fixture category through automated tests.
- Complete a short locked manual acceptance pass on representative native fixtures, including at least one happy-path `.one`, one unsupported `.one`, one `.onepkg` recognition/inventory case, and one `.onepkg` unsupported-conversion message.
- Complete a release-copy audit confirming README, release notes, UI labels, and warning text do not overclaim `.onepkg` or hyperlink fidelity.
- Remove release copy that groups `.one` and `.onepkg` as equally supported.
- Keep the existing MHTML release gate green.

## Deferred Work After v1.0

Deferred work must not appear in v1.0 release claims unless promoted through fixtures, tests, and release gates.

- Full `.one` object-space coverage.
- Overlapping outline layout reconstruction.
- Right-to-left page support.
- Conflict and version-history export.
- Sidecar `onefiles` resolution.
- Rich embedded-file extraction and attachment previews.
- Audio and video extraction or playback.
- Vector ink fidelity.
- Expanded package compression support.
- Full `.onepkg` notebook hierarchy, ordering, and table-of-contents fidelity.
- Expanded native note-tag taxonomy.
- Native-aware Markdown, `.docx`, or other non-HTML exports.
- Advanced native-specific toolbar, theme, or sidecar behavior.

## Open Questions and Assumptions

Open questions blocking final release claims:

- What exact browser-safe size limits apply to `.one` and `.onepkg`?
- Which `.one` schema variants are in the supported fixture corpus?
- Which package compression modes are supported in the browser without Windows-only tools?
- Is there enough browser-only `.onepkg` extraction evidence to promote package conversion at all in v1.0?
- Can `.onetoc2` parsing support any hierarchy claim in v1.0?
- Can native hyperlinks be parsed from stable structures rather than inferred strings?
- Can built-in note/task tags be parsed as stable native identifiers rather than presentation artifacts?
- What metadata fields are safe and useful to include in native HTML exports?

Assumptions for this contract:

- v1.0 remains browser-first and cannot rely on a local Windows-only companion extractor for normal app conversion.
- `.one` is the only candidate for a primary native support claim.
- `.onepkg` is recognized for preflight and safe inventory by default; conversion must remain unsupported unless promoted by explicit proof.
- Unsupported or degraded content is acceptable only when named in user-visible messages.
- Fixture-backed proof is required before release wording, README copy, or UI copy may claim support.

## Recommended v1.0 Cut Line

Recommended cut line:

- Ship `.one` as narrowly supported for valid section files with normal pages, directly parsed titles, paragraph text, explicit basic lists, explicit basic tables, and resolvable embedded raster images.
- Do not include hyperlinks, hierarchy, or native note tags in the default `.one` support claim unless those features pass conditional release gates.
- Ship `.onepkg` as recognized for preflight and safe inventory only, with conversion unsupported by default.
- Promote `.onepkg` conversion only if browser-only extraction, deterministic inventory, per-section status, and contained `.one` conversion are all proven by locked fixtures before release.

The release must not describe `.one` and `.onepkg` as equally supported formats.

The safest v1.0 promise is: convert simple pages from valid `.one` sections, recognize `.onepkg` packages without claiming conversion by default, and fail or warn specifically for everything outside the proven set.

## Implementation Implications

- Native preflight must run before conversion and must produce stable classifications.
- The worker response needs warning codes, severity, affected unit, and user-facing message data.
- `.onepkg` handling must support recognition, preflight, safe inventory, and unsupported-conversion messaging before any package conversion work is claimed.
- Conditional features need feature-specific fixtures before release copy can mention them.
- The UI must distinguish complete success, partial success, hard failure, and unsupported native input.
- Download code must handle native multi-output results and filename collisions.
- Native fixture tests must assert generated HTML and visible warning text.
- Release documentation must make `.onepkg` visibly narrower than `.one`.
- Manual acceptance and release-copy audit results must be recorded before v1.0 release approval.
- Existing MHTML gates remain part of the native release gate.