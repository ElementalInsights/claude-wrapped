# claude-wrapped — Implementation Guide

`claude-wrapped` parses Claude Code's local `.jsonl` session files and generates a self-contained, animated `index.html` Wrapped-style year-in-review page. Zero dependencies, pure Node.js ESM.

---

## File map

| File | Purpose |
|------|---------|
| `bin/cli.mjs` | Entry point. Parses CLI args, loads config file, orchestrates extract → analyze → render. |
| `src/extract.mjs` | Reads `.jsonl` files from a directory, parses each line, returns an array of session objects. |
| `src/analyze.mjs` | Takes session array + options, computes aggregate stats (counts, totals, averages, top lists, rhythms). |
| `src/comparisons.mjs` | Arrays of `{ min, label, emoji }` thresholds for fun metric comparisons. Pure data, no logic. |
| `src/benchmarks.mjs` | Community baselines (2026 estimates) + Steam-style achievement logic. `getAchievements(stats)` returns unlocked achievements sorted by tier. |
| `src/render.mjs` | Single function: `render(stats, comparisons, config, achievements)` → self-contained HTML string. |
| `package.json` | Package metadata. Zero runtime dependencies. `"type": "module"` for ESM. |

---

## Key data shapes

### Session object (output of `extract.mjs`)

```js
{
  id:               string,   // first 8 chars of .jsonl filename
  slug:             string | null,
  gitBranch:        string | null,
  startTime:        string | null,   // ISO 8601 (first timestamp in file)
  endTime:          string | null,   // ISO 8601 (last timestamp in file)
  fileSizeBytes:    number,
  userMessages:     number,
  assistantMessages:number,
  compacts:         number,          // compact_boundary events = context resets
  compactPositions: number[],        // normalised positions (0–1) within file
  turnDurations:    number[],        // ms per assistant turn (from turn_duration events)
  toolCalls:        { [toolName: string]: number },
  filesEdited:      { [filename: string]: number },  // filename only (no full path)
  linesWritten:     number,          // newline count across all Edit/Write outputs
  apiErrors:        number,
  totalRecords:     number
}
```

### Stats object (output of `analyze.mjs`)

```js
{
  // Totals
  sessionCount:   number,
  totalMessages:  number,
  totalCompacts:  number,
  totalGB:        number,
  totalMB:        number,
  totalLines:     number,
  totalComputeMs: number,

  // Turn stats
  avgTurnMs: number,
  maxTurnMs: number,

  // Per-day averages (spanned from firstDay to lastDay)
  msgsPerDay:     number,
  compactsPerDay: number,
  mbPerDay:       number,
  computeHrsDay:  number,

  // Date range
  spanDays: number,
  firstDay: string,   // 'YYYY-MM-DD'
  lastDay:  string,

  // Top lists — sorted desc by count
  topTools: [string, number][],   // [toolName, callCount] — top 8
  topFiles: [string, number][],   // [filename, editCount] — top 5; anonymised by default

  // Hardest session
  spikeSession: { compacts: number, sizeMB: number, slug: string },

  // Slim chart data — one entry per session, sorted by startTime
  slim: Array<{
    id: string, slug: string | null, compacts: number,
    sizeMB: number, msgs: number, positions: number[],
    turns: number[], start: string | null
  }>,

  // Per-project breakdown (only populated when >1 project directory loaded)
  // Names are anonymised by default ('Project A', 'Project B' ...)
  projects: Array<{
    name: string, sessions: number, messages: number,
    compacts: number, lines: number, computeHrs: number, topTool: string
  }>,

  // Coding rhythm (derived from session startTime — hour/day sessions began)
  messagesByHour: number[24],   // index = hour of day (0–23, local time)
  messagesByDow:  number[7],    // index = day of week (0=Mon … 6=Sun)
}
```

### Config object (assembled in `cli.mjs`)

```js
{
  sessions:  string,         // resolved absolute path to .jsonl directory
  project:   string,         // display name shown in header
  author:    string | null,
  tagline:   string | null,
  out:       string,         // resolved absolute path to output directory
  noRedact:  boolean         // true = real names; default false = anonymised
}
```

---

## Privacy & redaction

`analyze()` accepts `{ redact: true }` (the default). When redacting:

- **File names** (`topFiles`) → `file-1.tsx`, `file-2.ts` … (extension preserved)
- **Project names** (`projects[].name`) → `Project A`, `Project B` …
- **Session slugs** (`slim[].slug`) → `null`

Pass `{ redact: false }` only when the user passes `--no-redact`. The output HTML never contains conversation content — only counts, durations, and timestamps.

---

## How to add a new comparison

Edit **`src/comparisons.mjs`** only. Each exported constant is an array of threshold objects:

```js
export const linesWrittenComparisons = [
  { min: 0,       label: 'A solid commit message. But longer.', emoji: '📝' },
  { min: 10_000,  label: 'About the length of The Great Gatsby.', emoji: '📗' },
  { min: 100_000, label: 'One War & Peace. Written in code.', emoji: '📚' },
  { min: 500_000, label: 'Five War & Peace novels. In code.', emoji: '🏛️' },
];
```

