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
- `ToolbarStyle: "compact" | "classic"` (default `"compact"`; invalid values fall back to `"compact"`)

## Toolbar preset contract (Slice A)

- Toolbar styling is preset-based, but toolbar markup and script behavior remain shared.
- Slice A ships two HTML-only presets:
  - `compact` — default fallback and smallest general-purpose toolbar skin.
  - `classic` — denser, Office-97-inspired toolbar chrome.
- Only the selected preset's CSS may be embedded in converted output.
- Additional presets such as Ribbon Lite, Mac, or Linux remain out of scope for this slice.

## DOM contract

- Inject exactly one toolbar root element at top of `<body>`:
  - `id="onenote-cleaner-toolbar"`
  - `data-onc-toolbar="v1"`
  - `data-onc-toolbar-preset="compact|classic"`
- Toolbar must reserve space and avoid overlapping converted content.
- Toolbar markup and script must be namespaced under `onc-` prefixed classes/data attributes.
- Inject exactly one inline toolbar style block carrying both the toolbar version marker and the selected preset marker.

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
- Semantic wrappers marked with table/column role metadata

Behavior:
- Toggle ON enables `contenteditable` only on allowed targets.
- Toggle OFF restores non-editable state.
- No irreversible transforms; no mutation of structural wrappers.

### Metadata panel toggle

Panel is read-only and only surfaces conversion provenance.

Initial fields:
- Source filename (when available)
- Source kind (`html|mht|one|onepkg` when available)
- Page title (when available)
- Export format (`html|markdown`)
- Conversion timestamp (ISO 8601)

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
- Additional toolbar skins beyond `compact` and `classic`.