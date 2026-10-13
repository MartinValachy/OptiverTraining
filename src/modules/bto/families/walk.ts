import { F } from "@/lib/fraction";
import { type BtoFamily, type Scenario, fr, pctStr } from "../core";

export interface NamedGraph {
  name: string;
  /** adjacency list */
  adj: number[][];
  vertexName: (v: number) => string;
}

export function graphs(r: { int(a: number, b: number): number }): NamedGraph[] {
  const m = r.int(3, 6);
  const star: NamedGraph = {
    name: `a star: one centre joined to ${m} leaves (no other edges)`,
    adj: [Array.from({ length: m }, (_, i) => i + 1), ...Array.from({ length: m }, () => [0])],
    vertexName: (v) => (v === 0 ? "the centre" : "a leaf"),
  };
  const n = r.int(4, 7);
  const path: NamedGraph = {
    name: `a path of ${n} vertices in a line`,
    adj: Array.from({ length: n }, (_, i) => [i - 1, i + 1].filter((j) => j >= 0 && j < n)),
    vertexName: (v) => (v === 0 ? "an end vertex" : `vertex ${v + 1} from one end`),
  };
  const k = r.int(4, 7);
  const complete: NamedGraph = {
    name: `a complete graph on ${k} vertices (every pair joined)`,
    adj: Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => j).filter((j) => j !== i)),
    vertexName: () => "any vertex",
  };
  const w = r.int(4, 7);
  const wheel: NamedGraph = {
    name: `a wheel: a hub joined to each of ${w} rim vertices that also form a cycle`,
    adj: [Array.from({ length: w }, (_, i) => i + 1), ...Array.from({ length: w }, (_, i) => [0, ((i + w - 1) % w) + 1, ((i + 1) % w) + 1])],
    vertexName: (v) => (v === 0 ? "the hub" : "a rim vertex"),
  };
  const cube: NamedGraph = {
    name: "the 8 corners of a cube, moving along edges",
    adj: Array.from({ length: 8 }, (_, v) => [v ^ 1, v ^ 2, v ^ 4]),
    vertexName: () => "a corner",
  };
  return [star, path, complete, wheel, cube];
}

