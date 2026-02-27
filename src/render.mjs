// render.mjs — generate self-contained index.html
export function render(stats, comparisons, config, achievements = []) {
  const { sessionCount, totalMessages, totalCompacts, totalGB, totalLines,
          msgsPerDay, compactsPerDay, mbPerDay, computeHrsDay,
          avgTurnMs, maxTurnMs, spanDays, firstDay, lastDay,
          topTools, topFiles, spikeSession, slim } = stats;

  const projects       = stats.projects       || [];
  const messagesByHour = stats.messagesByHour || new Array(24).fill(0);
  const messagesByDow  = stats.messagesByDow  || new Array(7).fill(0);

  const projectName = config.project || 'My Project';
  const author      = config.author  || '';
  const tagline     = config.tagline || `${sessionCount} sessions. ${totalCompacts} context resets. ${totalLines.toLocaleString()} lines written.`;
  const avgTurnMin  = (avgTurnMs / 60000).toFixed(1);
  const maxTurnMin  = (maxTurnMs / 60000).toFixed(1);

  const dateRange = firstDay && lastDay ? `${firstDay} → ${lastDay}` : '';

  // ── Pre-compute for rhythm section ───────────────────────────────────────
  const maxHourVal    = Math.max(...messagesByHour, 1);
  const peakHour      = messagesByHour.indexOf(Math.max(...messagesByHour));
  const peakDow       = messagesByDow.indexOf(Math.max(...messagesByDow));
  const dowNames      = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const peakHourLabel = peakHour === 0 ? '12am' : peakHour < 12 ? peakHour + 'am' : peakHour === 12 ? '12pm' : (peakHour - 12) + 'pm';
  const maxProjMsgs   = projects.length ? Math.max(...projects.map(p => p.messages), 1) : 1;
  const projColors    = ['var(--green)','var(--cyan)','var(--yellow)','var(--purple)','var(--pink)','#34d399','#f97316','#60a5fa'];

  const peakHourFlavor =
      (peakHour >= 22 || peakHour <= 4)  ? { tag: 'Night Owl',       emoji: '🦉', desc: 'You ship code when everyone else is asleep.' }
    : peakHour <= 8                       ? { tag: 'Early Bird',      emoji: '🌅', desc: 'First up, first to ship.' }
    : peakHour <= 12                      ? { tag: 'Morning Builder', emoji: '☀️', desc: 'Peak output before lunch.' }
    : peakHour <= 17                      ? { tag: 'Afternoon Dev',   emoji: '🌤️', desc: 'The afternoon is when the code flows.' }
                                          : { tag: 'Evening Coder',   emoji: '🌙', desc: 'When the office clears, the real work starts.' };

  // ── Activity calendar (GitHub-style, built from slim session data) ────────
  function buildCalendar() {
    if (!firstDay || !lastDay || !slim.length) return null;

    // Daily message counts from session start times
    const dmap = {};
    for (const s of slim) {
      if (s.start) {
        const d = s.start.split('T')[0];
        dmap[d] = (dmap[d] || 0) + (s.msgs || 0);
      }
    }
    const maxVal = Math.max(...Object.values(dmap), 1);

    // Align start to the Monday on or before firstDay
    const start = new Date(firstDay + 'T12:00:00Z');
    const dow   = start.getUTCDay(); // 0=Sun
    const backToMon = (dow === 0 ? 6 : dow - 1);
    start.setUTCDate(start.getUTCDate() - backToMon);

    const end = new Date(lastDay + 'T12:00:00Z');

    const weeks = [];
    const months = [];
    let seenMonths = new Set();
    const cur = new Date(start);

    while (cur <= end) {
      if (weeks.length === 0 || weeks[weeks.length - 1].length === 7) {
        weeks.push([]);
      }
      const d     = cur.toISOString().split('T')[0];
      const isoCur = cur.getUTCDay();
      const isMonday = isoCur === 1 || (isoCur === 0 && weeks[weeks.length-1].length === 0);
      const mLabel = cur.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      const mKey   = cur.toISOString().substring(0, 7);
      if (!seenMonths.has(mKey)) {
        seenMonths.add(mKey);
        // If the month starts mid-week, defer label to the next column so it
        // doesn't sit on top of the previous month's cells.
        const isWeekStart = weeks[weeks.length - 1].length === 0;
        const targetIdx   = isWeekStart ? weeks.length - 1 : weeks.length;
        // Also enforce a minimum gap so short months don't crowd each other.
        const lastM = months[months.length - 1];
        if (!lastM || targetIdx - lastM.weekIdx >= 3) {
          months.push({ label: mLabel, weekIdx: targetIdx });
        }
      }
      weeks[weeks.length - 1].push({
        date:    d,
        msgs:    dmap[d] || 0,
        inRange: d >= firstDay && d <= lastDay,
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    // Pad final week to 7 days
    while (weeks[weeks.length - 1].length < 7) {
      weeks[weeks.length - 1].push({ date: '', msgs: 0, inRange: false });
    }

    // Always show at least 26 weeks so the calendar fills the container width
    const EMPTY_WEEK = Array(7).fill({ date: '', msgs: 0, inRange: false });
    while (weeks.length < 26) weeks.push([...EMPTY_WEEK]);

    return { weeks, months, maxVal };
  }

  const cal = buildCalendar();

  // Build calendar SVG string
  function calSvg() {
    if (!cal) return '';
    const CS = 13, CG = 3, STEP = CS + CG;
    const LEFT = 16, TOP = 20;
    const W = LEFT + cal.weeks.length * STEP;
    const H = TOP + 7 * STEP;

    function cellColor(msgs, inRange) {
      if (!inRange || msgs === 0) return '#12151f';
      if (msgs < 10)  return '#0d4429';
      if (msgs < 30)  return '#006d32';
      if (msgs < 80)  return '#26a641';
      return '#39d353';
    }

    // Always fill container — SVG scales proportionally via viewBox
    let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;overflow:visible" xmlns="http://www.w3.org/2000/svg">`;

    // Month labels
    for (const { label, weekIdx } of cal.months) {
      const x = LEFT + weekIdx * STEP;
      svg += `<text x="${x}" y="11" font-size="9" fill="#64748b" font-family="monospace">${label}</text>`;
    }

    // Day-of-week labels (Mon, Wed, Fri)
    ['M','','W','','F','',''].forEach((lbl, i) => {
      if (lbl) svg += `<text x="0" y="${TOP + i * STEP + CS - 2}" font-size="9" fill="#475569" font-family="monospace">${lbl}</text>`;
    });

    // Cells
    cal.weeks.forEach((week, wi) => {
      week.forEach((day, di) => {
        const x   = LEFT + wi * STEP;
        const y   = TOP  + di * STEP;
        const col = cellColor(day.msgs, day.inRange);
        const tip = day.inRange && day.msgs > 0 ? `${day.date} · ${day.msgs} msgs` : (day.date || '');
        svg += `<rect x="${x}" y="${y}" width="${CS}" height="${CS}" rx="2" fill="${col}"><title>${tip}</title></rect>`;
      });
    });

    svg += '</svg>';
    return svg;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${projectName} · Claude Wrapped</title>
<meta property="og:title" content="${projectName} · Claude Wrapped">
<meta property="og:description" content="${tagline}">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{zoom:1.1}
:root{
  --bg:#0a0c12;--surface:#0e1018;--border:#1e2235;
  --text:#e2e8f0;--muted:#64748b;--dim:#475569;
  --green:#10b981;--cyan:#06b6d4;--yellow:#f59e0b;
  --red:#ef4444;--purple:#8b5cf6;--pink:#ec4899;
}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;min-height:100vh}
a{color:inherit}

/* NAV */
nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:16px 40px;display:flex;justify-content:space-between;align-items:center;transition:background .3s,border-color .3s;border-bottom:1px solid transparent}
nav.scrolled{background:rgba(10,12,18,.92);backdrop-filter:blur(12px);border-color:var(--border)}
.nav-brand{font-size:13px;font-family:'SF Mono','Cascadia Code',monospace;color:var(--green);letter-spacing:.08em;text-decoration:none}
.nav-sub{font-size:12px;color:var(--dim);font-family:'SF Mono','Cascadia Code',monospace}

/* HERO */
.hero{padding:110px 0 70px;text-align:center}
.container{max-width:860px;margin:0 auto;padding:0 40px}
.container-wide{max-width:1200px;margin:0 auto;padding:0 40px}
.eyebrow{font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:var(--green);font-family:'SF Mono','Cascadia Code',monospace;margin-bottom:14px}
h1{font-size:clamp(36px,6vw,72px);font-weight:700;letter-spacing:-.03em;line-height:1.05;margin-bottom:20px}
h1 span{color:var(--green)}
.hero-sub{color:var(--muted);font-size:18px;max-width:600px;margin:0 auto 48px;line-height:1.6}

/* STATS ROW */
.stats-row{display:flex;gap:0;justify-content:center;border:1px solid var(--border);border-radius:14px;overflow:hidden;max-width:760px;margin:0 auto}
.stat{flex:1;padding:24px 16px;text-align:center;border-right:1px solid var(--border)}
.stat:last-child{border-right:none}
.stat-val{font-size:clamp(22px,3vw,34px);font-weight:700;font-family:'SF Mono','Cascadia Code',monospace;margin-bottom:4px}
.stat-val.g{color:var(--green)}.stat-val.t{color:var(--cyan)}.stat-val.a{color:var(--yellow)}.stat-val.p{color:var(--purple)}
.stat-lbl{font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:.1em}
.pill{text-align:center;margin-top:18px}
.pill span{display:inline-block;padding:5px 18px;border:1px solid rgba(139,92,246,.35);border-radius:20px;background:rgba(139,92,246,.08);font-size:13px;color:#a78bfa;font-family:'SF Mono','Cascadia Code',monospace}

/* SECTION HEADERS */
.section{padding:80px 0}
.section-eyebrow{font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:var(--green);font-family:'SF Mono','Cascadia Code',monospace;margin-bottom:8px}
.section-title{font-size:clamp(24px,4vw,40px);font-weight:700;letter-spacing:-.02em;margin-bottom:8px}
.section-desc{color:var(--muted);font-size:17px;margin-bottom:40px}

/* CARDS */
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
@media(max-width:768px){.grid-3{grid-template-columns:repeat(2,1fr)}.stats-row{flex-wrap:wrap}}
@media(max-width:480px){.grid-3,.grid-2{grid-template-columns:1fr}}

/* STAT CARDS */
.day-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:22px;position:relative;overflow:hidden}
.day-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--c,var(--green))}
.day-emoji{font-size:22px;margin-bottom:12px}
.day-headline{font-size:17px;font-weight:500;color:var(--text);line-height:1.5;margin-bottom:14px}
.day-headline strong{font-weight:700}
.day-stat{font-size:12px;font-family:'SF Mono','Cascadia Code',monospace;color:var(--dim);letter-spacing:.04em}

/* COMPARISON CARDS */
.cmp-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:28px;display:flex;flex-direction:column;gap:10px}
.cmp-emoji{font-size:28px}
.cmp-stat{font-size:28px;font-weight:700;font-family:'SF Mono','Cascadia Code',monospace;color:var(--green)}
.cmp-label{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--dim)}
.cmp-compare{font-size:15px;color:var(--muted);line-height:1.5;margin-top:4px}

