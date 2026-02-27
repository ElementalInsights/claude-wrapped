# claude-wrapped — Implementation Guide

`claude-wrapped` parses Claude Code's local `.jsonl` session files and generates a self-contained, animated `index.html` Wrapped-style year-in-review page. Zero dependencies, pure Node.js ESM.

---

## File map

| File | Purpose |
|------|---------|
| `bin/cli.mjs` | Entry point. Parses CLI args, loads config file, orchestrates extract → analyze → render. |
| `src/extract.mjs` | Reads `.jsonl` files from a directory, parses each line, returns an array of session objects. |
| `src/analyze.mjs` | Takes session array, computes aggregate stats (counts, totals, averages, top lists). |
| `src/comparisons.mjs` | Arrays of `{ min, label, emoji }` thresholds for fun metric comparisons. Pure data, no logic. |
| `src/render.mjs` | Single function that takes `stats` + `config`, returns a self-contained HTML string. |
| `package.json` | Package metadata. Zero runtime dependencies. `"type": "module"` for ESM. |

---

## Key data shapes

### Session object (output of `extract.mjs`)

```js
{
  id: string,              // derived from filename
  startedAt: Date,
  durationMs: number,
  messages: number,        // total message count
  contextResets: number,   // count of compact_boundary events
  toolCalls: {             // map of tool name → count
    [toolName: string]: number
  },
  editedFiles: string[],   // file paths touched by Write/Edit tool calls
  turns: {
    count: number,
    longestMs: number,
    totalMs: number        // sum of all turn durations (excludes idle)
  },
  bytesGenerated: number   // sum of assistant message content lengths
}
```

### Stats object (output of `analyze.mjs`)

```js
{
  // Totals
  sessions: number,
  messages: number,
  contextResets: number,
  bytesGenerated: number,
  linesWritten: number,    // estimated: bytesGenerated / 50

  // Per-day averages (based on active days)
  avgMessagesPerDay: number,
  avgResetsPerDay: number,
  avgMbPerDay: number,
  avgComputeHoursPerDay: number,

  // Turn stats
  longestTurnMs: number,
  avgTurnMs: number,

  // Top lists
  topTools: Array<{ name: string, count: number }>,   // top 8, sorted desc
  topFiles: Array<{ path: string, count: number }>,   // top 10, sorted desc

  // Spike session (worst/most intense single session)
  spikeSession: {
    id: string,
    date: string,
    messages: number,
    contextResets: number,
    durationMs: number
  },

  // Timeline data for the bar chart
  timeline: Array<{
    date: string,          // ISO date string
    messages: number,
    resets: number         // used for bar segmentation
  }>
}
```

### Config object (assembled in `cli.mjs`)

```js
{
  sessions: string,        // resolved absolute path to .jsonl directory (or parent)
  project: string,         // display name
  author: string | null,
  tagline: string | null,
  out: string              // resolved absolute path to output directory
}
```

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

Edit **`src/render.mjs`** only. The render function returns one long template literal. Sections are clearly delimited by HTML comments:

```js
// Inside the returned template string:

/* === YOUR NEW SECTION === */
`
<section class="section" id="my-section">
  <h2 class="section-title">My New Section</h2>
  <p>${stats.myNewStat}</p>
</section>
`
```

Steps:
1. If the section needs data that isn't in `stats` yet, add the computation to `src/analyze.mjs` and return it in the stats object.
2. Add the HTML block inside the template literal in the logical position in the page flow.
3. Add any CSS inline (inside the `<style>` block in the template) — keep it self-contained.
4. If the section needs JS (animation, chart), add it to the `<script>` block at the bottom of the template.

Do NOT split `render.mjs` into multiple files. The self-contained single-file output depends on everything being assembled in one place.

---

## How to add a new CLI flag

Edit **`bin/cli.mjs`** only.

1. Add the flag to the arg parsing section (the tool uses a simple manual loop over `process.argv`):
   ```js
   case '--my-flag':
     config.myFlag = args[++i];
     break;
   ```
2. Add the corresponding key to the config file schema (document it in the `README.md` options table).
3. Pass the value through to wherever it's consumed — typically `render.mjs` via the config object, or `extract.mjs` for filtering flags like `--since`.

---

## DO NOTs

- **Do not add npm dependencies.** Zero deps is a feature, not an oversight. Everything needed is in Node.js built-ins (`fs`, `path`, `os`, `readline`).
- **Do not split `render.mjs` into multiple files.** The output is one self-contained HTML file. Keeping the renderer as one template literal is what makes that easy. Partials, components, and build steps defeat the purpose.
- **Do not change `src/extract.mjs` parsing logic without testing against real `.jsonl` files.** The file format is undocumented and has evolved. The parsing is the most fragile part of the system. If you change it, run against actual session files from `~/.claude/projects/` before shipping.
- **Do not write to `~/.claude/` or any user data directory.** Read only. Output only goes to the `--out` directory.
- **Do not assume `.jsonl` lines are well-formed.** Wrap JSON.parse calls in try/catch. Malformed lines should be skipped, not crash the tool.

---

## Testing

There is no test suite. The test is: generate a wrapped page and open it.

```bash
# Against your real sessions (full run)
node bin/cli.mjs --out ./test-out
open ./test-out/index.html

# Against a specific project
node bin/cli.mjs --sessions ~/.claude/projects/my-project --out ./test-out
open ./test-out/index.html

# With all display options
node bin/cli.mjs \
  --sessions ~/.claude/projects/my-project \
  --project "My Project" \
  --author "Jane Smith" \
  --tagline "A year of shipping" \
  --out ./test-out
open ./test-out/index.html
```

Check: Does the page load without console errors? Do the animations play? Are the numbers plausible given your actual usage? Does it look right on a narrow viewport?

---

## Comparisons quick reference

Each metric has its own comparison array in `src/comparisons.mjs`. Current metrics with comparisons:

| Stat | Comparison array |
|------|-----------------|
| `linesWritten` | Novel lengths (Gatsby → War & Peace) |
| `contextResets` | Countries, mountain ranges, etc. |
| `sessions` | Notable streaks and milestones |
| `messages` | Human conversations, books, etc. |
| `bytesGenerated` | Wikipedia articles, encyclopedias |
