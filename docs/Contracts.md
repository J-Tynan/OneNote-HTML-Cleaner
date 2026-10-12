# Contracts

## Pipeline invariants
- Preserve original text spacing and line breaks.
- Remove all non-breaking spaces (convert to regular spaces).
- Preserve widths, table structure, alignment, list numbering, and inline images.
- Keep HTML structure stable unless a specific repair rule requires adjustment.
- Optional migration may convert safe inline typography/margins to utility classes.

## Canonical OneNote tag contract

The pipeline now normalizes supported built-in OneNote tags into canonical semantic HTML.

The public tag contract is:

```html
<span class="onenote-tag" data-tag="todo" data-label="To Do" data-state="unchecked">
  <span class="tag-label">To Do</span>
</span>
```

Contract notes:

- `data-tag` is required and carries the stable semantic ID.
- `data-label` is required and carries the readable label.
- `data-state` is optional and is used only for stateful tags.
- `data-variant` is reserved for future use when a tag family needs additional specificity.
- For the built-in tag set, priority is modeled in `data-tag` rather than a separate `data-priority` field.
- The current parser scope is limited to built-in default tags detected at block-leading positions in exported MHTML/HTML.
- `.onenote-tag` and `.tag-label` are stable public hooks for styling and downstream export logic.
- Tags are emitted as semantic inline content, not as interactive controls.
- Converted HTML injects a minimal inline fallback stylesheet for canonical tags so standalone files keep tag rendering even when no packaged CSS asset is present.
- Shared output CSS also provides the same spacing, alignment, checked-state readability, and emoji rendering baseline; the canonical HTML contract stays unchanged.
- Markdown export may render canonical tags as task markers or emoji-prefixed text while keeping the underlying HTML tag contract unchanged.

No tag-specific worker config keys are part of the stable shipped contract yet.

## Worker request
```json
{
  "id": "string",
  "type": "process-file",
  "fileName": "string",
  "relativePath": "string",
  "html": "string",
  "config": {
    "Profile": "onenote",
    "RepairListItemValues": "smart|mergeStyled|renumber",
    "ListPaddingLeft": "1.2em",
    "UseTableSemantics": true,
    "TableHeaderFallback": true,
    "MigrateInlineStylesToUtilities": true,
    "InlineStyleMigrationSelector": "[style]",
    "InjectTailwindCss": true,
    "TailwindCssHref": "assets/tailwind-output.css",
    "ToolbarEnabled": false,
    "ToolbarEditToggleEnabled": false,
    "ToolbarMetadataToggleEnabled": false,
    "ToolbarBundleMode": "inline",
    "ConvertedPageThemeToggleEnabled": false,
    "imageMap": { "path": "data:...base64" }
  }
}
```

## Worker request (native OneNote, deferred design contract)
```json
{
  "id": "string",
  "type": "process-native-file",
  "fileName": "Test Section.one",
  "relativePath": "Test Section.one",
  "sourceKind": "one|onepkg",
  "bytes": "ArrayBuffer",
  "config": {
    "Profile": "onenote",
    "ToolbarEnabled": false,
    "ToolbarEditToggleEnabled": false,
    "ToolbarMetadataToggleEnabled": false,
    "ToolbarBundleMode": "inline"
  }
}
```

`process-native-file` is a deferred design contract for future native OneNote support. It is retained for planning and development reference only and is not used by the current stable app runtime:
- `one`: OneNote section (`*.one`)
- `onepkg`: OneNote notebook package (`*.onepkg`, CAB container)

Current stable-release behavior stops before this contract is reached: native `.one` / `.onepkg` files are surfaced as unsupported and are not sent through the shipped worker conversion path.

`Profile` is preferred for new integrations:
- `onenote`: enables the default OneNote semantic and layout helpers.

Toolbar flags are additive and optional:
- default OFF in all flows
- `ToolbarBundleMode` is currently `inline` only
- when disabled, output must remain parity-equivalent to baseline conversion output

Converted-page theme flags are additive and optional:
- default OFF in all flows
- HTML-only; non-HTML exports normalize the toggle flag to `false`
---
## Worker response (done)
```json
{
  "id": "string",
  "status": "done",
  "outputHtml": "string",
  "relativePath": "string",
  "logs": [ { "step": "...", "details": "..." } ]
}
```