/* TOP FILES / TOOLS */
.list-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px}
.list-title{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--green);font-family:'SF Mono','Cascadia Code',monospace;margin-bottom:16px}
.list-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:14px}
.list-row:last-child{border-bottom:none}
.list-key{color:var(--muted);font-family:'SF Mono','Cascadia Code',monospace;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:75%}
.list-val{color:var(--text);font-weight:600;font-family:'SF Mono','Cascadia Code',monospace;font-size:13px}

/* SPIKE CALLOUT */
.spike{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:12px;padding:28px;margin-top:32px}
.spike-num{font-size:48px;font-weight:700;font-family:'SF Mono','Cascadia Code',monospace;color:var(--red)}
.spike-label{font-size:12px;text-transform:uppercase;letter-spacing:.15em;color:rgba(239,68,68,.7);margin-bottom:8px}
.spike-desc{color:var(--muted);font-size:15px;line-height:1.6;margin-top:10px}

/* BAR CHART */
.player{border:1px solid var(--border);border-radius:16px;overflow:hidden;background:var(--surface)}
.player-top{display:flex;justify-content:space-between;align-items:center;padding:20px 28px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:12px}
.player-info{font-size:14px;color:var(--muted);font-family:'SF Mono','Cascadia Code',monospace}
.player-btns{display:flex;gap:8px}
.pl-btn{background:var(--bg);border:1px solid var(--border);color:var(--text);padding:8px 18px;border-radius:6px;font-family:'SF Mono','Cascadia Code',monospace;font-size:13px;cursor:pointer;transition:border-color .2s}
.pl-btn:hover{border-color:var(--green);color:var(--green)}
.pulse-legend{display:flex;flex-wrap:wrap;gap:14px;align-items:center;padding:14px 28px;border-top:1px solid var(--border)}
.pleg{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dim);font-family:'SF Mono','Cascadia Code',monospace}
.pleg i{display:inline-block;width:10px;height:10px;border-radius:2px}

