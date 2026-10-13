// Serializable visual descriptions shared by Intervals and Likelihood-list.

export type ShapeType = "square" | "circle" | "triangle";

export type Visual =
  | { kind: "table"; caption?: string; headers: string[]; rows: (string | number)[][] }
  | { kind: "curves"; xLabel: string; series: { name: string; points: [number, number][] }[]; markers?: number[] }
  | { kind: "hist"; xLabel: string; edges: number[]; series: { name: string; counts: number[] }[] }
  | { kind: "scatter"; xLabel: string; yLabel: string; points: [number, number][]; domain: [number, number] }
  | { kind: "lines"; xLabel: string; series: { name: string; values: number[] }[] }
  | { kind: "graph"; nodes: { id: string; x: number; y: number }[]; edges: { from: number; to: number; label: string }[] }
  | { kind: "shapes"; w: number; h: number; cell: number; shapes: { t: ShapeType; c: number; r: number }[] }
  | { kind: "dots"; size: number; dots: [number, number][]; region: { type: "circle"; cx: number; cy: number; r: number } | { type: "rect"; x: number; y: number; w: number; h: number } };
