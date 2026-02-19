## Worker Handshake and Diagnostic Schema

This page documents the startup handshake between the main thread (`WorkerManager` / wrapper) and the worker (`src/worker.js`), the primary message types used during initialization and job processing, and the structured diagnostic shape used to report failures.

**Overview**
- The wrapper creates the `Worker` but does not assume the worker is ready immediately.
- After installing `onmessage`/`onerror` handlers the wrapper posts an explicit initialization request:

  - `{ type: 'init', options?: { ... } }`

- The worker performs all heavy setup and lazy/dynamic imports inside `init()` and then posts a deterministic ready handshake:

  - Worker -> Wrapper: `{ type: 'ready', id: 'init', timestamp, hasDOMParser }`

- The wrapper buffers any job payloads until it receives the `ready` message. If the handshake times out the wrapper emits a reserved diagnostic and deterministically rejects queued jobs.

**Primary message types**
- `init` (wrapper -> worker): request worker to run `init()` and perform lazy imports.
- `ready` (worker -> wrapper): worker signals initialization complete and ready to accept jobs.
- Job payloads (wrapper -> worker): conversion requests. Expected reply messages from worker include:
  - `status: 'progress'` — progress update
  - `status: 'done'` — job finished successfully (includes `outputHtml` and `logs`)
  - `status: 'error'` — job failed (includes `error` string)
  - `status: 'unsupported'` — worker cannot run the requested flow (wrapper may fallback to main-thread processing)

**Diagnostic channel and reserved IDs**
- The wrapper and worker use structured diagnostics (via `postDiagnostic()` in `src/worker-globals.js`). Diagnostic messages are intentionally compact and machine-readable.
- Reserved diagnostic example for handshake timeout (emitted by wrapper):

  ```json
  {
    "id": "__diag__",
    "type": "handshake-timeout",
    "timestamp": 1670000000000,
    "pendingCount": 2,
    "workerUrl": "https://.../src/worker.js",
    "timeoutMs": 5000
  }
  ```

**Diagnostic schema (commonly used fields)**
- `id`: string — identifier for the diagnostic or job (use `__diag__` for wrapper-level diagnostics).
- `type`: string — diagnostic type (e.g., `handshake-timeout`, `init-error`, `import-failure`, `job-error`).
- `timestamp`: number — epoch ms when diagnostic was produced.
- `workerUrl`: string — resolved URL of the worker script (useful for correlating versions).
- `workerHash` (optional): string — optional short hash of the worker file if available.
- `status`: string — `error`/`warning`/`info` classification for the diagnostic.
- `phase`: string — lifecycle phase where the diagnostic occurred (`init`, `init-imports`, `job`).
- `error`: string — human-readable error message.
- `stack`: string — optional stack trace when available.
- `details`: any — optional structured payload with additional context (e.g., import failures list).

**Failure handling guidance**
- Worker import/init failures:
  - The worker should catch import or initialization exceptions and call `postDiagnostic({ id: 'init', status: 'error', phase: 'init', error, stack, details })` before returning/throwing.
  - The worker should still avoid throwing synchronously during module import; dynamic imports should be inside `init()`.
- Wrapper handshake timeout:
  - If the wrapper's handshake timer expires, it emits the reserved `__diag__` diagnostic and rejects queued payloads with a deterministic error object `{ id, status: 'error', error: 'Worker handshake timeout' }`.

**Testing notes**
- Add Playwright tests that assert ordering: wrapper sends `init` → worker posts `ready` → wrapper posts job messages. The existing `Tests/worker-init-playwright.js` covers this flow.
- Add an init-failure test that forces a dynamic-import rejection (or injects a failing stub) and asserts the worker posts a diagnostic with `phase: 'init-imports'` and that the wrapper rejects queued jobs.

**Quick example: sequence**
- Wrapper creates worker, installs handlers, posts `{ type: 'init' }`.
- Worker receives `init`, runs `init()`:
  - dynamic imports pipeline modules
  - on success -> `postMessage({ type: 'ready', id: 'init', timestamp, hasDOMParser })`
  - on import failure -> `postDiagnostic({ id: 'init', status: 'error', phase: 'init-imports', details: [...] })`
- Wrapper receives `ready`, flushes queued jobs to worker.

Keep this doc updated if diagnostic fields or handshake timing change.