/* BY PROJECT */
.proj-row{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px 22px;margin-bottom:10px}
.proj-row:last-child{margin-bottom:0}
.proj-row-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;flex-wrap:wrap;gap:8px}
.proj-row-name{font-size:15px;font-weight:600;font-family:'SF Mono','Cascadia Code',monospace;color:var(--text)}
.proj-row-msgs{font-size:13px;color:var(--muted)}
.proj-bar-track{height:5px;background:var(--border);border-radius:3px;margin-bottom:16px}
.proj-bar-fill{height:100%;border-radius:3px;width:0;transition:width 1.2s ease}
.proj-row-stats{display:flex;gap:28px;flex-wrap:wrap}
.proj-chip-val{font-size:18px;font-weight:700;font-family:'SF Mono','Cascadia Code',monospace;color:var(--text);display:block}
.proj-chip-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--dim)}

/* WHEN YOU WORK */
.work-grid{display:grid;grid-template-columns:2fr 1fr;gap:48px;align-items:start}
@media(max-width:768px){.work-grid{grid-template-columns:1fr}}
.work-sub-title{font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:var(--dim);font-family:'SF Mono','Cascadia Code',monospace;margin-bottom:14px}
/* Hour heatmap */
.hour-hmap{display:flex;gap:2px;margin-bottom:6px}
.hcell{flex:1;height:48px;border-radius:3px;min-width:0}
.hour-hlbls{display:flex;gap:2px}
.hrlbl{flex:1;font-size:9px;color:var(--dim);font-family:'SF Mono','Cascadia Code',monospace;text-align:center;min-width:0;overflow:hidden}
/* Flavor badge */
.work-badge{display:inline-flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:6px 14px;font-size:13px;margin-top:14px}
.work-badge-tag{font-weight:600;color:var(--text)}
.work-badge-desc{color:var(--muted)}
/* DOW chart — bars zone + label row are separate */
.dow-bars-zone{display:flex;gap:6px;height:80px;align-items:flex-end;margin-bottom:6px}
.dow-col{flex:1;display:flex;align-items:flex-end;height:100%}
.dow-bar{width:100%;border-radius:3px 3px 0 0;background:var(--cyan);height:0;transition:height .8s ease}
.dow-label-row{display:flex;gap:6px}
.dow-lbl{flex:1;text-align:center;font-size:11px;font-family:'SF Mono','Cascadia Code',monospace;color:var(--dim)}
.work-insight{font-size:14px;color:var(--muted);margin-top:12px}
.work-insight strong{color:var(--text)}
/* Activity calendar */
.cal-wrap{margin-bottom:40px}
.cal-title{font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:var(--dim);font-family:'SF Mono','Cascadia Code',monospace;margin-bottom:14px}
.cal-legend{display:flex;align-items:center;gap:6px;margin-top:10px;font-size:11px;color:var(--dim)}
.cal-swatch{width:11px;height:11px;border-radius:2px;display:inline-block}

