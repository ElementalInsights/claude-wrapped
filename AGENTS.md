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
  id: string,
  startedAt: Date,
  durationMs: number,
  messages: number,
  contextResets: number,
  toolCalls: { [name: string]: number },
  editedFiles: string[],
  turns: { count: number, longestMs: number, totalMs: number },
  bytesGenerated: number
}
```

**Stats** (from `analyze.mjs`):
```js
{
  sessions, messages, contextResets, bytesGenerated, linesWritten,
  avgMessagesPerDay, avgResetsPerDay, avgMbPerDay, avgComputeHoursPerDay,
  longestTurnMs, avgTurnMs,
  topTools: [{ name, count }],     // top 8
  topFiles: [{ path, count }],     // top 10
  spikeSession: { id, date, messages, contextResets, durationMs },
  timeline: [{ date, messages, resets }]
}
```

**Config** (assembled in `cli.mjs`):
```js
{ sessions: string, project: string, author: string|null, tagline: string|null, out: string }
```

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
| Change output filename | `bin/cli.mjs` (write step) |

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
```

---

## Hard constraints

- **No npm dependencies** — use Node.js built-ins only (`fs`, `path`, `os`, `readline`, `url`).
- **Do not split `render.mjs`** — self-contained HTML output requires all rendering in one place.
- **Do not modify extract.mjs parsing without testing against real `.jsonl` files** — format is undocumented, parsing is fragile. Test with actual `~/.claude/projects/` data.
- **Read-only access to user data** — never write to `~/.claude/` or any source directory.
- **Wrap JSON.parse in try/catch** — malformed lines must be skipped, not crash the process.

---

## Quick tasks

**"Add a comparison for total session hours"**
- Edit `src/comparisons.mjs`: add `export const totalHoursComparisons = [...]`
- Edit `src/analyze.mjs`: compute `totalHours` from session durations, add to stats
- Edit `src/render.mjs`: import the array, call the threshold picker, insert a comparison card

**"Add a section showing most active hours of day"**
- Edit `src/analyze.mjs`: loop session messages, extract hour from timestamp, build `messagesByHour: number[24]`, add to stats
- Edit `src/render.mjs`: add a `<section>` with a canvas/SVG bar chart rendered via inline JS using `stats.messagesByHour`

**"Add a --since flag to filter by date"**
- Edit `bin/cli.mjs`: add `case '--since': config.since = args[++i]; break;`
- Edit `src/extract.mjs`: accept `since` in options, skip files whose start timestamp is before the cutoff

**"Add a weekly day-of-week chart"**
- Edit `src/analyze.mjs`: compute `messagesByDayOfWeek: number[7]` (0=Monday), add to stats
- Edit `src/render.mjs`: add a new section with an inline SVG/canvas chart using that data

**"Change the colour scheme to light mode"**
- Edit `src/render.mjs`: find the `<style>` block, update CSS custom properties (`--bg`, `--surface`, `--text`, etc.) and any hardcoded colour values

**"Add total session hours to the hero stats"**
- Edit `src/analyze.mjs`: compute `totalHours` (sum `durationMs` / 3_600_000), add to stats
- Edit `src/render.mjs`: add a stat card in the hero section using `stats.totalHours`

---

## Testing

```bash
# Default: all projects
node bin/cli.mjs --out ./test-out && open ./test-out/index.html

# Single project
node bin/cli.mjs --sessions ~/.claude/projects/my-project --out ./test-out

# Full options
node bin/cli.mjs --sessions ~/.claude/projects/my-project \
  --project "My Project" --author "Jane" --tagline "A year of shipping" \
  --out ./test-out
```

Pass criteria: page loads without console errors, animations play, numbers are plausible.
