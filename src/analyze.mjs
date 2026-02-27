// analyze.mjs — compute aggregate stats from sessions array
export function analyze(sessions, { projectSessions = [], redact = true } = {}) {
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
    .slice(0, 5)
    .map(([k, v], i) => [
      redact ? `file-${i + 1}${k.match(/\.[^.]+$/)?.[0] || ''}` : k,
      v,
    ]);

  // Unique tool count
  const uniqueToolCount = Object.keys(toolTotals).length;

  // Unique file extensions (from raw filenames, before redaction)
  const extSet = new Set();
  for (const fname of Object.keys(fileTotals)) {
    const ext = fname.match(/\.[^.]+$/)?.[0];
    if (ext) extSet.add(ext.toLowerCase());
  }
  const uniqueExtensions = extSet.size;

  // Total unique files edited (pre-redaction)
  const totalFilesEdited = Object.keys(fileTotals).length;

  // Total API errors across all sessions
  const totalApiErrors = sessions.reduce((s, x) => s + x.apiErrors, 0);

  // Longest single session by message count
  const maxSessionMsgs = sessions.reduce(
    (max, s) => Math.max(max, s.userMessages + s.assistantMessages), 0
  );

  // Most intense session (most compacts)
  const spikeSession = [...sessions].sort((a, b) => b.compacts - a.compacts)[0];

  // Slim session data for chart (keep small)
  const slim = sessions.map((s, i) => ({
    id:       s.id,
    slug:     redact ? null : s.slug,
    compacts: s.compacts,
    sizeMB:   +(s.fileSizeBytes / 1024 / 1024).toFixed(2),
    msgs:     s.userMessages + s.assistantMessages,
    positions: s.compactPositions,
    turns:    s.turnDurations,
    start:    s.startTime,
  }));

  // ── Per-project breakdown ─────────────────────────────────────────────────
  const projects = projectSessions.length > 1
    ? projectSessions
        .map(({ name, sessions: ps }, i) => {
          const displayName = redact ? `Project ${String.fromCharCode(65 + i)}` : name;
          const msgs   = ps.reduce((s, x) => s + x.userMessages + x.assistantMessages, 0);
          const resets = ps.reduce((s, x) => s + x.compacts, 0);
          const lines  = ps.reduce((s, x) => s + x.linesWritten, 0);
          const cmMs   = ps.flatMap(x => x.turnDurations).reduce((a, b) => a + b, 0);
          const tmap   = {};
          for (const s of ps) for (const [k, v] of Object.entries(s.toolCalls)) tmap[k] = (tmap[k] || 0) + v;
          const topTool = Object.entries(tmap).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
          return { name: displayName, sessions: ps.length, messages: msgs, compacts: resets, lines, computeHrs: +(cmMs / 3600000).toFixed(1), topTool };
        })
        .sort((a, b) => b.messages - a.messages)
    : [];

  // ── Time-of-day distribution (from session start times) ──────────────────
  const messagesByHour = new Array(24).fill(0);
  for (const s of sessions) {
    if (s.startTime) {
      const h = new Date(s.startTime).getHours();
      messagesByHour[h] += (s.userMessages + s.assistantMessages);
    }
  }

  // ── Day-of-week distribution (Mon=0 … Sun=6) ─────────────────────────────
  const messagesByDow = new Array(7).fill(0);
  for (const s of sessions) {
    if (s.startTime) {
      const d   = new Date(s.startTime).getDay(); // 0=Sun
      const mon = (d + 6) % 7;                    // shift to Mon=0
      messagesByDow[mon] += (s.userMessages + s.assistantMessages);
    }
  }

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
    projects,
    messagesByHour,
    messagesByDow,
    uniqueToolCount,
    uniqueExtensions,
    totalFilesEdited,
    totalApiErrors,
    maxSessionMsgs,
  };
}