/* AUTHOR CARD */
.author-section{border-top:1px solid var(--border);padding:56px 0}
.author-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:28px;max-width:480px;margin:0 auto;text-align:center}
.author-name{font-size:22px;font-weight:700;margin-bottom:4px}
.author-sub{font-size:14px;color:var(--muted)}

/* FOOTER */
footer{border-top:1px solid var(--border);padding:28px 40px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;font-size:13px;color:var(--dim)}
footer a{color:var(--dim);text-decoration:none}
footer a:hover{color:var(--text)}

/* ACHIEVEMENTS */
.ach-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
.ach-card{background:var(--surface);border:1px solid var(--tier-color,var(--border));border-radius:12px;padding:24px;box-shadow:0 0 24px var(--tier-glow,transparent);position:relative;overflow:hidden}
.ach-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--tier-color,var(--green))}
.ach-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}
.ach-icon{font-size:28px}
.ach-tier{font-size:10px;font-weight:700;letter-spacing:.15em;color:var(--tier-color);font-family:'SF Mono','Cascadia Code',monospace;padding:3px 8px;border:1px solid var(--tier-color);border-radius:4px;opacity:.85}
.ach-name{font-size:17px;font-weight:700;color:var(--text);margin-bottom:6px}
.ach-stat{font-size:22px;font-weight:700;font-family:'SF Mono','Cascadia Code',monospace;color:var(--tier-color);margin-bottom:10px}
.ach-flavor{font-size:14px;color:var(--muted);line-height:1.5;margin-bottom:8px}
.ach-baseline{font-size:11px;color:var(--dim);font-family:'SF Mono','Cascadia Code',monospace}
.ach-note{font-size:12px;color:var(--dim);margin-top:20px;padding-top:16px;border-top:1px solid var(--border)}

/* TOOLTIP */
#tip{position:fixed;pointer-events:none;background:#1a1d2e;border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--muted);z-index:999;opacity:0;transition:opacity .15s;min-width:160px}
.tn{font-weight:600;color:var(--text);margin-bottom:4px;font-family:'SF Mono','Cascadia Code',monospace;font-size:12px}
.tr{display:flex;justify-content:space-between;gap:24px;font-size:12px}

.reveal{opacity:0;transform:translateY(20px)}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></` + `script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></` + `script>
</head>
<body>

<nav id="nav">
  <span class="nav-brand">claude-wrapped</span>
  <span class="nav-sub">${projectName}${dateRange ? ` · ${dateRange}` : ''}</span>
</nav>

<section class="hero">
  <div class="container">
    <div class="eyebrow">Claude Wrapped</div>
    <h1>${projectName}<br><span>by the numbers.</span></h1>
    <p class="hero-sub">${tagline}</p>
    <div class="stats-row">
      <div class="stat"><div class="stat-val g" id="s1">0</div><div class="stat-lbl">Sessions</div></div>
      <div class="stat"><div class="stat-val"   id="s2">0</div><div class="stat-lbl">Messages</div></div>
      <div class="stat"><div class="stat-val t" id="s3">0</div><div class="stat-lbl">Context Resets</div></div>
      <div class="stat"><div class="stat-val a" id="s4">0</div><div class="stat-lbl">GB Generated</div></div>
      <div class="stat"><div class="stat-val p" id="s5">0</div><div class="stat-lbl">Lines Written</div></div>
    </div>
    <div class="pill" id="pill0"><span>${comparisons[0].emoji} ${comparisons[0].compare}</span></div>
  </div>
</section>

