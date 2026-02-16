// src/ui-state.js
export function createStateHelpers(ctx) {
  const statusBadgeClasses = ctx.STATUS_BADGE_CLASSES || {
    queued: 'status-badge inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700',
    working: 'status-badge inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700',
    success: 'status-badge inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700',
    partial: 'status-badge inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700',
    error: 'status-badge inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700',
    unsupported: 'status-badge inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700'
  };

  const statusItemClasses = ctx.STATUS_ITEM_CLASSES || {
    queued: 'file-item rounded-xl border border-slate-200 bg-white p-4',
    working: 'file-item rounded-xl border border-sky-200 bg-sky-50 p-4',
    success: 'file-item rounded-xl border border-emerald-200 bg-emerald-50 p-4',
    partial: 'file-item rounded-xl border border-amber-200 bg-amber-50 p-4',
    error: 'file-item rounded-xl border border-rose-200 bg-rose-50 p-4',
    unsupported: 'file-item rounded-xl border border-rose-200 bg-rose-50 p-4'
  };

  const appStateBadgeClasses = ctx.APP_STATE_BADGE_CLASSES || {
    idle: 'inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700',
    queued: 'inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700',
    processing: 'inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700',
    completed: 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700',
    partial: 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700'
  };

  const importPrimaryClass = ctx.IMPORT_PRIMARY_CLASS || 'inline-flex w-full items-center justify-center rounded-lg bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2';
  const importSecondaryClass = ctx.IMPORT_SECONDARY_CLASS || 'inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2';
  const downloadPrimaryClass = ctx.DOWNLOAD_PRIMARY_CLASS || 'inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
  const downloadSecondaryClass = ctx.DOWNLOAD_SECONDARY_CLASS || 'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

  const STATUS_LABELS = {
    queued: 'Queued',
    working: 'Working',
    success: 'Done',
    partial: 'Partial',
    error: 'Error',
    unsupported: 'Unsupported'
  };

  function getCounts() {
    const items = Array.from(ctx.fileList.querySelectorAll('.file-item'));
    const counts = {
      total: items.length,
      queued: 0,
      working: 0,
      success: 0,
      partial: 0,
      error: 0,
      unsupported: 0
    };

    for (const item of items) {
      const status = item.dataset.status || 'queued';
      if (Object.prototype.hasOwnProperty.call(counts, status)) {
        counts[status] += 1;
      }
    }

    return counts;
  }

  function resolveAppState(counts) {
    if (counts.total > 0 && counts.working > 0) return { state: 'processing', badgeLabel: 'Processing' };
    if (counts.total > 0 && counts.success > 0 && (counts.partial > 0 || counts.error > 0 || counts.unsupported > 0)) {
      return { state: 'partial', badgeLabel: 'Needs review' };
    }
    if (counts.total > 0 && counts.success > 0) return { state: 'completed', badgeLabel: 'Completed' };
    if (counts.total > 0 && (counts.partial > 0 || counts.error > 0 || counts.unsupported > 0)) {
      return { state: 'partial', badgeLabel: 'Needs review' };
    }
    if (counts.total > 0) return { state: 'queued', badgeLabel: 'Queued' };
    return { state: 'idle', badgeLabel: 'Empty' };
  }

  function updateStateSummary() {
    const counts = getCounts();
    const { state, badgeLabel } = resolveAppState(counts);

    const warningCount = ctx.diagnostics.length;
    const hasWarnings = warningCount > 0;
    const showStatusPanel = state !== 'idle';
    const showDiagnostics = state === 'processing' || hasWarnings;
    const showWarningSummary = state === 'partial' || hasWarnings;

    if (ctx.statusPanel) {
      ctx.statusPanel.classList.toggle('hidden', !showStatusPanel);
      ctx.statusPanel.dataset.panelState = state;
      ctx.statusPanel.classList.remove('border-sky-300', 'bg-sky-50');
      if (state === 'processing') {
        ctx.statusPanel.classList.add('border-sky-300', 'bg-sky-50');
      }
    }

    if (ctx.controlsPanel) {
      ctx.controlsPanel.dataset.panelState = state;
      ctx.controlsPanel.classList.remove('opacity-100', 'opacity-90');
      ctx.controlsPanel.classList.add(state === 'idle' ? 'opacity-100' : 'opacity-90');
    }

    if (ctx.appStateBadge) {
      ctx.appStateBadge.className = appStateBadgeClasses[state] || appStateBadgeClasses.idle;
      ctx.appStateBadge.textContent = badgeLabel;
    }

    if (ctx.statusSummary) {
      if (counts.total === 0) {
        ctx.statusSummary.textContent = 'No files in queue yet. Import files to begin.';
      } else if (counts.working > 0) {
        ctx.statusSummary.textContent = `Processing ${counts.working} of ${counts.total} file(s).`;
      } else if (state === 'queued') {
        ctx.statusSummary.textContent = `${counts.total} file(s) queued and ready for processing.`;
      } else {
        ctx.statusSummary.textContent = `Processed ${counts.total} file(s): ${counts.success} complete, ${counts.partial} partial, ${counts.error + counts.unsupported} failed/unsupported.`;
      }
    }

    if (ctx.statusHelp) {
      ctx.statusHelp.textContent = counts.working > 0
        ? 'High-level progress is shown here while details stay collapsed unless needed.'
        : 'Use per-file actions below to download outputs and review any issues.';
    }

    if (ctx.importStateText) {
      ctx.importStateText.textContent = counts.total === 0
        ? 'Start by adding one or more files to the conversion queue.'
        : `${counts.total} file(s) in this session. Add more files any time.`;
    }

    if (ctx.warningSummary) {
      ctx.warningSummary.classList.toggle('hidden', !showWarningSummary);
      if (showWarningSummary) {
        ctx.warningSummary.textContent = hasWarnings
          ? `${warningCount} warning(s) detected. Review details only if needed.`
          : 'Some files need review. Expand diagnostics for details.';
      }
    }

    if (ctx.diagnosticsPanel) {
      ctx.diagnosticsPanel.classList.toggle('hidden', !showDiagnostics);
      if (showDiagnostics && state === 'processing' && !ctx.diagnosticsPanel.hasAttribute('open')) {
        ctx.diagnosticsPanel.removeAttribute('open');
      }
    }

    if (ctx.diagnosticsSummaryText) {
      ctx.diagnosticsSummaryText.textContent = counts.working > 0
        ? `Queue: ${counts.total} total · ${counts.working} processing · ${counts.success + counts.partial + counts.error + counts.unsupported} resolved`
        : `Queue complete: ${counts.success} successful · ${counts.partial} partial · ${counts.error + counts.unsupported} failed/unsupported`;
    }

    const downloadCanBePrimary = state === 'completed' || state === 'partial';
    if (ctx.downloadZipButton) {
      ctx.downloadZipButton.className = downloadCanBePrimary ? downloadPrimaryClass : downloadSecondaryClass;
    }
    if (ctx.importManyButton) {
      ctx.importManyButton.className = downloadCanBePrimary ? importSecondaryClass : importPrimaryClass;
    }
    if (ctx.importSingleButton) {
      ctx.importSingleButton.className = importSecondaryClass;
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function addListItem(name, id) {
    const el = document.createElement('div');
    el.className = statusItemClasses.queued;
    el.dataset.id = id;
    el.dataset.status = 'queued';
    el.innerHTML = `<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div class="min-w-0"><p class="truncate text-sm font-semibold text-slate-900">${escapeHtml(name)}</p><p class="status-text mt-1 text-sm text-slate-600">Queued for processing.</p></div><span class="${statusBadgeClasses.queued}">Queued</span></div><div class="item-content mt-3 space-y-3"></div><div class="item-actions mt-3 flex flex-wrap gap-2"></div>`;
    ctx.fileList.appendChild(el);
    applyFilters();
    applyCollapse();
    updateStateSummary();
    return el;
  }

  function applyFilters() {
    if (!ctx.filterFailures) return;
    const showOnlyFailures = ctx.filterFailures.checked;
    const items = ctx.fileList.querySelectorAll('.file-item');
    for (const item of items) {
      const status = item.dataset.status || 'queued';
      const isFailure = ctx.FAILURE_STATES.has(status);
      item.style.display = (!showOnlyFailures || isFailure) ? '' : 'none';
    }
  }

  function applyCollapse() {
    if (!ctx.collapseStatus) return;
    const isCollapsed = ctx.collapseStatus.checked;
    const details = ctx.fileList.querySelectorAll('.status-text');
    for (const detail of details) {
      detail.classList.toggle('hidden', isCollapsed);
    }
  }

  function setStatus(li, state, detail) {
    const badge = li.querySelector('.status-badge');
    const text = li.querySelector('.status-text');
    if (!badge || !text) return;

    badge.className = statusBadgeClasses[state] || statusBadgeClasses.queued;
    badge.textContent = STATUS_LABELS[state] || state;
    text.textContent = detail || '';
    li.className = statusItemClasses[state] || statusItemClasses.queued;
    li.dataset.status = state;
    applyCollapse();
    applyFilters();
    updateStateSummary();
  }

  function updateZipButton() {
    if (!ctx.downloadZipButton) return;
    ctx.downloadZipButton.disabled = ctx.successfulOutputs.size === 0;
  }

  return {
    updateStateSummary,
    addListItem,
    applyFilters,
    applyCollapse,
    setStatus,
    updateZipButton
  };
}
