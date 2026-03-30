# Markdown Flavor Standard

Status: Phase 3 in progress (normative rules are mapped to executable assertions), targeting Robust contract in phased delivery.

## Purpose

This document defines the repository-standard behavior for Markdown export flavors and the path from current implementation to a Robust, test-enforced contract.

The supported flavors are:

- `obsidian` (default)
- `commonmark`
- `gfm`
- `markdown-extra`

## Canonical Upstream References (Pinned)

- Obsidian Markdown syntax reference: <https://help.obsidian.md/syntax>
- CommonMark specification 0.31.2: <https://spec.commonmark.org/0.31.2/>
- GitHub Flavored Markdown (GFM) spec: <https://github.github.com/gfm/>
- Markdown Extra reference: <https://michelf.ca/projects/php-markdown/extra/>

These links are normative references for interoperability goals. Project behavior remains constrained by this repository's implementation and tests.

## Contract Scope

Markdown export is structure-first and generated from sanitized HTML, not raw MHTML.

Current contract boundaries:

- Flavor is selected in UI only when export format is Markdown.
- Flavor is normalized and validated in config plumbing.
- Conversion path routes through sanitized HTML -> markdown core -> flavor adapter.
- Unknown flavor input falls back to `obsidian`.
- `markdown-extra` is treated as first-class support, not optional.

## Implementation Anchors

Primary implementation locations:

- `src/convert/markdownFlavors.js`
  - `SUPPORTED_FLAVORS`
  - `normalizeMarkdownFlavor`
  - `applyMarkdownFlavor`
- `src/convert/markdownCore.js`
  - `convertSanitizedHtmlToMarkdown`
- `src/pipeline/config.js`
  - export format/flavor normalization and defaulting
- `src/ui-downloads.js`
  - UI-to-config extraction (`getConversionConfig`)
- `src/ui.js` and `index.html`
  - export controls visibility and flavor selection UX
- `src/worker.js` / `src/worker-wrapper.js`
  - conversion routing and worker payload pass-through

## Phase 1 Baseline (Current Behavior)

### Global Normalization (all flavors)

Current adapters apply these shared transformations for every flavor:

