# Contracts

## Pipeline invariants
- Preserve original text spacing and line breaks.
- Remove all non-breaking spaces (convert to regular spaces).
- Preserve widths, table structure, alignment, list numbering, and inline images.
- Keep HTML structure stable unless a specific repair rule requires adjustment.
- Optional migration may convert safe inline typography/margins to utility classes.

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
    "imageMap": { "path": "data:...base64" }
  }
}
```

## Worker request (native OneNote, deferred)
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

`process-native-file` is a deferred contract for future native OneNote support. It is not used by the current stable app runtime:
- `one`: OneNote section (`*.one`)
- `onepkg`: OneNote notebook package (`*.onepkg`, CAB container)

`Profile` is preferred for new integrations:
- `onenote`: enables the default OneNote semantic and layout helpers.

Toolbar flags are additive and optional:
- default OFF in all flows
- `ToolbarBundleMode` is currently `inline` only
- when disabled, output must remain parity-equivalent to baseline conversion output
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

## Worker response (done, native, deferred)
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

Current stable runtime behavior does not emit native `done` responses. Native `.one` / `.onepkg` inputs are surfaced as unsupported while importer work remains deferred. The response shape above is retained only as a design/development contract for future native re-enablement.
---
## Progress message
```json
{ "id":"string", "status":"progress", "step":"Sanitize", "percent":40 }
```

## Toolbar Phase 0 reference

See `docs/Toolbar-Phase0-Spec.md` for the locked toolbar injection contract, idempotency rule, and day-one behavior boundaries.
