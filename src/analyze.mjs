// analyze.mjs — compute aggregate stats from sessions array
export function analyze(sessions) {
  const totalMessages   = sessions.reduce((s, x) => s + x.userMessages + x.assistantMessages, 0);
  const totalCompacts   = sessions.reduce((s, x) => s + x.compacts, 0);
  const totalBytes      = sessions.reduce((s, x) => s + x.fileSizeBytes, 0);
  const totalGB         = totalBytes / 1024 / 1024 / 1024;
  const totalMB         = totalBytes / 1024 / 1024;
  const totalLines      = sessions.reduce((s, x) => s + x.linesWritten, 0);
  const allTurns        = sessions.flatMap(x => x.turnDurations);
  const avgTurnMs       = allTurns.length ? allTurns.reduce((a, b) => a + b, 0) / allTurns.length : 0;
  const maxTurnMs       = allTurns.length ? Math.max(...allTurns) : 0;
  const totalComputeMs  = allTurns.reduce((a, b) => a + b, 0);

  // Date range
  const starts  = sessions.map(s => s.startTime).filter(Boolean).sort();
  const ends    = sessions.map(s => s.endTime).filter(Boolean).sort();
  const firstDay = starts[0] ? new Date(starts[0]) : null;
  const lastDay  = ends[ends.length - 1] ? new Date(ends[ends.length - 1]) : null;
  const spanDays = firstDay && lastDay
    ? Math.max(1, Math.round((lastDay - firstDay) / 86400000))
    : 1;

  // Per-day averages
  const msgsPerDay     = totalMessages / spanDays;
  const compactsPerDay = totalCompacts / spanDays;
  const mbPerDay       = totalMB / spanDays;
  const computeHrsDay  = (totalComputeMs / spanDays) / 3600000;

  // Tool call totals
  const toolTotals = {};
  for (const s of sessions) {
    for (const [k, v] of Object.entries(s.toolCalls)) {
      toolTotals[k] = (toolTotals[k] || 0) + v;
    }
  }
  const topTools = Object.entries(toolTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Most-edited files
  const fileTotals = {};
  for (const s of sessions) {
    for (const [k, v] of Object.entries(s.filesEdited)) {
      fileTotals[k] = (fileTotals[k] || 0) + v;
    }
  }
  const topFiles = Object.entries(fileTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Most intense session (most compacts)
  const spikeSession = [...sessions].sort((a, b) => b.compacts - a.compacts)[0];

  // Slim session data for chart (keep small)
  const slim = sessions.map(s => ({
    id:       s.id,
    slug:     s.slug,
    compacts: s.compacts,
    sizeMB:   +(s.fileSizeBytes / 1024 / 1024).toFixed(2),
    msgs:     s.userMessages + s.assistantMessages,
    positions: s.compactPositions,
    turns:    s.turnDurations,
    start:    s.startTime,
  }));

  return {
    sessionCount:  sessions.length,
    totalMessages,
    totalCompacts,
    totalGB:       +totalGB.toFixed(2),
    totalMB:       +totalMB.toFixed(1),
    totalLines,
    avgTurnMs:     Math.round(avgTurnMs),
    maxTurnMs,
    totalComputeMs,
    msgsPerDay:    Math.round(msgsPerDay),
    compactsPerDay:+compactsPerDay.toFixed(1),
    mbPerDay:      +mbPerDay.toFixed(1),
    computeHrsDay: +computeHrsDay.toFixed(1),
    spanDays,
    firstDay:      firstDay?.toISOString().split('T')[0] || '',
    lastDay:       lastDay?.toISOString().split('T')[0]  || '',
    topTools,
    topFiles,
    spikeSession: {
      compacts: spikeSession?.compacts || 0,
      sizeMB:   +((spikeSession?.fileSizeBytes || 0) / 1024 / 1024).toFixed(1),
      slug:     spikeSession?.slug || '',
    },
    slim,
  };
}
