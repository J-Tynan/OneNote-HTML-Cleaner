// src/ui-diagnostics.js
export function createDiagnosticsHelpers(ctx, updateStateSummary) {
  const normalizeLevel = (level) => String(level || '').toLowerCase();

  function recordDiagnostic(fileName, message, severity = 'warning') {
    if (!ctx.diagnosticsList || !ctx.diagnosticsCount) return;
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) return;

    const entry = {
      fileName: String(fileName || 'Unknown file'),
      message: normalizedMessage,
      severity: String(severity || 'warning')
    };
    ctx.diagnostics.push(entry);

    const item = document.createElement('li');
    const level = entry.severity.toUpperCase();
    item.textContent = `[${level}] ${entry.fileName}: ${entry.message}`;
    ctx.diagnosticsList.appendChild(item);
    ctx.diagnosticsCount.textContent = `(${ctx.diagnostics.length})`;
    updateStateSummary();
  }

  function addDiagnosticsFromMessages(fileName, messages, severity = 'warning') {
    for (const message of messages) {
      recordDiagnostic(fileName, message, severity);
    }
  }

  function addDiagnosticsFromLogs(fileName, logs) {
    const warningLogs = logs.filter((item) => ctx.WARNING_LEVELS.has(normalizeLevel(item && item.level)));
    for (const logItem of warningLogs) {
      const level = normalizeLevel(logItem && logItem.level);
      const message = String(logItem && (logItem.message || logItem.text || logItem.code)
        ? (logItem.message || logItem.text || logItem.code)
        : 'Conversion warning reported');
      recordDiagnostic(fileName, message, level === 'error' ? 'error' : 'warning');
    }
    return warningLogs.length > 0;
  }

  return {
    recordDiagnostic,
    addDiagnosticsFromMessages,
    addDiagnosticsFromLogs
  };
}
