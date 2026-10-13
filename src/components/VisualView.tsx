"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";
import type { Visual } from "@/modules/visual";

export const SERIES_COLORS = ["#5b8cff", "#f0a030", "#2fbf71", "#e05d9b"];
const AXIS = { stroke: "var(--muted)", fontSize: 11 };

export function VisualView({ v }: { v: Visual }) {
  switch (v.kind) {
    case "table":
      return (
        <div className="overflow-x-auto">
          {v.caption && <div className="mb-1 text-xs text-muted">{v.caption}</div>}
          <table className="tabular w-full border-collapse text-xs sm:text-sm" data-testid="visual-table">
            <thead>
              <tr>
                {v.headers.map((h, i) => (
                  <th key={i} className="border-b border-line px-1.5 py-1 text-right font-medium text-muted first:text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((c, j) => (
                    <td key={j} className="border-b border-line/50 px-1.5 py-1 text-right first:text-left">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "curves": {
      const xs = v.series[0].points.map((p) => p[0]);
      const data = xs.map((x, i) => Object.fromEntries([["x", x], ...v.series.map((s) => [s.name, s.points[i][1]])]));
      return (
        <div className="h-52 w-full" data-testid="visual-chart">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} tick={AXIS} />
              <YAxis tick={false} />
              {v.markers?.map((m) => <ReferenceLine key={m} x={m} stroke="var(--muted)" strokeDasharray="4 2" label={{ value: m, fill: "var(--muted)", fontSize: 10, position: "top" }} />)}
              {v.series.map((s, i) => (
                <Line key={s.name} dataKey={s.name} dot={false} stroke={SERIES_COLORS[i]} strokeWidth={2} isAnimationActive={false} />
              ))}
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case "hist": {
      const data = v.edges.slice(0, -1).map((e, i) => Object.fromEntries([["bin", `${e}–${v.edges[i + 1]}`], ...v.series.map((s) => [s.name, s.counts[i]])]));
      return (
        <div className="h-52 w-full" data-testid="visual-chart">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="bin" tick={AXIS} interval={0} angle={-30} textAnchor="end" height={40} />
              <YAxis tick={AXIS} allowDecimals={false} />
              {v.series.map((s, i) => (
                <Bar key={s.name} dataKey={s.name} fill={SERIES_COLORS[i]} isAnimationActive={false} />
              ))}
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case "scatter":
      return (
        <div className="aspect-square w-full max-w-sm" data-testid="visual-chart">
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" domain={v.domain} tick={AXIS} ticks={[0, 20, 40, 60, 80, 100]} />
              <YAxis type="number" dataKey="y" domain={v.domain} tick={AXIS} ticks={[0, 20, 40, 60, 80, 100]} />
              <Scatter data={v.points.map(([x, y]) => ({ x, y }))} fill={SERIES_COLORS[0]} isAnimationActive={false} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      );
    case "lines": {
      const data = v.series[0].values.map((_, i) => Object.fromEntries([["t", i], ...v.series.map((s) => [s.name, s.values[i]])]));
      return (
        <div className="h-52 w-full" data-testid="visual-chart">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={AXIS} />
              <YAxis tick={AXIS} domain={["auto", "auto"]} />
              {v.series.map((s, i) => (
                <Line key={s.name} dataKey={s.name} dot={false} stroke={SERIES_COLORS[i]} strokeWidth={1.8} isAnimationActive={false} />
              ))}
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case "graph":
      return <GraphSvg v={v} />;
    case "shapes":
      return <ShapesSvg v={v} />;
    case "dots": {
      const { size, dots, region } = v;
      return (
        <svg viewBox={`-2 -2 ${size + 4} ${size + 4}`} className="mx-auto block w-full max-w-sm" data-testid="visual-dots" role="img" aria-label="dot field">
          <rect x={0} y={0} width={size} height={size} fill="none" stroke="var(--border)" />
          {region.type === "circle" ? (
            <circle cx={region.cx} cy={region.cy} r={region.r} fill="var(--accent)" fillOpacity={0.18} stroke="var(--accent)" />
          ) : (
            <rect x={region.x} y={region.y} width={region.w} height={region.h} fill="var(--accent)" fillOpacity={0.18} stroke="var(--accent)" />
          )}
          {dots.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={1.9} fill="var(--fg)" />
          ))}
        </svg>
      );
    }
  }
}

function ShapesSvg({ v }: { v: Extract<Visual, { kind: "shapes" }> }) {
  const c = v.cell;
  const s = c * 0.36;
  return (
    <svg viewBox={`0 0 ${v.w * c} ${v.h * c}`} className="mx-auto block w-full max-w-md" data-testid="visual-shapes" role="img" aria-label="grid of shapes">
      {v.shapes.map((sh, i) => {
        const cx = sh.c * c + c / 2;
        const cy = sh.r * c + c / 2;
        if (sh.t === "square") return <rect key={i} x={cx - s} y={cy - s} width={2 * s} height={2 * s} fill="var(--fg)" />;
        if (sh.t === "circle") return <circle key={i} cx={cx} cy={cy} r={s * 1.1} fill="var(--fg)" />;
        return <polygon key={i} points={`${cx},${cy - s * 1.2} ${cx - s * 1.2},${cy + s} ${cx + s * 1.2},${cy + s}`} fill="var(--fg)" />;
      })}
    </svg>
  );
}

function GraphSvg({ v }: { v: Extract<Visual, { kind: "graph" }> }) {
  const R = 22;
  return (
    <svg viewBox="0 0 300 240" className="mx-auto block w-full max-w-sm" data-testid="visual-graph" role="img" aria-label="state diagram">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted)" />
        </marker>
      </defs>
      {v.edges.map((e, i) => {
        const a = v.nodes[e.from];
        const b = v.nodes[e.to];
        if (e.from === e.to) {
          const up = a.y < 120 ? -1 : 1;
          const y0 = a.y + up * R;
          return (
            <g key={i}>
              <path d={`M ${a.x - 10} ${y0} C ${a.x - 30} ${y0 + up * 40}, ${a.x + 30} ${y0 + up * 40}, ${a.x + 10} ${y0}`} fill="none" stroke="var(--muted)" markerEnd="url(#arrow)" />
              <text x={a.x} y={y0 + up * 38} textAnchor="middle" fontSize="12" fill="var(--fg)">
                {e.label}
              </text>
            </g>
          );
        }
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        const ux = dx / len;
        const uy = dy / len;
        // offset perpendicular so A→B and B→A do not overlap
        const ox = -uy * 10;
        const oy = ux * 10;
        const x1 = a.x + ux * R + ox;
        const y1 = a.y + uy * R + oy;
        const x2 = b.x - ux * R + ox;
        const y2 = b.y - uy * R + oy;
        const mx = (x1 + x2) / 2 + ox * 1.4;
        const my = (y1 + y2) / 2 + oy * 1.4;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" markerEnd="url(#arrow)" />
            <text x={mx} y={my + 4} textAnchor="middle" fontSize="12" fill="var(--fg)" paintOrder="stroke" stroke="var(--card)" strokeWidth={3}>
              {e.label}
            </text>
          </g>
        );
      })}
      {v.nodes.map((n) => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={R} fill="var(--card2)" stroke="var(--accent)" strokeWidth={2} />
          <text x={n.x} y={n.y + 5} textAnchor="middle" fontSize="15" fontWeight={600} fill="var(--fg)">
            {n.id}
          </text>
        </g>
      ))}
    </svg>
  );
}
