// Zap-N game catalogue and tunable parameters. Mechanics are reconstructions of reported games;
// every number here is a config value.

export type GameId = "balloon" | "pincode" | "codecompare" | "switch" | "numberbox" | "tower" | "shapeshift" | "grill" | "pattern" | "dial";

export interface GameMeta {
  id: GameId;
  name: string;
  skill: string;
  blurb: string;
  reaction: boolean;
  /** higher score is better unless false */
  higherIsBetter: boolean;
  scoreLabel: string;
  tutorial: string[];
}

export const GAMES: GameMeta[] = [
  {
    id: "balloon",
    name: "Balloon",
    skill: "risk taking",
    blurb: "Pump to earn, but each balloon pops at a hidden point.",
    reaction: false,
    higherIsBetter: true,
    scoreLabel: "$ banked",
    tutorial: ["Each pump adds money to the current balloon.", "Collect to bank it. If the balloon pops first you lose that balloon's money.", "Blue and orange balloons pop at different points: learn the difference."],
  },
  {
    id: "pincode",
    name: "Pincode",
    skill: "working memory",
    blurb: "Memorise a flashed digit string, then type it.",
    reaction: false,
    higherIsBetter: true,
    scoreLabel: "longest code",
    tutorial: ["A code flashes briefly.", "Type it from memory and press Enter.", "Correct → the next code is one digit longer; wrong → one shorter."],
  },
  {
    id: "codecompare",
    name: "CodeCompare",
    skill: "speed & accuracy",
    blurb: "Same or different? Decide before the window closes.",
    reaction: true,
    higherIsBetter: true,
    scoreLabel: "net correct",
    tutorial: ["Two codes appear. Press SAME (← / F) or DIFFERENT (→ / J).", "The decision window shrinks as you get answers right, down to ~0.5 s.", "Look for look-alikes: 0/O, 1/I, 5/S, 8/B."],
  },
  {
    id: "switch",
    name: "The Switch",
    skill: "task switching",
    blurb: "Follow the cue: judge the number or the arrow.",
    reaction: true,
    higherIsBetter: true,
    scoreLabel: "correct",
    tutorial: ["The cue says NUMBER or ARROW.", "NUMBER: odd → left, even → right. ARROW: press the way it points.", "Switch trials are slower — your switch cost is measured."],
  },
  {
    id: "numberbox",
    name: "NumberBox",
    skill: "arithmetic flexibility",
    blurb: "Use all four numbers with + − × ÷ to hit the target.",
    reaction: false,
    higherIsBetter: true,
    scoreLabel: "solved",
    tutorial: ["Tap numbers and operators to build an expression.", "Use every number exactly once; brackets allowed.", "Every puzzle is solvable."],
  },
  {
    id: "tower",
    name: "Skyscraper",
    skill: "planning",
    blurb: "Move blocks between towers to hit the target heights in as few moves as possible.",
    reaction: false,
    higherIsBetter: true,
    scoreLabel: "points",
    tutorial: ["Tap a tower to pick up its top block, then tap another tower to drop it.", "Reach every target height.", "Fewer moves = more points; the optimal solution is shown after each level."],
  },
  {
    id: "shapeshift",
    name: "Shapeshift",
    skill: "updating",
    blurb: "Is this shape the same as the previous one?",
    reaction: true,
    higherIsBetter: true,
    scoreLabel: "net correct",
    tutorial: ["Shapes appear one at a time.", "SAME (← / F) if the shape matches the previous shape, else DIFFERENT (→ / J).", "Colour does not matter — only the shape."],
  },
  {
    id: "grill",
    name: "Grill Master",
    skill: "multitasking",
    blurb: "Cook, flip and serve orders on several grills.",
    reaction: false,
    higherIsBetter: true,
    scoreLabel: "points",
    tutorial: ["Tap an empty grill to start the next order.", "Tap when it shows FLIP, then tap again when it shows SERVE.", "Too early or too late costs points; burnt food is wasted."],
  },
  {
    id: "pattern",
    name: "Pattern Guess",
    skill: "deduction",
    blurb: "Crack the hidden code from exact / misplaced feedback.",
    reaction: false,
    higherIsBetter: true,
    scoreLabel: "points",
    tutorial: ["Guess the 4-symbol code (repeats allowed).", "● = right symbol, right place. ○ = right symbol, wrong place.", "Fewer guesses = more points."],
  },
  {
    id: "dial",
    name: "Stock Indicator",
    skill: "timing",
    blurb: "Stop the needle inside the target zone.",
    reaction: true,
    higherIsBetter: true,
    scoreLabel: "hits",
    tutorial: ["A needle sweeps around the dial.", "Tap (or press Space) when it is inside the green zone.", "It speeds up every round."],
  },
];

export const GAME_MAP = new Map(GAMES.map((g) => [g.id, g]));

export const PARAMS = {
  balloon: {
    pumpValue: 0.05,
    balloons: 20,
    colours: [
      { name: "blue", max: 64, color: "#5b8cff" },
      { name: "orange", max: 16, color: "#f0a030" },
    ],
  },
  pincode: { startLength: 4, minLength: 3, showMsBase: 600, showMsPerDigit: 350 },
  codecompare: { startWindowMs: 3000, minWindowMs: 500, shrink: 0.9, grow: 1.15, diffProb: 0.5, minLen: 5, maxLen: 8 },
  switch: { trials: 64, randomSwitch: true, switchProb: 0.5, timeoutMs: 3000 },
  numberbox: { minN: 1, maxN: 13, targets: [24, 24, 24, 10, 12, 18, 20, 30, 36] },
  tower: { pegs: 3, startBlocks: 3, maxBlocks: 6 },
  shapeshift: { sameProb: 0.5, stimulusMs: 2000, colourDistractorFrom: 10 },
  grill: { grills: 3, items: [
    { name: "Sausage", cookMs: 6000 },
    { name: "Burger", cookMs: 8000 },
    { name: "Steak", cookMs: 12000 },
  ], windowMs: 1500, orderEveryMs: 5000 },
  pattern: { length: 4, symbols: 6, maxGuesses: 10 },
  dial: { startDegPerSec: 120, speedUp: 1.08, zoneDeg: 30, rounds: 30 },
};
