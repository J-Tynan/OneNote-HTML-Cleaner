# Toolbar Phase 0 Spec (Locked)

Status: Drafted for implementation handoff (Feb 2026)

This document is the implementation contract for the optional injected output toolbar.

## Scope and constraints

- Feature is opt-in, non-destructive, and reversible.
- Default behavior remains OFF for all conversion flows.
- Bundle mode is self-contained inline only (no runtime dependency on app assets).
- The implementation uses one toolbar container that hosts multiple advanced controls (no separate per-feature toolbars).
- Day-one controls include:
  - Edit mode toggle
  - Metadata panel toggle
  - Close/hide control

## Config contract (Phase 1 target)

Toolbar config keys (passed in worker request `config`):

- `ToolbarEnabled: boolean` (default `false`)
- `ToolbarEditToggleEnabled: boolean` (default `false`)
- `ToolbarMetadataToggleEnabled: boolean` (default `false`)
- `ToolbarBundleMode: "inline"` (default `"inline"`; only supported value in this phase)

## DOM contract

- Inject exactly one toolbar root element at top of `<body>`:
  - `id="onenote-cleaner-toolbar"`
  - `data-onc-toolbar="v1"`
- Toolbar must reserve space and avoid overlapping converted content.
- Toolbar markup and script must be namespaced under `onc-` prefixed classes/data attributes.

## Idempotency rule

- Injection is a no-op if a node matching both conditions exists:
  - `#onenote-cleaner-toolbar`
  - `data-onc-toolbar="v1"`
- Re-processing output must never duplicate toolbar container, inline style block, or inline script block.

## Day-one interaction contract

### Edit toggle

Edit mode is limited to text-focused nodes and must not alter structural semantics.

Allowed editable targets (initial):
- `p`
- `li`
- `td`

Excluded targets (initial):
- Heading tags (`h1`-`h6`)
- Section/layout wrappers (`main`, `section`, `table`, `thead`, `tbody`, `tr`)
- Semantic wrappers with `cornell-*` classes

Behavior:
- Toggle ON enables `contenteditable` only on allowed targets.
- Toggle OFF restores non-editable state.
- No irreversible transforms; no mutation of structural wrappers.

### Metadata panel toggle

Panel is read-only and only surfaces conversion provenance.

Initial fields:
- Source filename (when available)
- Source kind (`html|mht|one|onepkg` when available)
- Conversion profile (`cornell|generic`)
- Conversion timestamp (ISO 8601)
- Warning summary (count by severity, when available)

### Close/hide

- Close/hide control must hide toolbar for current document view.
- Behavior must be reversible within the same page session.
- Close action must not remove or mutate converted content.

## Integration touchpoints (Phase 1/2 coding)

- Config and payload plumbing:
  - `src/pipeline/config.js`
  - `src/ui.js`
  - `src/worker.js`
- Pipeline output injection:
  - `src/pipeline/pipeline.js`
- Native output injection:
  - `src/importers/one.js`
  - `src/importers/onepkg.js`

## Acceptance criteria for Phase 0 sign-off

- Contract is documented with no unresolved behavior ambiguities.
- Defaults OFF are explicit and consistent across docs/contracts.
- Idempotency and inline bundle rules are written as testable requirements.
- Out-of-scope list is explicit to prevent scope creep.

## Out of scope (day one)

- Additional tool actions beyond edit/metadata/close.
- OneNote round-trip export actions.
- Advanced accessibility auditing overlays.
- Multi-theme/view switching UI.
- Persistent cross-file toolbar preferences.