export const walk: BtoFamily = {
  id: "walk",
  name: "Random walks",
  blurb: "Return times on cycles and graphs, hitting probabilities",
  generate(r, d): Scenario {
    const sub = d === 1 ? r.pick(["cycle_return", "line_hit"]) : d === 2 ? r.pick(["cycle_hit", "cycle_return", "line_hit"]) : r.pick(["graph_return", "cover_cycle", "cycle_hit"]);

    if (sub === "cycle_return") {
      const n = r.int(4, 12);
      return {
        sub,
        text: `A token sits on one of ${n} points arranged in a circle. Each step it moves to the clockwise or anticlockwise neighbour with probability 1/2 each. What is the expected number of steps until it first returns to its starting point?`,
        unit: "num",
        answer: fr(F(n)),
        distractors: [
          { value: fr(F(2)), why: "the shortest possible return" },
          { value: fr(F(n * n, 4)), why: "the expected time to reach the opposite point" },
          { value: fr(F(n * (n - 1), 2)), why: "the expected time to visit every point" },
          { value: fr(F(2 * n)), why: "twice the number of points" },
          { value: fr(F(n - 1)), why: "number of other points" },
        ],
        solution: [
          "The walk is symmetric, so its stationary distribution is uniform: π = 1/n for every point.",
          `Expected return time = 1/π = ${n} (Kac's lemma).`,
        ],
        hint: "Expected return time = 1 / stationary probability.",
        params: { sub, n },
      };
    }
    if (sub === "line_hit") {
      const a = r.int(1, 8);
      const b = r.int(1, 8);
      const ans = F(b, a + b);
      return {
        sub,
        text: `A token starts at 0 on the integer line and moves +1 or −1 with probability 1/2 each step. What is the probability it reaches +${a} before −${b}?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(a, a + b)), why: "swapping the distances" },
          { value: fr(F(1, 2)), why: "ignoring the distances" },
          { value: fr(F(1, 2).pow(a)), why: "moving straight up" },
          { value: fr(F(Math.min(a, b), Math.max(a, b))), why: "ratio of distances" },
        ],
        solution: ["Position is a martingale, so E[final] = 0.", `${a}·P − ${b}·(1 − P) = 0 ⇒ P = ${b}/(${a}+${b}) ≈ ${pctStr(ans)}.`],
        hint: "Optional stopping: expected final position = start.",
        params: { sub, a, b },
      };
    }
    if (sub === "cycle_hit") {
      const n = r.int(5, 12);
      const k = r.int(1, n - 1);
      const ans = F(k * (n - k));
      return {
        sub,
        text: `${n} points are arranged in a circle. A token starts at one point and each step moves to a uniformly random neighbour. Target: the point ${k} steps clockwise from the start. What is the expected number of steps to first reach the target?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(F(k * k)), why: "k²: ignoring the other way round" },
          { value: fr(F(Math.min(k, n - k))), why: "shortest distance" },
          { value: fr(F(n)), why: "the return time" },
          { value: fr(F(n * n, 4)), why: "the opposite-point answer" },
          { value: fr(F(k * n)), why: "k·n" },
        ],
        solution: [
          "Cut the circle at the target: it becomes a line from the target to itself of length n.",
          `Starting k from one end and n−k from the other, the gambler's-ruin duration is k(n−k) = ${ans}.`,
        ],
        hint: "Unroll the circle into a segment whose both ends are the target.",
        params: { sub, n, k },
      };
    }
    if (sub === "cover_cycle") {
      const n = r.int(4, 10);
      const ans = F((n * (n - 1)) / 2);
      return {
        sub,
        text: `A token performs a simple random walk on ${n} points arranged in a circle (each step to a uniformly random neighbour). What is the expected number of steps until it has visited every point?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(F(n - 1)), why: "visiting each point once in a row" },
          { value: fr(F(n * n)), why: "n²" },
          { value: fr(F(n)), why: "the return time" },
          { value: fr(F((n - 1) * (n - 1))), why: "(n−1)²" },
          { value: fr(F(n * (n - 1))), why: "forgetting the 1/2" },
        ],
        solution: [
          "The visited set is always an arc. With m points visited and the walker at an end, the next new point is reached after a gambler's-ruin duration of m steps on average.",
          `Total: 1 + 2 + … + ${n - 1} = ${n}·${n - 1}/2 = ${ans}.`,
        ],
        hint: "Extending a visited arc of m points takes m expected steps.",
        params: { sub, n },
      };
    }
    // graph_return
    const gs = graphs(r);
    const g = r.pick(gs);
    const vChoices = g.adj.map((_, i) => i);
    const v = vChoices[r.int(0, Math.min(1, vChoices.length - 1))];
    const E = g.adj.reduce((a, l) => a + l.length, 0) / 2;
    const deg = g.adj[v].length;
    const ans = F(2 * E, deg);
    return {
      sub,
      text: `A token walks on ${g.name}; each step it moves to a uniformly random neighbour. Starting from ${g.vertexName(v)}, what is the expected number of steps until it first returns there?`,
      unit: "num",
      answer: fr(ans),
      distractors: [
        { value: fr(F(g.adj.length)), why: "number of vertices (true only for regular graphs)" },
        { value: fr(F(2 * E)), why: "2|E| without dividing by the degree" },
        { value: fr(F(E, deg)), why: "|E|/deg(v): forgetting the factor 2" },
        { value: fr(F(deg)), why: "the degree" },
        { value: fr(F(2)), why: "go out and back immediately" },
      ],
      solution: [
        "For a random walk on a graph, π(v) = deg(v)/(2|E|).",
        `Here |E| = ${E}, deg = ${deg}: expected return time = 2|E|/deg(v) = ${ans}${ans.isInteger() ? "" : ` ≈ ${ans.toNumber().toFixed(2)}`}.`,
      ],
      hint: "Return time = 1/π(v), with π(v) ∝ degree.",
      params: { sub, adj: g.adj, v },
    };
  },
};
