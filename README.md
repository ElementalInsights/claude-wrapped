# claude-wrapped

Spotify Wrapped for your Claude Code sessions.

Parses the `.jsonl` session files Claude Code saves locally, crunches the numbers, and generates a self-contained `index.html` — animated stats, charts, and comparisons that tell the story of how you actually used AI to write code.

No server. No account. No dependencies. One command.

---

## What you get

```
┌─────────────────────────────────────────────────────────┐
│  claude-wrapped                          dark mode html  │
├─────────────────────────────────────────────────────────┤
│  ✦ Animated hero stats                                  │
│    Sessions · Messages · Context resets · GB generated  │
│    Lines written · Fun comparison pill                  │
│                                                         │
│  ✦ Your Average Day                                     │
│    6 cards: compute hours, messages, resets/day,        │
│    MB/day, longest turn, avg turn                       │
│                                                         │
│  ✦ Session Timeline (interactive)                       │
│    Every session = one bar, segments = context resets   │
│    Auto-plays, scrubable                                │
│                                                         │
│  ✦ Put in Perspective                                   │
│    Lines written = X War & Peace novels                 │
│    Resets > number of countries in the world            │
│    (5 comparison cards, thresholds fully editable)      │
│                                                         │
│  ✦ Tool Call Breakdown                                  │
│    Top tool calls by count                              │
│                                                         │
│  ✦ Most Edited Files                                    │
│    Files you kept coming back to                        │
│                                                         │
│  ✦ Spike Session                                        │
│    Your hardest session — longest, most resets          │
└─────────────────────────────────────────────────────────┘
```

---

## Quick start

```bash
git clone https://github.com/ElementalInsights/claude-wrapped
cd claude-wrapped
node bin/cli.mjs --list          # see what projects you have
node bin/cli.mjs                 # run against all of them
```

Open `./wrapped/index.html`. Done.

---

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--list` | List all projects in `~/.claude/projects/` and exit | — |
| `--pick <name>` | Pick a project by folder name — repeatable | — |
| `--sessions <path>` | Explicit path to a project dir — repeatable | all projects |
| `--project <name>` | Display name shown in the header | folder name |
| `--author <name>` | Your name, shown in the footer | — |
| `--tagline <text>` | Subtitle under the project name | auto-generated |
| `--out <dir>` | Output directory | `./wrapped` |
| `--config <file>` | Load options from a JSON file | `claude-wrapped.config.json` |

### Examples

```bash
# See what projects you have
node bin/cli.mjs --list

# One project
node bin/cli.mjs --pick my-saas --project "My SaaS" --author "Jake Edwards"

# Multiple projects merged into one page
node bin/cli.mjs --pick project-a --pick project-b --project "Everything"

# Explicit paths (repeatable)
node bin/cli.mjs --sessions ~/.claude/projects/my-app --sessions ~/other/project

# All projects, custom output dir
node bin/cli.mjs --project "2025 Wrapped" --out ./site
```

### Config file

Drop a `claude-wrapped.config.json` anywhere and run `node bin/cli.mjs`:

```json
{
  "sessions": "~/.claude/projects/my-project",
  "project": "My SaaS",
  "author": "Jane Smith",
  "tagline": "Six months. One AI. Here's what actually happened.",
  "out": "./site"
}
```

For multi-project via config, use `--pick` flags on the CLI (repeatable flags aren't in the config file yet).

---

## How it works

Claude Code saves every session as a `.jsonl` file under `~/.claude/projects/<project>/`. Each line is a JSON object: a message, a tool call, a system event, or a turn marker. `claude-wrapped` reads those files, parses the structure, aggregates stats, and renders everything into a single self-contained HTML file using a template literal. No build step, no bundler, no server.

```
~/.claude/projects/
  my-project/
    2024-01-15T10-30-00.jsonl
    2024-01-16T09-00-00.jsonl
    ...
          │
          ▼
    extract.mjs   →   session[]
          │
          ▼
    analyze.mjs   →   stats{}
          │
          ▼
    render.mjs    →   index.html
```

---

## Customising

The project is intentionally small and readable. Two files cover 90% of what you'd want to change.

**`src/comparisons.mjs`** — arrays of `{ min, label, emoji }` thresholds. Add, remove, or rewrite the comparisons. Each array corresponds to one metric (lines written, resets, sessions, etc.). The renderer picks the highest threshold the user's stats exceed.

```js
// example entry
{ min: 500_000, label: 'Five War & Peace novels. Written in code.', emoji: '📚' }
```

**`src/render.mjs`** — one big template literal that generates the full HTML. Every section is a clearly labelled HTML block inside the function. Add a new `<section>`, wire in a data variable from `stats`, done.

---

## Customising with Claude

Since you're already a Claude Code user, here are prompts you can paste directly into a Claude session to extend the tool:

**Add a time-of-day heatmap:**
```
Add a new section to src/render.mjs called "When You Work Best" that shows
a heatmap of messages by hour of day. Extract the hour data in src/analyze.mjs
from the session timestamps and pass it through to the renderer as
stats.messagesByHour (array of 24 numbers).
```

**Add movie-length comparisons:**
```
Update src/comparisons.mjs to add a new comparison array for total session
hours. Include thresholds comparing the total to famous movie runtimes —
e.g. "Longer than every Lord of the Rings film back to back."
Use the same { min, label, emoji } shape as the existing arrays.
```

**Switch to a light theme:**
```
Modify the CSS in src/render.mjs to use a light colour scheme instead of
dark. Keep the same layout and animations. Replace dark backgrounds with
white/light grey, ensure contrast ratios stay accessible (WCAG AA).
```

**Add a --since flag:**
```
Add a --since flag to bin/cli.mjs that accepts a date string (e.g.
"2024-06-01") and filters sessions to only those that started on or after
that date. Parse it in the arg handling section and pass it to the config
object. In src/extract.mjs, skip any .jsonl files whose filename/first
timestamp is before the cutoff.
```

**Add a weekly activity chart:**
```
Add a "Weekly Rhythm" section to src/render.mjs showing a bar chart of
messages per day-of-week (Mon–Sun). Compute stats.messagesByDayOfWeek
(array of 7 numbers, 0=Mon) in src/analyze.mjs. Render it using the same
inline SVG/canvas approach used for the session timeline.
```

---

## Contributing

Bug reports and PRs welcome. Keep it zero-dependency. If you're adding a new visualisation, add it to `src/render.mjs` and the data it needs to `src/analyze.mjs`. Keep `src/extract.mjs` stable — the parsing logic is load-bearing.

---

## License

MIT

---

Created by [Jake Edwards](https://www.linkedin.com/in/jake-edwards-a6a334a/) · Co-founder at [Elemental Insights](https://elementalinsights.com)
