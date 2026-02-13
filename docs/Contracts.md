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
    "Profile": "cornell|generic",
    "RepairListItemValues": "smart|mergeStyled|renumber",
    "ListPaddingLeft": "1.2em",
    "UseCornellSemantics": true,
    "CornellHeaderFallback": true,
    "MigrateInlineStylesToUtilities": true,
    "InlineStyleMigrationSelector": "[style]",
    "InjectTailwindCss": true,
    "TailwindCssHref": "assets/tailwind-output.css",
    "imageMap": { "path": "data:...base64" }
  }
}
```

## Worker request (native OneNote)
```json
{
  "id": "string",
  "type": "process-native-file",
  "fileName": "Test Section.one",
  "relativePath": "Test Section.one",
  "sourceKind": "one|onepkg",
  "bytes": "ArrayBuffer",
  "config": {
    "Profile": "cornell|generic"
  }
}
```

`process-native-file` is the binary-safe path for OneNote native containers:
- `one`: OneNote section (`*.one`)
- `onepkg`: OneNote notebook package (`*.onepkg`, CAB container)

`Profile` is preferred for new integrations:
- `cornell`: enables Cornell-specific semantic and layout helpers.
- `generic`: conservative OneNote cleanup with Cornell-specific transforms disabled.

Legacy flags remain supported and can override profile defaults.
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

## Worker response (done, native)
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

Phase-1 implementation validates native signatures and returns hierarchy plus generated downloadable pages (heuristic for `.one`). For `.onepkg`, the importer parses CAB metadata, attempts section-byte extraction for uncompressed folders, and falls back to placeholders for compressed folders (for example `lzx`). Full page-content extraction for compressed section payloads is staged next.
---
## Progress message
```json
{ "id":"string", "status":"progress", "step":"Sanitize", "percent":40 }
```
