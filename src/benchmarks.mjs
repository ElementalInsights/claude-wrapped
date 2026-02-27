// benchmarks.mjs — community baselines + Steam-style achievement unlocks
//
// Baselines are estimated 2026 community averages for active Claude Code users.
// Sources: Portkey Claude Code analysis, Stack Overflow Dev Survey 2025,
//          GitHub Copilot usage reports, general developer AI statistics.
//
// Update these as better data becomes available.

export const BASELINES = {
  note:               'Estimated 2026 community averages — active Claude Code users',
  msgsPerDay:         50,     // ~10-40 prompts/session × ~1.5 sessions/day
  compactsPerSession: 3,      // typical 30-45min session at moderate code complexity
  totalLinesTypical:  5_000,  // lines written across a casual project
  computeHrsTypical:  15,     // total AI compute hours for a typical project
  spikeResetsTypical: 8,      // hardest single session for a casual user
  activeDayRatio:     0.49,   // 3.4 active days/week ÷ 7 (from Copilot survey proxy)
  maxTurnMinTypical:  3,      // longest single turn in minutes
};

const TIER_META = {
  bronze:   { label: 'Bronze',   color: '#cd7f32', glow: 'rgba(205,127,50,0.15)' },
  silver:   { label: 'Silver',   color: '#9ea0a5', glow: 'rgba(158,160,165,0.15)' },
  gold:     { label: 'Gold',     color: '#ffd700', glow: 'rgba(255,215,0,0.12)' },
  platinum: { label: 'Platinum', color: '#b9f2ff', glow: 'rgba(185,242,255,0.18)' },
};

function tier(val, [bronze, silver, gold, platinum]) {
  if (val >= platinum) return 'platinum';
  if (val >= gold)     return 'gold';
  if (val >= silver)   return 'silver';
  if (val >= bronze)   return 'bronze';
  return null;
}

function badge(key) {
  return TIER_META[key];
}

export function getAchievements(stats) {
  const achievements = [];

  // Derived stats
  const totalComputeHrs  = stats.totalComputeMs / 3_600_000;
  const compactsPerSess  = stats.sessionCount > 0
    ? stats.totalCompacts / stats.sessionCount : 0;

  // Active day count from slim session data
  const activeDates = new Set(
    (stats.slim || []).filter(s => s.start).map(s => s.start.split('T')[0])
  );
  const activeDays      = activeDates.size;
  const activeDayRatio  = stats.spanDays > 0 ? activeDays / stats.spanDays : 0;
  const maxTurnMin      = stats.maxTurnMs / 60_000;

  function push(t, obj) {
    if (!t) return;
    const m = badge(t);
    achievements.push({ ...obj, tier: t, tierLabel: m.label, tierColor: m.color, tierGlow: m.glow });
  }

  // ── 1. The Conversationalist — messages per day ───────────────────────────
  push(tier(stats.msgsPerDay, [75, 160, 400, 800]), {
    id:      'msgs',
    name:    'The Conversationalist',
    emoji:   '💬',
    stat:    `${stats.msgsPerDay.toLocaleString()} msgs / day`,
    flavor:  `${Math.round(stats.msgsPerDay / BASELINES.msgsPerDay)}× the typical dev's daily message volume.`,
    baseline:`Community avg: ~${BASELINES.msgsPerDay} msgs/day`,
  });

  // ── 2. Goldfish Mode — total context resets ───────────────────────────────
  push(tier(stats.totalCompacts, [50, 200, 500, 1_000]), {
    id:      'resets',
    name:    'Goldfish Mode',
    emoji:   '🧠',
    stat:    `${stats.totalCompacts.toLocaleString()} resets`,
    flavor:  `Claude forgot everything ${stats.totalCompacts} times. You just kept going.`,
    baseline:`Community avg: ~${BASELINES.compactsPerSession * 15} resets per project`,
  });

  // ── 3. Ghost Writer — total lines written ────────────────────────────────
  const wpNovels = (stats.totalLines / 116_000).toFixed(1);  // War & Peace ≈ 116k lines
  push(tier(stats.totalLines, [10_000, 50_000, 100_000, 500_000]), {
    id:      'lines',
    name:    'Ghost Writer',
    emoji:   '✍️',
    stat:    `${stats.totalLines.toLocaleString()} lines`,
    flavor:  parseFloat(wpNovels) >= 0.5
      ? `That's ~${wpNovels} War & Peace novel${wpNovels !== '1.0' ? 's' : ''} worth of code.`
      : `${(stats.totalLines / BASELINES.totalLinesTypical).toFixed(0)}× a typical casual project.`,
    baseline:`Community avg: ~${BASELINES.totalLinesTypical.toLocaleString()} lines`,
  });

  // ── 4. The Grind — total AI compute hours ────────────────────────────────
  const computeLabel = totalComputeHrs >= 24
    ? `${(totalComputeHrs / 24).toFixed(1)} full days`
    : `${totalComputeHrs.toFixed(0)} hours`;
  push(tier(totalComputeHrs, [20, 75, 150, 500]), {
    id:      'compute',
    name:    'The Grind',
    emoji:   '⚙️',
    stat:    `${totalComputeHrs.toFixed(0)}h AI compute`,
    flavor:  `${computeLabel} of pure model thinking time. Not wall clock — actual compute.`,
    baseline:`Community avg: ~${BASELINES.computeHrsTypical}h for a typical project`,
  });

  // ── 5. The Siege — hardest single session ────────────────────────────────
  push(tier(stats.spikeSession.compacts, [10, 20, 40, 75]), {
    id:      'siege',
    name:    'The Siege',
    emoji:   '🔥',
    stat:    `${stats.spikeSession.compacts} resets, 1 session`,
    flavor:  `Claude lost its memory ${stats.spikeSession.compacts} times mid-battle. You didn't stop.`,
    baseline:`Community avg: ~${BASELINES.spikeResetsTypical} resets in a hard session`,
  });

  // ── 6. Daily Driver — consistency ────────────────────────────────────────
  push(tier(activeDayRatio, [0.40, 0.55, 0.70, 0.86]), {
    id:      'daily',
    name:    'Daily Driver',
    emoji:   '📅',
    stat:    `${Math.round(activeDayRatio * 100)}% of days active`,
    flavor:  `${activeDays} of ${stats.spanDays} days had at least one session. That's commitment.`,
    baseline:`Community avg: ~49% of days (3.4/7 days/week)`,
  });

  // ── 7. Deep Thinker — longest single AI turn ─────────────────────────────
  push(tier(maxTurnMin, [5, 15, 30, 60]), {
    id:      'turn',
    name:    'Deep Thinker',
    emoji:   '⏱️',
    stat:    `${maxTurnMin.toFixed(1)} min longest turn`,
    flavor:  `Claude thought for ${maxTurnMin.toFixed(0)} minutes without stopping. That's a whole standup.`,
    baseline:`Community avg: ~${BASELINES.maxTurnMinTypical} min typical longest turn`,
  });

  // Sort: platinum → gold → silver → bronze
  const order = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
  achievements.sort((a, b) => order[a.tier] - order[b.tier]);

  return achievements;
}
