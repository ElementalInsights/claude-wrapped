// comparisons.mjs — fun threshold-based comparisons
// Each comparison picks the best matching entry from its scale

const LINES_SCALE = [
  { min: 0,       label: 'a long README',             emoji: '📄' },
  { min: 1_000,   label: 'a short story',             emoji: '📖' },
  { min: 10_000,  label: 'a novella',                 emoji: '📚' },
  { min: 50_000,  label: 'a full novel (50k words)',    emoji: '✍️'  },
  { min: 120_000, label: 'The Great Gatsby',          emoji: '🍸' },
  { min: 180_000, label: 'The Hobbit',                emoji: '🧙' },
  { min: 310_000, label: 'The Fellowship of the Ring',emoji: '💍' },
  { min: 473_000, label: 'all of Lord of the Rings',  emoji: '🧝' },
  { min: 580_000, label: 'War and Peace',             emoji: '⚔️'  },
  { min: 1_080_000,'label': 'the entire Harry Potter series', emoji: '⚡' },
];

const MSGS_SCALE = [
  { min: 0,     label: 'more than most people text in a week',       emoji: '💬' },
  { min: 500,   label: 'more than most people text in a month',      emoji: '📱' },
  { min: 2_000, label: 'more than the full script of Inception',     emoji: '🎬' },
  { min: 5_000, label: 'more than the scripts of all three Matrix films', emoji: '💊' },
  { min: 15_000,'label': 'more than the entire first season of The Wire', emoji: '📺' },
];

const COMPACTS_SCALE = [
  { min: 0,   label: 'more than a goldfish\'s daily memory resets (actually they remember fine)', emoji: '🐟' },
  { min: 10,  label: 'more times than there are planets in the solar system',  emoji: '🪐' },
  { min: 50,  label: 'more times than there are US states',                    emoji: '🇺🇸' },
  { min: 100, label: 'more times than there are elements on the periodic table',emoji: '⚗️' },
  { min: 195, label: 'more times than there are countries in the world',       emoji: '🌍' },
  { min: 366, label: 'more times than there are days in a year',               emoji: '📅' },
];

const COMPUTE_SCALE = [
  { min: 0,    label: 'enough to brew a lot of coffee',                 emoji: '☕' },
  { min: 1,    label: 'about a full workday of pure thinking',          emoji: '🧠' },
  { min: 8,    label: 'enough to watch the entire Lord of the Rings extended edition', emoji: '🧝' },
  { min: 24,   label: 'a full day of non-stop generation',              emoji: '⚡' },
  { min: 100,  label: 'enough to fly from New York to London. Twice.',  emoji: '✈️'  },
];

const TURN_SCALE = [
  { min: 0,    label: 'faster than brewing a cup of coffee',     emoji: '☕' },
  { min: 5,    label: 'about a TED talk\'s worth of thinking',   emoji: '🎙️' },
  { min: 20,   label: 'longer than most stand-ups',              emoji: '🏃' },
  { min: 45,   label: 'longer than most meetings that could\'ve been an email', emoji: '📧' },
  { min: 90,   label: 'enough time to take a proper lunch break',emoji: '🥗' },
];

function pick(scale, value) {
  let result = scale[0];
  for (const entry of scale) {
    if (value >= entry.min) result = entry;
  }
  return result;
}

export function getComparisons(stats) {
  const maxTurnMin = stats.maxTurnMs / 60000;
  const computeHrsTotal = stats.totalComputeMs / 3600000;

  return [
    {
      stat:    stats.totalLines.toLocaleString(),
      label:   'lines of code written',
      compare: `That's roughly as many words as ${pick(LINES_SCALE, stats.totalLines).label}`,
      emoji:   pick(LINES_SCALE, stats.totalLines).emoji,
    },
    {
      stat:    stats.totalMessages.toLocaleString(),
      label:   'total messages',
      compare: `${pick(MSGS_SCALE, stats.msgsPerDay).label} — every single day`,
      emoji:   pick(MSGS_SCALE, stats.msgsPerDay).emoji,
    },
    {
      stat:    stats.totalCompacts.toLocaleString(),
      label:   'context resets',
      compare: `Claude got total amnesia ${pick(COMPACTS_SCALE, stats.totalCompacts).label}`,
      emoji:   pick(COMPACTS_SCALE, stats.totalCompacts).emoji,
    },
    {
      stat:    `${computeHrsTotal.toFixed(0)} hrs`,
      label:   'total AI compute time',
      compare: `${pick(COMPUTE_SCALE, computeHrsTotal).label}`,
      emoji:   pick(COMPUTE_SCALE, computeHrsTotal).emoji,
    },
    {
      stat:    `${maxTurnMin.toFixed(1)} min`,
      label:   'longest single turn',
      compare: `${pick(TURN_SCALE, maxTurnMin).label}`,
      emoji:   pick(TURN_SCALE, maxTurnMin).emoji,
    },
  ];
}
