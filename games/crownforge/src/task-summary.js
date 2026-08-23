function readableTask(unit) {
  const action = typeof unit?.actionLabel === 'string' ? unit.actionLabel.trim() : '';
  const ready = unit?.command === 'idle' && (!action || action.toLowerCase() === 'idle');
  return ready ? { label: 'ready', ready: true } : { label: action || 'Awaiting orders', ready: false };
}

export function summarizeUnitTasks(units, { includeReady = true, maxEntries = 3 } = {}) {
  const eligible = Array.isArray(units) ? units.filter(Boolean) : [];
  if (!eligible.length) return '';

  const grouped = new Map();
  let readyCount = 0;
  for (const unit of eligible) {
    const task = readableTask(unit);
    if (task.ready) {
      readyCount += 1;
      continue;
    }
    grouped.set(task.label, (grouped.get(task.label) ?? 0) + 1);
  }

  const entries = [...grouped.entries()].map(([label, count]) => ({ label, count }));
  if (includeReady && readyCount) entries.push({ label: 'ready', count: readyCount });
  if (!entries.length) return includeReady ? `${eligible.length} units ready.` : '';
  if (entries.length === 1 && entries[0].label === 'ready') return `${eligible.length} units ready.`;

  const representedCount = entries.reduce((sum, entry) => sum + entry.count, 0);
  const safeLimit = Math.max(2, Math.floor(maxEntries));
  const visibleLimit = entries.length > safeLimit ? safeLimit - 1 : safeLimit;
  const visible = entries.slice(0, visibleLimit);
  const hidden = entries.slice(visibleLimit);
  const parts = visible.map((entry) => entries.length === 1 ? entry.label : `${entry.count} ${entry.label}`);
  if (hidden.length) {
    const hiddenCount = hidden.reduce((sum, entry) => sum + entry.count, 0);
    parts.push(`${hiddenCount} on ${hidden.length} more task${hidden.length === 1 ? '' : 's'}`);
  }

  const prefixCount = includeReady ? eligible.length : representedCount;
  return `${prefixCount} ${includeReady ? 'units' : 'active'} · ${parts.join(' · ')}`;
}