<section class="section" style="padding-top:0;border-top:1px solid var(--border)">
  <div class="container-wide">
    <div class="section-eyebrow">Your Average Day</div>
    <div class="section-title">What building this actually looked like</div>
    <div class="grid-3" id="day-grid">
      <div class="day-card reveal" style="--c:var(--green)">
        <div class="day-emoji">☕</div>
        <div class="day-headline">${computeHrsDay} hours of Claude <strong>actively thinking</strong> every day. Not wall clock.</div>
        <div class="day-stat">${computeHrsDay} hrs compute/day</div>
      </div>
      <div class="day-card reveal" style="--c:var(--cyan)">
        <div class="day-emoji">💬</div>
        <div class="day-headline"><strong>${msgsPerDay.toLocaleString()} messages</strong> exchanged every single day.</div>
        <div class="day-stat">${msgsPerDay.toLocaleString()} messages/day</div>
      </div>
      <div class="day-card reveal" style="--c:var(--yellow)">
        <div class="day-emoji">🧠</div>
        <div class="day-headline"><strong>Total amnesia ${compactsPerDay}× a day.</strong> Picked right back up every time.</div>
        <div class="day-stat">${compactsPerDay}× context resets/day</div>
      </div>
      <div class="day-card reveal" style="--c:var(--purple)">
        <div class="day-emoji">📚</div>
        <div class="day-headline"><strong>${mbPerDay} MB</strong> of conversation data generated every single day.</div>
        <div class="day-stat">${mbPerDay} MB context/day</div>
      </div>
      <div class="day-card reveal" style="--c:var(--pink)">
        <div class="day-emoji">⏱️</div>
        <div class="day-headline">Longest single turn: <strong>${maxTurnMin} minutes.</strong> Claude just kept going.</div>
        <div class="day-stat">${maxTurnMin} min · longest single turn</div>
      </div>
      <div class="day-card reveal" style="--c:#34d399">
        <div class="day-emoji">⚡</div>
        <div class="day-headline">Average turn: <strong>${avgTurnMin} minutes</strong> to read, think, and write production code.</div>
        <div class="day-stat">${avgTurnMin} min avg turn duration</div>
      </div>
    </div>
  </div>
</section>

${projects.length > 1 ? `
<section class="section" id="proj-section" style="padding-top:0;border-top:1px solid var(--border)">
  <div class="container-wide">
    <div class="section-eyebrow">By Project</div>
    <div class="section-title">Where the effort went</div>
    <div class="section-desc">Each project's share of your total output.</div>
    ${projects.map((p, i) => {
      const pct = Math.round(p.messages / maxProjMsgs * 100);
      const col = projColors[i % projColors.length];
      const displayName = p.name.replace(/^C--/, '').replace(/-/g, ' ');
      return `
    <div class="proj-row reveal">
      <div class="proj-row-head">
        <span class="proj-row-name">${displayName}</span>
        <span class="proj-row-msgs">${p.messages.toLocaleString()} messages</span>
      </div>
      <div class="proj-bar-track">
        <div class="proj-bar-fill" data-w="${pct}" style="background:${col}"></div>
      </div>
      <div class="proj-row-stats">
        <div><span class="proj-chip-val">${p.sessions}</span><span class="proj-chip-lbl">Sessions</span></div>
        <div><span class="proj-chip-val">${p.compacts}</span><span class="proj-chip-lbl">Resets</span></div>
        <div><span class="proj-chip-val">${p.lines.toLocaleString()}</span><span class="proj-chip-lbl">Lines</span></div>
        <div><span class="proj-chip-val">${p.computeHrs}h</span><span class="proj-chip-lbl">Compute</span></div>
      </div>
    </div>`;
    }).join('')}
  </div>
</section>` : ''}

<section class="section" style="background:var(--surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)">
  <div class="container-wide">
    <div class="section-eyebrow">The Context Pulse</div>
    <div class="section-title">Every reset, visualised</div>
    <div class="section-desc">Each bar is one session. Height = number of context resets. Bars reveal as the playhead sweeps.</div>
    <div class="player" id="player-wrap">
      <div class="player-top">
        <div class="player-info">
          <span id="pl-num" style="color:var(--text);font-weight:600">Session 1 / ${sessionCount}</span>
          &nbsp;·&nbsp;<span id="pl-resets">0</span> resets
          &nbsp;·&nbsp;<span id="pl-size">0</span> MB
          &nbsp;·&nbsp;<span id="pl-msgs">0</span> messages
        </div>
        <div class="player-btns">
          <button class="pl-btn" id="pl-speed">2×</button>
          <button class="pl-btn" id="pl-btn">&#9646;&#9646;</button>
        </div>
      </div>
      <div id="pulse-wrap"><svg id="pulse-svg" style="cursor:pointer;display:block;width:100%"></svg></div>
      <div class="pulse-legend">
        <span class="pleg"><i style="background:#10b981"></i>1–5 resets</span>
        <span class="pleg"><i style="background:#06b6d4"></i>6–15 resets</span>
        <span class="pleg"><i style="background:#f59e0b"></i>16–30 resets</span>
        <span class="pleg"><i style="background:#ef4444"></i>31+ resets</span>
        <span class="pleg" style="margin-left:auto;color:#334155">Thin slices = many resets · Fat blocks = calm session</span>
      </div>
    </div>

    ${spikeSession.compacts > 0 ? `
    <div class="spike">
      <div class="spike-label">Hardest Session</div>
      <div class="spike-num">${spikeSession.compacts}</div>
      <div class="spike-desc">
        context resets in a single session — <strong>${spikeSession.sizeMB} MB</strong> of conversation data.
        Claude hit its memory limit ${spikeSession.compacts} times and kept going each time.
      </div>
    </div>` : ''}
  </div>
</section>

