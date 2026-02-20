# Logging — schema and guidelines

Purpose
- Provide a small, consistent, and non-throwing logging contract for `ui`, `worker-wrapper`, and `worker` code.
- Make logs machine-friendly (JSON-like) while remaining human-readable in the console.

Schema (recommended fields)
- `ts` (string) — ISO timestamp, e.g. `2026-02-20T12:34:56.789Z`
- `source` (string) — one of: `ui`, `worker-wrapper`, `worker`
- `level` (string) — `debug` | `info` | `warn` | `error`
- `id` (string, optional) — correlation id (message id / op id)
- `type` (string, optional) — message type or diagnostic kind
- `msg` (string) — short human message
- `meta` (object, optional) — small structured data for correlation (keep small)
- `preview` (string, optional) — safe, truncated preview of large payloads

Human-friendly prefix
- Use a concise console prefix for quick scanning:  `[source] LEVEL ts id=<id> — msg (preview)`

Examples
- JSON-like (for machines / structured sinks):

  { "ts":"2026-02-20T12:34:56.789Z", "source":"worker-wrapper", "level":"warn", "id":"init", "type":"unmatched-message", "msg":"Unmatched worker message", "meta": { "pendingCallbacks":0 }, "preview":"status=error" }

- Console-friendly:

  [worker-wrapper] WARN 2026-02-20T12:34:56.789Z id=init — Unmatched worker message — status=error

Best practices
- Use the centralized `src/logging.js` helper rather than calling `console.*` directly.
- Never log full binary or extremely large payloads; use `preview` instead.
- Keep `meta` small and serializable; the helper will safely truncate or fall back if needed.
- Logging must not throw or block the worker — helpers must be wrapped in try/catch.
- Use `id` where available to correlate UI ↔ wrapper ↔ worker messages.

Worker diagnostics
- Worker code should continue to use `postDiagnostic()` for structured in-band diagnostics; the wrapper will surface these in the UI.
- Diagnostic postings should follow the same `level`/`msg`/`meta` conventions when possible.

Migration notes for tests
- Prefer asserting UI content or diagnostics UI state instead of matching raw `console` text.
- Update Playwright tests to check the diagnostics panel or use the structured schema for assertions.

Files to update when adopting this scheme
- `src/logging.js` (new helper)
- `src/ui.js` (use helper)
- `src/worker-wrapper.js` (use helper)
- `src/worker-globals.js` / `src/worker.js` (ensure diagnostics follow schema)
- `Tests/*` (update expectations where tests depended on raw console output)

Non-goals
- This is intentionally small and framework-agnostic — not a full telemetry SDK.

"Do not introduce" rule
- Do not add logging helpers that can throw or synchronously stringify very large payloads.
