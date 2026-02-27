# claude-wrapped — Agent Reference

**What it does:** Parses Claude Code's local `.jsonl` session files → generates a self-contained animated `index.html` Wrapped-style stats page. Zero npm dependencies, pure Node.js ESM.

---

## File map

```
bin/cli.mjs          Entry point. Arg parsing, config loading, orchestration.
src/extract.mjs      Reads .jsonl files → array of session objects.
src/analyze.mjs      Session array → aggregate stats object.
src/comparisons.mjs  Pure data: arrays of { min, label, emoji } thresholds.
src/render.mjs       stats + config → self-contained HTML string (one big template literal).
package.json         Zero runtime deps. "type": "module".
```

---

## Core data shapes

**Session** (from `extract.mjs`):
```js
{
  id: string,                    // first 8 chars of filename
  slug: string | null,           // from .jsonl metadata
  gitBranch: string | null,
  startTime: string | null,      // ISO timestamp
  endTime: string | null,
  fileSizeBytes: number,
  userMessages: number,
  assistantMessages: number,
  compacts: number,              // compact_boundary events = context resets
  compactPositions: number[],    // normalised positions (0–1) within session
  turnDurations: number[],       // ms per assistant turn
  toolCalls: { [name: string]: number },
  filesEdited: { [filename: string]: number },  // counts per filename (no path)
  linesWritten: number,          // lines in Edit/Write new_string/content
  apiErrors: number,
  totalRecords: number
}
```

**Stats** (from `analyze.mjs`):
```js
{
  // Totals
  sessionCount, totalMessages, totalCompacts,
  totalGB, totalMB, totalLines,
  totalComputeMs,

  // Turn stats
  avgTurnMs, maxTurnMs,

  // Per-day averages (based on date span)
  msgsPerDay, compactsPerDay, mbPerDay, computeHrsDay,

  // Date range
  spanDays, firstDay, lastDay,   // firstDay/lastDay: 'YYYY-MM-DD' strings

  // Top lists (sorted desc by count)
  topTools: [string, number][],  // [toolName, count] — top 8
  topFiles: [string, number][],  // [filename, count] — top 5; anonymised by default

  // Hardest session
  spikeSession: { compacts: number, sizeMB: number, slug: string },

  // Chart data — one entry per session
  slim: Array<{ id, slug, compacts, sizeMB, msgs, positions, turns, start }>,

  // Per-project (only when >1 project loaded; names anonymised by default)
  projects: Array<{ name, sessions, messages, compacts, lines, computeHrs, topTool }>,

  // Rhythm data (derived from session startTime)
  messagesByHour: number[24],    // index = hour (0–23)
  messagesByDow:  number[7],     // index = day (0=Mon … 6=Sun)
}
```

**Config** (assembled in `cli.mjs`):
```js
{
  sessions: string,        // resolved path to .jsonl directory
  project: string,         // display name for the page
  author: string | null,
  tagline: string | null,
  out: string,             // output directory
  noRedact: boolean        // true = show real names; default false (anonymised)
}
```

---

## CLI flags

| Flag | Default | Notes |
|------|---------|-------|
| `--list` | — | List available projects and exit |
| `--pick <name>` | — | Select project by folder name (repeatable) |
| `--sessions <path>` | all projects | Explicit path (repeatable) |
| `--project <name>` | folder name | Display name |
| `--author <name>` | — | Shown in footer |
| `--tagline <text>` | auto | Subtitle |
| `--out <dir>` | `./wrapped` | Output directory |
| `--config <file>` | auto | JSON config file |
| `--no-redact` | off | Show real file/project names (default: anonymised) |

---

## Adding things — which file to touch

| Task | File(s) |
|------|---------|
| New comparison threshold | `src/comparisons.mjs` only |
| New comparison metric | `src/comparisons.mjs` + `src/analyze.mjs` + `src/render.mjs` |
| New template section | `src/render.mjs` (HTML + CSS + JS all inline) |
| New stat or aggregate | `src/analyze.mjs` → add to returned stats object |
| New CLI flag | `bin/cli.mjs` arg parser → pass through config |
| Filter sessions (e.g. --since) | `bin/cli.mjs` (flag) + `src/extract.mjs` (apply filter) |