<section class="section">
  <div class="container-wide">
    <div class="section-eyebrow">Put in Perspective</div>
    <div class="section-title">The numbers, translated</div>
    <div class="grid-3" id="cmp-grid">
      ${comparisons.map(c => `
      <div class="cmp-card reveal">
        <div class="cmp-emoji">${c.emoji}</div>
        <div class="cmp-stat">${c.stat}</div>
        <div class="cmp-label">${c.label}</div>
        <div class="cmp-compare">${c.compare}</div>
      </div>`).join('')}
    </div>
  </div>
</section>

${achievements.length > 0 ? `
<section class="section" id="ach-section" style="background:var(--surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)">
  <div class="container-wide">
    <div class="section-eyebrow">Achievements</div>
    <div class="section-title">${achievements.length} unlocked</div>
    <div class="section-desc">Stacked against estimated 2026 community baselines for active Claude Code users.</div>
    <div class="ach-grid">
      ${achievements.map(a => `
      <div class="ach-card reveal" style="--tier-color:${a.tierColor};--tier-glow:${a.tierGlow}">
        <div class="ach-header">
          <div class="ach-icon">${a.emoji}</div>
          <div class="ach-tier">${a.tierLabel.toUpperCase()}</div>
        </div>
        <div class="ach-name">${a.name}</div>
        <div class="ach-stat">${a.stat}</div>
        <div class="ach-flavor">${a.flavor}</div>
        <div class="ach-baseline">${a.baseline}</div>
      </div>`).join('')}
    </div>
    <div class="ach-note">Baselines are estimates — not official Anthropic data. As community benchmarks improve, thresholds will update.</div>
  </div>
</section>` : ''}

${messagesByHour.some(v => v > 0) ? `
<section class="section" id="work-section" style="padding-top:0;border-top:1px solid var(--border)">
  <div class="container-wide">
    <div class="section-eyebrow">Coding Rhythm</div>
    <div class="section-title">When you work</div>
    <div class="section-desc">Activity patterns across your whole project.</div>

    ${cal ? `
    <div class="cal-wrap">
      <div class="cal-title">Activity Calendar</div>
      ${calSvg()}
      <div class="cal-legend">
        Less
        <span class="cal-swatch" style="background:#12151f;border:1px solid #1e2235"></span>
        <span class="cal-swatch" style="background:#0d4429"></span>
        <span class="cal-swatch" style="background:#006d32"></span>
        <span class="cal-swatch" style="background:#26a641"></span>
        <span class="cal-swatch" style="background:#39d353"></span>
        More
      </div>
    </div>` : ''}

    <div class="work-grid">
      <div>
        <div class="work-sub-title">Hour of Day</div>
        <div class="hour-hmap">
          ${messagesByHour.map((v, h) => {
            const pct = v / maxHourVal;
            const bg  = v === 0
              ? 'rgba(30,34,53,0.6)'
              : `rgba(16,185,129,${(0.12 + pct * 0.85).toFixed(2)})`;
            return `<div class="hcell" style="background:${bg}" title="${h < 12 ? (h || 12) + 'am' : (h === 12 ? '12pm' : (h - 12) + 'pm')} · ${v.toLocaleString()} msgs"></div>`;
          }).join('')}
        </div>
        <div class="hour-hlbls">
          ${Array.from({length: 24}, (_, h) => {
            const label = h % 6 === 0
              ? (h === 0 ? '12am' : h < 12 ? h + 'am' : h === 12 ? '12pm' : (h - 12) + 'pm')
              : '';
            return `<span class="hrlbl">${label}</span>`;
          }).join('')}
        </div>
        <div class="work-badge">
          <span>${peakHourFlavor.emoji}</span>
          <span class="work-badge-tag">${peakHourFlavor.tag}</span>
          <span class="work-badge-desc">· ${peakHourFlavor.desc}</span>
        </div>
      </div>
      <div>
        <div class="work-sub-title">Day of Week</div>
        <div class="dow-bars-zone" id="dow-chart">
          ${dowNames.map((day, i) => {
            const v = messagesByDow[i] || 0;
            return `<div class="dow-col" title="${day}: ${v.toLocaleString()} msgs">
              <div class="dow-bar" data-h="${v}"></div>
            </div>`;
          }).join('')}
        </div>
        <div class="dow-label-row">
          ${dowNames.map(d => `<span class="dow-lbl">${d}</span>`).join('')}
        </div>
        <div class="work-insight" style="margin-top:12px">Busiest day: <strong>${dowNames[peakDow]}</strong></div>
      </div>
    </div>
  </div>
</section>` : ''}

<section class="section" style="padding-top:0${messagesByHour.some(v => v > 0) ? '' : ';border-top:1px solid var(--border)'}">
  <div class="container-wide">
    <div class="grid-2">
      <div class="list-card">
        <div class="list-title">Top Tool Calls</div>
        ${topTools.map(([k, v]) => `
        <div class="list-row">
          <span class="list-key">${k}</span>
          <span class="list-val">${v.toLocaleString()}</span>
        </div>`).join('')}
      </div>
      <div class="list-card">
        <div class="list-title">Most Edited Files</div>
        ${topFiles.map(([k, v]) => `
        <div class="list-row">
          <span class="list-key">${k}</span>
          <span class="list-val">${v}×</span>
        </div>`).join('')}
      </div>
    </div>
  </div>
