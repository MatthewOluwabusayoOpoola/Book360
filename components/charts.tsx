"use client";
import { useMemo, useState } from "react";

/* Hatched profit/expense columns, as in the "Total Income" reference card */
export function ColumnChart({
  data,
  format,
}: {
  data: { label: string; base: number; top: number }[]; // base = solid ink, top = hatched
  format: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.base + d.top));
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div>
      <div className="relative grid h-44 items-end gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }} role="img" aria-label="Expenses and profit by month">
        {data.map((d, i) => {
          const h = ((d.base + d.top) / max) * 100;
          const topH = (d.top / (d.base + d.top || 1)) * 100;
          return (
            <div key={d.label + i} className="relative flex h-full flex-col justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {hover === i && (
                <div className="pop-in pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-xs text-white shadow-lg">
                  <div className="font-semibold">{d.label}</div>
                  <div className="text-[#7fe0b8]">Profit {format(d.top)}</div>
                  <div className="text-white/70">Expenses {format(d.base)}</div>
                </div>
              )}
              <div className="bar-grow flex w-full flex-col justify-end overflow-hidden rounded-t-[7px] rounded-b-[3px]" style={{ height: `${h}%`, animationDelay: `${i * 45}ms` }}>
                {d.top > 0 && <div className="hatch-teal" style={{ height: `${topH}%` }} />}
                <div className="bg-ink" style={{ height: `${100 - topH}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((d, i) => (
          <span key={d.label + i} className="muted text-center text-[10.5px]">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* Smooth two-series line chart with hover read-out */
export function LineChart({
  labels,
  a,
  b,
  aName,
  bName,
  format,
}: {
  labels: string[];
  a: number[];
  b: number[];
  aName: string;
  bName: string;
  format: (n: number) => string;
}) {
  const W = 640;
  const H = 240;
  const P = { l: 44, r: 12, t: 12, b: 26 };
  const max = Math.max(1, ...a, ...b) * 1.08;
  const [hover, setHover] = useState<number | null>(null);
  const x = (i: number) => P.l + (i / Math.max(1, labels.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const path = (vals: number[]) => {
    if (vals.length < 2) return "";
    let d = `M${x(0)},${y(vals[0])}`;
    for (let i = 1; i < vals.length; i++) {
      const cx = (x(i - 1) + x(i)) / 2;
      d += ` C${cx},${y(vals[i - 1])} ${cx},${y(vals[i])} ${x(i)},${y(vals[i])}`;
    }
    return d;
  };
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)));
  const step = Math.max(1, Math.ceil(labels.length / 7));
  return (
    <div className="relative">
      <div className="mb-2 flex gap-4 text-xs">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-accent" />{aName}</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-ink" />{bName}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${aName} versus ${bName}`}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (labels.length - 1));
          setHover(Math.min(labels.length - 1, Math.max(0, i)));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="rgba(21,21,21,.07)" />
            <text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="rgba(21,21,21,.45)">{short(t)}</text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % step === 0 ? (
            <text key={l + i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="rgba(21,21,21,.45)">{l}</text>
          ) : null,
        )}
        <path d={path(a)} fill="none" stroke="#e2663f" strokeWidth="2.4" strokeLinecap="round" />
        <path d={path(b)} fill="none" stroke="#151515" strokeWidth="2.4" strokeLinecap="round" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="rgba(21,21,21,.2)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(a[hover])} r="4.5" fill="#e2663f" stroke="#fff" strokeWidth="2" />
            <circle cx={x(hover)} cy={y(b[hover])} r="4.5" fill="#151515" stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-8 z-10 rounded-xl bg-ink px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > labels.length / 2 ? "-105%" : "5%"})` }}
        >
          <div className="font-semibold">{labels[hover]}</div>
          <div className="text-[#ff9f80]">{aName} {format(a[hover])}</div>
          <div className="text-white/75">{bName} {format(b[hover])}</div>
        </div>
      )}
    </div>
  );
}

export const DONUT_COLORS = ["#e2663f", "#151515", "#e9b43c", "#4f7be8", "#3f9f88", "#a98be0", "#b9a898"];

export function Donut({ slices, center, sub }: { slices: { label: string; value: number }[]; center: string; sub: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const R = 70;
  const C = 2 * Math.PI * R;
  const arcs = useMemo(() => {
    let off = 0;
    const gap = slices.length > 1 ? 3 : 0;
    return slices.map((s, i) => {
      const len = (s.value / total) * C;
      const a = { color: DONUT_COLORS[i % DONUT_COLORS.length], dash: `${Math.max(0, len - gap)} ${C}`, off: -off };
      off += len;
      return a;
    });
  }, [slices, total, C]);
  return (
    <div className="relative mx-auto h-[190px] w-[190px]">
      <svg viewBox="0 0 190 190" className="h-full w-full -rotate-90" role="img" aria-label="Breakdown">
        <circle cx="95" cy="95" r={R} fill="none" stroke="rgba(21,21,21,.06)" strokeWidth="22" />
        {arcs.map((a, i) => (
          <circle key={i} cx="95" cy="95" r={R} fill="none" stroke={a.color} strokeWidth="22" strokeDasharray={a.dash} strokeDashoffset={a.off} strokeLinecap="butt" />
        ))}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="muted text-[11px]">{sub}</div>
          <div className="text-[19px] font-semibold tracking-[-0.02em]">{center}</div>
        </div>
      </div>
    </div>
  );
}

/* progress ring used in goal cards of the reference */
export function Ring({ pct, size = 84, label }: { pct: number; size?: number; label?: string }) {
  const R = size / 2 - 7;
  const C = 2 * Math.PI * R;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="rgba(21,21,21,.1)" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="#e2663f" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(p / 100) * C} ${C}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[17px] font-semibold leading-none">{Math.round(p)}%</div>
          {label && <div className="muted mt-0.5 text-[10px]">{label}</div>}
        </div>
      </div>
    </div>
  );
}

export function HatchBar({ pct, tone = "accent" }: { pct: number; tone?: "accent" | "teal" }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="hatch-track relative h-3.5 overflow-hidden rounded-full bg-white/40" role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`fill-grow h-full rounded-full ${tone === "accent" ? "bg-accent" : "bg-teal"}`} style={{ width: `${p}%` }} />
    </div>
  );
}