## Worker response (done, native, deferred design contract)
```json
{
  "id": "string",
  "status": "done",
  "resultType": "native",
  "relativePath": "Test Section.one",
  "nativeResult": {
    "sourceKind": "one|onepkg",
    "hierarchy": {
      "kind": "section|notebook|folder|entry",
      "name": "string",
      "path": "string",
      "children": []
    },
    "pages": [
      { "name": "string", "path": "string", "html": "string" }
    ],
    "warningDetails": [
      { "code": "string", "severity": "info|warning|error", "message": "string" }
    ],
    "warnings": ["string"]
  },
  "logs": []
}
```

`warningDetails` is optional and additive; `warnings` remains the backward-compatible string array used by existing UI flows and tests.

Toolbar injection is optional and controlled by config; response shapes do not change when toolbar is enabled.

Current stable runtime behavior does not emit native `done` responses. Native `.one` / `.onepkg` inputs are surfaced as unsupported while importer work remains deferred. The response shape above is retained only as a non-shipped design/development contract for future native re-enablement.
---
## Results workbench contract

The redesigned Results surface is backed by a normalized workbench tree. This
contract defines the model independently of a particular renderer.

Each node has a stable ID, optional parent ID, kind, display name, relative
path, source kind, status, size, child IDs, and derived leaf counts. Node kinds
are `folder`, `notebook`, `section`, `page`, and `file`.

- A flat MHT/MHTML queue entry becomes a `file` leaf.
- A browser-provided relative path may create `folder` ancestors only. It must
  not be presented as OneNote notebook or section metadata.
- `notebook`, `section`, and `page` nodes require parser-derived native source
  metadata. The UI must not infer those identities from arbitrary file names.
- Parent size, leaf count, successful-leaf count, and status are derived from
  descendants. A mixed completed/unsupported result is `partial`; errors,
  working, and queued descendants take precedence in that order.
- Selection stores leaf IDs only. Parent checkboxes are derived as checked,
  mixed, or unchecked from descendant leaves.
- Search matches name, relative path, status, and message. Matching descendants
  keep all ancestors visible, while non-matching siblings stay hidden.
- Per-row download/remove actions apply to the represented leaf or documented
  descendant set. Bulk actions must not include unsupported, failed, or
  output-less leaves.

The current implementation maintains the normalized projection in parallel
with the existing flat renderer. The tree renderer, directory intake, search,
selection, and bulk actions are implemented in later milestones; their UI may
not claim behavior that is not yet connected to this contract.

Draft records written by the workbench-aware UI use schema version 2 and retain
`relativePath` per queue entry. Version-1 records without this field restore by
using the entry name as its relative path.

## Progress message
```json
{ "id":"string", "status":"progress", "step":"Sanitize", "percent":40 }
```

## UI dev hooks (debug/test contract)

The app currently exposes explicit browser-side dev hooks for local debugging and Playwright coverage:

- `window.__ONC_DEV_HOOKS.getRuntime()` returns the current UI runtime object.
- `window.__ONC_DEV_HOOKS.getWorkerManagerDiagnostics()` returns the current `WorkerManager` diagnostics buffer or an empty array.
- `window.__getRuntime()` and `window.__getWorkerManagerDiagnostics()` remain as legacy aliases for the same hooks while the test suite still references them directly.

Browser tests should prefer the shared harness helpers under `Tests/` instead of calling the legacy alias globals directly. The runtime harness in `Tests/playwright-runtime-harness.js` routes test-side runtime access through the documented `__ONC_DEV_HOOKS` contract, with a temporary fallback to the legacy aliases kept only for compatibility while the hooks remain shipped.

These hooks are not end-user features and should be treated as dev/test affordances only. They remain in the shipped build for the current release for local debugging and compatibility, but committed browser tests now go through the shared harness or the documented `__ONC_DEV_HOOKS` surface rather than depending on the legacy aliases directly.

## Toolbar Phase 0 reference

See `docs/Toolbar-Phase0-Spec.md` for the locked toolbar injection contract, idempotency rule, and day-one behavior boundaries.

For deferred OneNote tag parsing design notes, see `docs/OneNote Tag Parsing Research.md`.