</section>

${author ? `
<div class="author-section">
  <div class="container">
    <div class="author-card">
      <div class="author-name">${author}</div>
      <div class="author-sub">Built with Claude Code${dateRange ? ` · ${dateRange}` : ''}</div>
    </div>
  </div>
</div>` : ''}

<footer>
  <span>${projectName} · Claude Wrapped</span>
  <span style="display:flex;gap:20px;align-items:center">
    <a href="https://github.com/ElementalInsights/claude-wrapped" target="_blank" rel="noopener">claude-wrapped</a>
    <a href="https://www.linkedin.com/in/jake-edwards-a6a334a/" target="_blank" rel="noopener">Jake Edwards</a>
    <a href="https://elementalinsights.com" target="_blank" rel="noopener">elementalinsights.com</a>
  </span>
</footer>

<div id="tip"></div>

<script>
const SESS = ${JSON.stringify(slim)};
</` + `script>
<script>
gsap.registerPlugin(ScrollTrigger);

window.addEventListener('scroll',()=>{
  document.getElementById('nav').classList.toggle('scrolled',window.scrollY>40);
});

// count-up
const nums=[
  {id:'s1',val:${sessionCount}},{id:'s2',val:${totalMessages}},{id:'s3',val:${totalCompacts}},
  {id:'s4',val:${totalGB},dec:2},{id:'s5',val:${totalLines}}
];
nums.forEach(({id,val,dec=0})=>{
  gsap.to(document.getElementById(id),{duration:1.8,ease:'power2.out',
    onUpdate:function(){
      const p=this.progress();
      const v=val*p;
      document.getElementById(id).textContent=dec?v.toFixed(dec):Math.round(v).toLocaleString();
    },
    scrollTrigger:{trigger:'.hero',start:'top 80%',once:true}
  });
});
gsap.fromTo('#pill0',{opacity:0,y:12},{opacity:1,y:0,duration:.7,delay:.6,ease:'power2.out',
  scrollTrigger:{trigger:'.hero',start:'top 80%',once:true}});

// group reveals
[{sel:'#day-grid',y:32,scale:1,stagger:.08,ease:'power3.out'},
 {sel:'#cmp-grid',y:28,scale:.97,stagger:.1,ease:'back.out(1.4)'}
].forEach(({sel,y,scale,stagger,ease})=>{
  const g=document.querySelector(sel);
  if(!g)return;
  gsap.fromTo(g.querySelectorAll('.reveal'),
    {opacity:0,y,scale},
    {opacity:1,y:0,scale:1,duration:.6,stagger,ease,
     scrollTrigger:{trigger:g,start:'top 85%',once:true}});
});

// remaining reveals
document.querySelectorAll('.reveal').forEach(el=>{
  if(el.closest('#day-grid,#cmp-grid'))return;
  gsap.to(el,{opacity:1,y:0,duration:.6,ease:'power2.out',
    scrollTrigger:{trigger:el,start:'top 88%',once:true}});
});

// ── Achievement cards ────────────────────────────────────────────────────────
if(document.getElementById('ach-section')){
  const g=document.querySelector('#ach-section .ach-grid');
  if(g) gsap.fromTo(g.querySelectorAll('.reveal'),
    {opacity:0,y:28,scale:.97},
    {opacity:1,y:0,scale:1,duration:.55,stagger:.09,ease:'back.out(1.4)',
     scrollTrigger:{trigger:g,start:'top 85%',once:true}});
}

// ── Project bars ─────────────────────────────────────────────────────────────
if(document.getElementById('proj-section')){
  ScrollTrigger.create({
    trigger:'#proj-section',start:'top 80%',once:true,
    onEnter:()=>{
      document.querySelectorAll('.proj-bar-fill').forEach(el=>{
        el.style.width=(el.dataset.w||'0')+'%';
      });
    }
  });
}

// ── Day-of-week bars ─────────────────────────────────────────────────────────
if(document.getElementById('work-section')){
  ScrollTrigger.create({
    trigger:'#work-section',start:'top 80%',once:true,
    onEnter:()=>{
      const bars=document.querySelectorAll('.dow-bar');
      const vals=Array.from(bars).map(el=>+(el.dataset.h||0));
      const mx=Math.max(...vals,1);
      bars.forEach(el=>{
        const v=+(el.dataset.h||0);
        el.style.height=(v===0?2:Math.max(4,Math.round(v/mx*72)))+'px';
      });
    }
  });
}

