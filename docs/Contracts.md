# Contracts

## Pipeline invariants
- Preserve original text spacing and line breaks.
- Remove all non-breaking spaces (convert to regular spaces).
- Preserve fonts, sizes, tables, alignment, list numbering, and inline images.
- Keep HTML structure stable unless a specific repair rule requires adjustment.

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