---

## Comparison format

`src/comparisons.mjs` exports arrays of threshold objects. Must be sorted ascending by `min`. Renderer picks the last entry where `min` <= stat value.

```js
export const linesWrittenComparisons = [
  { min: 0,       label: 'A solid commit message. But longer.', emoji: '📝' },
  { min: 10_000,  label: 'About the length of The Great Gatsby.', emoji: '📗' },
  { min: 100_000, label: 'One War & Peace. Written in code.', emoji: '📚' },
];
```

---

## Template section format

`src/render.mjs` is one function returning a template literal. Add new sections inside the string:

```js
// Add inside the template literal, in page-flow order:
`
<section class="section" id="my-new-section">
  <h2 class="section-title">My New Section</h2>
  <p>${stats.myNewStat}</p>
</section>
`
// CSS goes in the <style> block at the top of the template.
// JS goes in the <script> block at the bottom of the template.
// Guard optional sections: ${condition ? `<section>...</section>` : ''}
```

---

## Hard constraints

- **No npm dependencies** — use Node.js built-ins only (`fs`, `path`, `os`, `readline`, `url`).
- **Do not split `render.mjs`** — self-contained HTML output requires all rendering in one place.
- **Do not modify extract.mjs parsing without testing against real `.jsonl` files** — format is undocumented, parsing is fragile. Test with actual `~/.claude/projects/` data.
- **Read-only access to user data** — never write to `~/.claude/` or any source directory.
- **Wrap JSON.parse in try/catch** — malformed lines must be skipped, not crash the process.
- **Redact by default** — `analyze()` takes `{ redact: true }` (default). File names → `file-N.ext`, project names → `Project A/B/C`, session slugs → null. Pass `redact: false` only when `--no-redact` is set.

---

## Page sections (in order)

1. **Hero** — animated count-up stats row + comparison pill
2. **Your Average Day** — 6 metric cards (compute hrs, messages, resets, MB, longest/avg turn)
3. **By Project** — horizontal bar per project with 4 stats *(hidden when only 1 project)*
4. **The Context Pulse** — SVG bar chart, one bar per session; bars reveal as playhead sweeps
5. **Put in Perspective** — 5 comparison cards (lines → novels, resets → countries, etc.)
6. **When You Work** — 24-cell hour heatmap + day-of-week bars *(hidden when no timestamp data)*
7. **Top Tool Calls + Most Edited Files** — two-column list cards
8. **Author card** *(hidden when `--author` not set)*
9. **Footer**

---

## Quick tasks

**"Add a --since flag to filter by date"**
- Edit `bin/cli.mjs`: parse `--since` → `config.since = arg('--since')`
- Edit `src/extract.mjs`: in `loadProject`, skip files whose start timestamp < cutoff

**"Add total session hours to the hero stats"**
- Edit `src/analyze.mjs`: compute `totalComputeHrs = +(totalComputeMs / 3_600_000).toFixed(1)`, add to stats
- Edit `src/render.mjs`: add a stat card in `stats-row` using `stats.totalComputeHrs`

**"Add a new metric to Put in Perspective"**
- Edit `src/comparisons.mjs`: export a new threshold array
- Edit `src/analyze.mjs`: compute the stat, add to stats
- Edit `src/comparisons.mjs` → `getComparisons()`: add a new entry using the picker
- Edit `src/render.mjs`: the `comparisons.map(...)` loop picks it up automatically

---

## Testing

```bash
# Default: all projects (redacted)
node bin/cli.mjs --out ./test-out

# Single project
node bin/cli.mjs --sessions ~/.claude/projects/my-project --out ./test-out

# Multiple projects with real names visible
node bin/cli.mjs --pick project-a --pick project-b --no-redact --out ./test-out

# Full options
node bin/cli.mjs --sessions ~/.claude/projects/my-project \
  --project "My Project" --author "Jane" --tagline "A year of shipping" \
  --out ./test-out
```

Pass criteria: page loads without console errors, animations play, numbers are plausible, no real file/project names leak in default mode.