Rules:
- Entries must be sorted ascending by `min`.
- The renderer picks the last entry whose `min` <= the user's stat value.
- The `label` string is rendered verbatim — make it punchy.
- To add a comparison for a **new metric**, export a new array and import it in `src/render.mjs` — then call the picker utility and wire the result into the template.

---

## How to add a new template section

Edit **`src/render.mjs`** only. The render function returns one long template literal. Add new `<section>` blocks in page-flow order. For conditional sections, gate with a ternary:

```js
// Unconditional:
`<section class="section" id="my-section">...</section>`

// Conditional (e.g. only when data exists):
`${stats.myData.length > 0 ? `<section ...>...</section>` : ''}`
```

Steps:
1. If the section needs data not yet in `stats`, add the computation to `src/analyze.mjs` and return it.
2. Add HTML inside the template literal.
3. Add CSS in the `<style>` block at the top of the template.
4. Add JS animations/interactivity in the `<script>` block at the bottom.
5. Guard any ScrollTrigger.create calls with `if(document.getElementById('my-section'))` so they don't throw when the section is absent.

Do NOT split `render.mjs` into multiple files. The self-contained single-file output depends on everything being assembled in one place.

---

## Page sections (render order)

1. **Hero** — animated count-up stats + comparison pill
2. **Your Average Day** — 6 metric cards
3. **By Project** — horizontal bars per project *(hidden when ≤1 project)*
4. **The Context Pulse** — SVG bar chart; bars reveal via clipPath as playhead sweeps, default 2× speed
5. **Put in Perspective** — 5 comparison cards
6. **Achievements** — 12 Steam-style Bronze/Silver/Gold/Platinum cards vs community baselines; all 12 always shown (locked = dimmed); click any card → tier breakdown popup; **"📊 Share benchmark data"** button → modal with markdown table + clipboard copy + GitHub Discussion link + Canvas share card download
7. **Coding Rhythm** — GitHub activity calendar + hour heatmap + day-of-week bars + personality badge *(hidden when no timestamps)*
8. **Top Tool Calls + Most Edited Files** — two-column list
9. **Author card** *(hidden when `--author` not set)*
10. **Footer**

---

## How to add a new CLI flag

Edit **`bin/cli.mjs`** only.

1. Add detection using the `flag(f)` or `arg(f)` helpers:
   ```js
   if (flag('--my-flag'))   config.myFlag = true;
   if (arg('--my-value'))   config.myValue = arg('--my-value');
   ```
2. Add it to the `--help` text.
3. Pass the value through to wherever it's consumed — typically `render.mjs` via the config object, or `analyze.mjs` for data-shaping flags like `--no-redact`.

---

## DO NOTs

- **Do not add npm dependencies.** Zero deps is a feature, not an oversight. Everything needed is in Node.js built-ins (`fs`, `path`, `os`, `readline`).
- **Do not split `render.mjs` into multiple files.** The output is one self-contained HTML file. Keeping the renderer as one template literal is what makes that easy. Partials, components, and build steps defeat the purpose.
- **Do not change `src/extract.mjs` parsing logic without testing against real `.jsonl` files.** The file format is undocumented and has evolved. The parsing is the most fragile part of the system. If you change it, run against actual session files from `~/.claude/projects/` before shipping.
- **Do not write to `~/.claude/` or any user data directory.** Read only. Output only goes to the `--out` directory.
- **Do not assume `.jsonl` lines are well-formed.** Wrap JSON.parse calls in try/catch. Malformed lines should be skipped, not crash the tool.
- **Do not expose real file/project names by default.** Redaction (`redact: true`) is the default. Only disable with explicit `--no-redact`.
- **Do not use `\n` or `\'` inside JS strings that live inside the template literal.** The template literal consumes one level of escaping — `\n` becomes a literal newline in the HTML, breaking the inline JS. Use `\\n` to get `\n` in the output, or assign `const NL='\\n'` and concatenate. Same rule for apostrophes: use double-quoted strings or `\\u0027` instead of `\'`.

---

## Testing

There is no test suite. The test is: generate a wrapped page and open it.

```bash
# Default (redacted, all projects)
node bin/cli.mjs --out ./test-out

# Single project
node bin/cli.mjs --sessions ~/.claude/projects/my-project --out ./test-out

# Multiple projects with real names
node bin/cli.mjs --pick project-a --pick project-b --no-redact --out ./test-out

# Full options
node bin/cli.mjs \
  --sessions ~/.claude/projects/my-project \
  --project "My Project" \
  --author "Jane Smith" \
  --tagline "A year of shipping" \
  --out ./test-out
```

Check: Does the page load without console errors? Do the animations play? Do bars reveal left→right? Does the "By Project" section show when multiple projects are loaded? Are file names anonymised by default?