- line ending normalization (`CRLF`/`CR` -> `LF`)
- task list marker normalization (`[X]` -> `[x]`)
- table delimiter normalization (pipe table delimiter row consistency)
- fenced code normalization (`~~~` -> `````)
- canonical OneNote tags in sanitized HTML render as markdown text without inline HTML

### Flavor-specific behavior currently implemented

- `obsidian`: no additional transform beyond shared normalization.
- `commonmark`: no additional transform beyond shared normalization.
- `gfm`: no additional transform beyond shared normalization.
- `markdown-extra`: applies shared normalization plus blank-line collapse (`3+` consecutive newlines -> `2`).

## Behavior Matrix (Phase 1)

| Feature | obsidian | commonmark | gfm | markdown-extra |
|---|---|---|---|---|
| Flavor selectable in UI | Yes | Yes | Yes | Yes |
| Flavor normalized/fallback to default | Yes | Yes | Yes | Yes |
| Task list marker normalization | Yes | Yes | Yes | Yes |
| Canonical todo-family OneNote tags become task items | Yes | Escaped per CommonMark task policy | Yes | Yes |
| Canonical non-task OneNote tags become emoji-prefixed text | Yes | Yes | Yes | Yes |
| Table delimiter normalization | Yes | Yes | Yes | Yes |
| Fenced code delimiter normalization | Yes | Yes | Yes | Yes |
| Extra blank-line collapse policy | No | No | No | Yes |
| Flavor-specific syntax divergence (beyond above) | Not yet | Not yet | Not yet | Limited |

## Canonical OneNote Tag Rendering

When sanitized HTML contains canonical `.onenote-tag` elements:

- `todo` and `todo-priority-1` render as markdown task items.
- `commonmark` continues to escape those task markers as literal text per the existing task policy.
- Non-task built-in tags render as emoji-prefixed markdown text using the repository mapping research.
- Markdown output must remain free of raw structural inline HTML such as `<span>` wrappers.

## Test Artifact Map

Current checks that enforce flavor plumbing and baseline behavior:

- `Tests/markdown-flavors.unit.js`
  - supported list, normalization/fallback, adapter normalization behavior
- `Tests/markdown-flavor-contract.unit.js`
  - fixture-backed assertions for normative rules (R1-R10) across all four flavors
- `Tests/pipeline-config.unit.js`
  - export config normalization and defaults
- `Tests/ui-downloads-config.js`
  - UI config extraction and flavor handling
- `Tests/export-markdown-playwright.js`
  - end-to-end markdown export smoke across fixtures/flavors

Related fixture/output paths:

- `Tests/fixtures/markdown`
- `Tests/expected/markdown`
- `Tests/Markdown` (generated smoke outputs)
- `Tests/fixtures/markdown/flavor-contract.sanitized.html`

## Phased Roadmap to Robust

### Phase 1 — Baseline Documentation (current)

Exit criteria:

- canonical flavor standard documented in this file
- README points to this file as single source of truth
- TODO milestones aligned to phased approach

### Phase 2 — Normative Flavor Rules (drafted)

This section defines the target contract for robust enforcement.

Rule legend:

- Applies to: `obsidian`, `commonmark`, `gfm`, `markdown-extra` unless explicitly scoped.
- PASS example: output that is compliant.
- FAIL example: output that violates the rule.

#### R1 — ATX heading style and spacing

Requirement:

- Use ATX headings (`#` to `######`) with one space after marker.
- Insert one blank line after heading blocks unless followed by another heading.

PASS

```md
## Conversion Notes

Paragraph text.
```

FAIL

```md
##Conversion Notes
Paragraph text.
```

#### R2 — Unordered list marker normalization

Requirement:

- Normalize unordered list markers to `-` (single canonical marker).
- Preserve nesting by indentation; avoid marker style switching within a list.

PASS

```md
- Item one
  - Nested item
- Item two
```

FAIL

```md
* Item one
  + Nested item
- Item two
```

#### R3 — Ordered list numbering semantics

Requirement:

- Emit canonical ordered-list numbering that preserves item order.
- Preserve logical order by list position, not original literal numbering noise.

PASS

```md
1. First
2. Second
3. Third
```

FAIL

```md
7) First
9) Second
12) Third
```

#### R4 — Task list checkbox normalization

Requirement:

- Canonical task values are lowercase (`[x]`) and unchecked (`[ ]`).
- `obsidian`, `gfm`, and `markdown-extra`: emit task list markers as active markdown checkboxes.
- `commonmark`: escape task markers to literal text (`\\[x\\]`, `\\[ \\]`) to avoid extension semantics.

PASS (`obsidian`/`gfm`/`markdown-extra`)

```md
- [ ] queued
- [x] done
```

PASS (`commonmark`)

```md
- \[ \] queued
- \[x\] done
```

FAIL

```md
- [X] done
- [] queued
```

#### R5 — Pipe table delimiter canon

Requirement:

- Normalize delimiter cells to canonical `---`, `:---`, `---:`, or `:---:`.
- Emit consistent spaced pipe layout.

PASS

```md
| Name | Score |
| :--- | ---: |
| A | 10 |
```

FAIL

```md
|Name|Score|
|====|====:|
|A|10|
```

#### R6 — Fenced code block delimiter canon

Requirement:

- Use backtick fences rather than tildes.
- Preserve language hint when available.

PASS

~~~md
```js
console.log('ok');
```
~~~

FAIL

```md
~~~javascript
console.log('ok');
~~~
```

#### R7 — Link style policy

Requirement:

- Emit inline Markdown links as `[label](url)` for external and local links.
- `gfm`: when link label equals URL exactly, emit autolink form `<url>`.
- Do not emit wiki-link syntax by default.

PASS

```md
See [project board](https://example.org/board).
```

FAIL

```md
See [[project board]].
```

#### R8 — Paragraph and blank-line policy

Requirement:

- Separate block constructs with a single blank line where needed for readability.
- For `markdown-extra`, collapse 3+ consecutive blank lines to at most 2.

PASS (`markdown-extra`)

```md
Paragraph one.

Paragraph two.
```

FAIL (`markdown-extra`)

```md
Paragraph one.



Paragraph two.
```

#### R9 — Raw inline HTML guardrail

Requirement:

- Default output must not rely on raw structural HTML (`<div>`, `<span>`, `<table>`) for primary document structure.
- Allowed only under a future explicit opt-in mode.

PASS

```md
| A | B |
| --- | --- |
| 1 | 2 |
```

FAIL

```md
<table><tr><td>1</td><td>2</td></tr></table>
```

#### R10 — Deterministic output and flavor fallback

Requirement:

- Unknown or missing flavor input must normalize to `obsidian`.
- Same sanitized HTML input with same options must produce deterministic output.

PASS

```md
Input flavor: "unknown"
Effective flavor: "obsidian"
```

FAIL

```md
Input flavor: "unknown"
Effective flavor: "gfm"
```

Exit criteria:

- 8-12 normative rules are documented with PASS/FAIL examples.
- Each rule identifies whether it is common or flavor-specific.
- Rules are mapped to executable assertions in Phase 3.

### Phase 3 — Enforced Regression Contract

Promote normative rules to executable checks.

Current implementation note:

- `Tests/markdown-flavor-contract.unit.js` enforces R1-R10 with fixture-backed assertions and flavor fallback/determinism checks.
- `test:gate:native` includes `test:markdown-contract` so contract drift fails the native gate.

Exit criteria:

- fixture coverage exists for each normative rule
- expected outputs include per-flavor assertions where behavior must diverge
- smoke/unit tests fail on contract drift

### Phase 4 — Change Governance

Require markdown flavor changes to update docs, fixtures, and tests in the same change.

Exit criteria:

- documented “flavor change checklist” is used in PRs
- no flavor behavior changes merge without standards + test updates

## Flavor Change Checklist (for Robust target)

For any PR that changes markdown flavor behavior:

1. Update this standards document.
2. Update or add fixtures and expected outputs.
3. Update unit/smoke tests to assert the changed rule.
4. Verify fallback/default behavior is unchanged unless intentionally modified.
5. Confirm all four flavors remain selectable and routable.