// ── Pulse player ────────────────────────────────────────────────────────────
function initPlayer(){
  const wrap=document.getElementById('pulse-wrap');
  const svg=document.getElementById('pulse-svg');
  const W=wrap.clientWidth, PH=300;
  svg.setAttribute('viewBox','0 0 '+W+' '+PH);
  svg.setAttribute('height',PH);

  const sess=SESS;
  const ML=8,MR=8,MT=10;
  const PW=(W-ML-MR)/sess.length;
  const GAP=PW>4?1.5:0.5;

  function barColor(n){
    if(n>30)return'#ef4444';
    if(n>15)return'#f59e0b';
    if(n>5) return'#06b6d4';
    return'#10b981';
  }

  const yBase=PH-4;
  const FULL_H=(PH-MT-4)*0.95;
  const SEG_GAP=1;

  let barSegs='';
  sess.forEach((s,i)=>{
    const x=ML+i*PW;
    const sw=PW-GAP;
    if(s.compacts===0){
      barSegs+='<rect x="'+x+'" y="'+(yBase-4)+'" width="'+sw+'" height="4" fill="#334155" opacity="0.4"/>';
      return;
    }
    const col=barColor(s.compacts);
    const segH=(FULL_H-SEG_GAP*(s.compacts-1))/s.compacts;
    for(let j=0;j<s.compacts;j++){
      const sy=(yBase-FULL_H)+j*(segH+SEG_GAP);
      const op=j%2===0?'0.85':'0.55';
      barSegs+='<rect class="bar-seg" data-i="'+i+'" x="'+x+'" y="'+sy+'" width="'+sw+'" height="'+segH+'" fill="'+col+'" opacity="'+op+'" style="cursor:pointer"/>';
    }
  });

  svg.innerHTML=
    '<defs><clipPath id="bclip"><rect id="clip-rect" x="'+ML+'" y="0" width="0" height="'+PH+'"/></clipPath></defs>'+
    '<g clip-path="url(#bclip)">'+barSegs+'</g>'+
    '<line id="ph" x1="'+ML+'" y1="0" x2="'+ML+'" y2="'+PH+'" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>'+
    '<rect id="ph-hit" x="0" y="0" width="'+W+'" height="'+PH+'" fill="transparent" style="cursor:pointer"/>';

  const tip=document.getElementById('tip');
  function ht(){tip.style.opacity='0';}
  svg.querySelectorAll('.bar-seg').forEach(el=>{
    el.addEventListener('mouseenter',e=>{
      const s=sess[+el.dataset.i];
      tip.innerHTML='<div class="tn">'+(s.slug||'Session '+(+el.dataset.i+1))+'</div>'
        +'<div class="tr"><span>Resets</span><span>'+s.compacts+'</span></div>'
        +'<div class="tr"><span>Messages</span><span>'+(s.msgs||0)+'</span></div>'
        +'<div class="tr"><span>Size</span><span>'+(s.sizeMB||0)+' MB</span></div>';
      tip.style.opacity='1';
      tip.style.left=(e.clientX+14)+'px';
      tip.style.top=(e.clientY-14)+'px';
    });
    el.addEventListener('mousemove',e=>{
      tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY-14)+'px';
    });
    el.addEventListener('mouseleave',ht);
  });

  const ph=document.getElementById('ph');
  const cr=document.getElementById('clip-rect');
  const plNum=document.getElementById('pl-num');
  const plResets=document.getElementById('pl-resets');
  const plSize=document.getElementById('pl-size');
  const plMsgs=document.getElementById('pl-msgs');
  const btn=document.getElementById('pl-btn');
  const speedBtn=document.getElementById('pl-speed');

  // speeds[3] = 2× — start fast by default
  const speeds=[0.25,0.5,1,2];
  let speedIdx=3, nx=0, playing=true, rafId=null;

  function updateInfo(nx){
    const px=ML+nx*(W-ML-MR);
    const i=Math.min(Math.floor((px-ML)/PW),sess.length-1);
    const s=sess[Math.max(0,i)];
    plNum.textContent='Session '+(i+1)+' / '+sess.length;
    plResets.textContent=s.compacts;
    plSize.textContent=s.sizeMB||0;
    plMsgs.textContent=(s.msgs||0).toLocaleString();
    ph.setAttribute('x1',px);ph.setAttribute('x2',px);
    if(cr) cr.setAttribute('width',Math.max(0,px-ML));
  }

  let last=null;
  function tick(ts){
    if(!last)last=ts;
    const dt=(ts-last)/1000;
    last=ts;
    // Divisor targets ~1s per session at 1× for snappy sweep
    nx+=dt*speeds[speedIdx]*(1/Math.max(20,sess.length));
    if(nx>=1){nx=0;}
    updateInfo(nx);
    if(playing)rafId=requestAnimationFrame(tick);
  }

  btn.addEventListener('click',()=>{
    playing=!playing;
    btn.textContent=playing?'⏸':'▶';
    if(playing){last=null;rafId=requestAnimationFrame(tick);}
    else cancelAnimationFrame(rafId);
  });
  speedBtn.addEventListener('click',()=>{
    speedIdx=(speedIdx+1)%speeds.length;
    speedBtn.textContent=speeds[speedIdx]+'×';
  });
  document.getElementById('ph-hit').addEventListener('click',e=>{
    const rect=svg.getBoundingClientRect();
    nx=Math.max(0,Math.min(1,(e.clientX-rect.left-ML)/(W-ML-MR)));
    updateInfo(nx);
  });

  updateInfo(0);
  rafId=requestAnimationFrame(tick);
}

ScrollTrigger.create({trigger:'#player-wrap',start:'top 85%',once:true,onEnter:initPlayer});
</` + `script>
</body>
</html>`;
}
