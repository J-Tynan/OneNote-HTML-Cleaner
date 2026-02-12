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
---
## Progress message
```json
{ "id":"string", "status":"progress", "step":"Sanitize", "percent":40 }
```
