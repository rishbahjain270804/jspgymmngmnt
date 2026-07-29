import { useId, useMemo, useState } from 'react';
import { useReducedMotion } from '../../lib/hooks';

/**
 * Charts, drawn as inline SVG.
 *
 * No charting library: these are three shapes, they need to inherit theme
 * tokens on a theme switch, and every one of them has to carry an accessible
 * text equivalent. A dependency would fight all three.
 *
 * Each chart renders a visually-hidden table of its own data, so the figures
 * are readable by screen reader and survive printing.
 */

export interface Series {
  name: string;
  color: string;
  points: number[];
  /** Formats values in the tooltip and the hidden table. */
  format?: (n: number) => string;
}

function niceBounds(values: number[]): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (lo === hi) return [lo - 1, hi + 1];
  const pad = (hi - lo) * 0.18;
  return [lo - pad, hi + pad];
}

function path(points: number[], x: (i: number) => number, y: (v: number) => number): string {
  return points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
}

/** Hidden data table — the chart's text equivalent. */
function DataTable({
  caption,
  labels,
  series,
}: {
  caption: string;
  labels: string[];
  series: Series[];
}) {
  return (
    <table className="visually-hidden">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Period</th>
          {series.map((s) => (
            <th key={s.name} scope="col">
              {s.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {labels.map((l, i) => (
          <tr key={l}>
            <th scope="row">{l}</th>
            {series.map((s) => (
              <td key={s.name}>{(s.format ?? String)(s.points[i] ?? 0)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LineChart({
  series,
  labels,
  height = 220,
  caption,
  area = true,
  yTicks = 4,
}: {
  series: Series[];
  labels: string[];
  height?: number;
  caption: string;
  area?: boolean;
  yTicks?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);

  const W = 720;
  const H = height;
  const pad = { t: 14, r: 12, b: 26, l: 46 };

  const all = series.flatMap((s) => s.points);
  const [lo, hi] = useMemo(() => niceBounds(all), [all.join(',')]);
  const n = labels.length;

  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(n - 1, 1);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);

  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => lo + ((hi - lo) * i) / yTicks);
  const primary = series[0];

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={caption}
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const rel = ((e.clientX - box.left) / box.width) * W;
          const i = Math.round(((rel - pad.l) / (W - pad.l - pad.r)) * (n - 1));
          setHover(Math.max(0, Math.min(n - 1, i)));
        }}
      >
        <defs>
          {series.map((s, si) => (
            <linearGradient key={s.name} id={`${uid}-g${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.26" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid + y axis */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--chart-grid)"
              strokeWidth="1"
            />
            <text
              x={pad.l - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--text-3)"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {(primary?.format ?? ((v: number) => Math.round(v).toString()))(t)}
            </text>
          </g>
        ))}

        {/* x labels — thinned so they never collide */}
        {labels.map((l, i) =>
          i % Math.ceil(n / 7) === 0 || i === n - 1 ? (
            <text key={l} x={x(i)} y={H - 7} textAnchor="middle" fontSize="11" fill="var(--text-3)">
              {l}
            </text>
          ) : null,
        )}

        {series.map((s, si) => (
          <g key={s.name}>
            {area ? (
              <path
                d={`${path(s.points, x, y)} L${x(n - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`}
                fill={`url(#${uid}-g${si})`}
                style={
                  reduced
                    ? undefined
                    : { animation: `fade var(--d-slower) var(--e-out) ${si * 120 + 260}ms both` }
                }
              />
            ) : null}
            <path
              d={path(s.points, x, y)}
              fill="none"
              stroke={s.color}
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              style={
                reduced
                  ? undefined
                  : {
                      strokeDasharray: 1,
                      strokeDashoffset: 1,
                      animation: `draw 1000ms var(--e-out) ${si * 120}ms forwards`,
                    }
              }
            />
            {hover !== null && s.points[hover] !== undefined ? (
              <circle
                cx={x(hover)}
                cy={y(s.points[hover]!)}
                r="4.5"
                fill="var(--surface)"
                stroke={s.color}
                strokeWidth="2.5"
              />
            ) : null}
          </g>
        ))}

        {hover !== null ? (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={pad.t}
            y2={H - pad.b}
            stroke="var(--line-strong)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ) : null}
      </svg>

      {hover !== null ? (
        <div className="chart__readout" aria-hidden="true">
          <span className="eyebrow">{labels[hover]}</span>
          {series.map((s) => (
            <span key={s.name} className="chart__readout-item">
              <i style={{ background: s.color }} />
              {s.name}
              <b className="tnum">{(s.format ?? String)(s.points[hover] ?? 0)}</b>
            </span>
          ))}
        </div>
      ) : null}

      {series.length > 1 ? (
        <div className="chart__legend" aria-hidden="true">
          {series.map((s) => (
            <span key={s.name} className="chart__legend-item">
              <i style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}

      <DataTable caption={caption} labels={labels} series={series} />
    </div>
  );
}

/** Tiny inline trend, for table rows and KPI feet. */
export function Sparkline({
  points,
  color = 'var(--brand)',
  width = 92,
  height = 26,
  label,
}: {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
  label: string;
}) {
  const [lo, hi] = niceBounds(points);
  const x = (i: number) => (i * width) / Math.max(points.length - 1, 1);
  const y = (v: number) => height - 3 - ((v - lo) / (hi - lo)) * (height - 6);
  return (
    <svg width={width} height={height} role="img" aria-label={label} style={{ overflow: 'visible' }}>
      <path
        d={path(points, x, y)}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Horizontal comparison bars. Used for branch-vs-branch and
 * category-by-branch, where the question is "which is bigger" — a job bars
 * do better than any pie.
 */
export function BarCompare({
  rows,
  format,
  caption,
}: {
  rows: { label: string; value: number; color?: string; note?: string }[];
  format: (n: number) => string;
  caption: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="bars" role="img" aria-label={caption}>
      {rows.map((r, i) => (
        <div className="bars__row" key={r.label}>
          <span className="bars__label">{r.label}</span>
          <span className="bars__track">
            <span
              className="bars__fill"
              style={{
                width: `${(r.value / max) * 100}%`,
                background: r.color ?? 'var(--chart-1)',
                animationDelay: `${i * 70}ms`,
              }}
            />
          </span>
          <span className="bars__value tnum">{format(r.value)}</span>
        </div>
      ))}
      <table className="visually-hidden">
        <caption>{caption}</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{format(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
