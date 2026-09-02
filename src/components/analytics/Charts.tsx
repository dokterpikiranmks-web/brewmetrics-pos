"use client";

import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell, PieChart, Pie,
} from "recharts";
import { formatIDR } from "@/lib/format";
import type { AnalyticsSummary } from "@/lib/types";

const AXIS = { fill: "#6e6355", fontSize: 11, fontFamily: "var(--font-grotesk)" };

function ChartTooltip({ active, payload, label, money = true }: {
  active?: boolean;
  payload?: { name?: string; value?: number; dataKey?: string; payload?: Record<string, unknown> }[];
  label?: string;
  money?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl border border-line-2 px-3.5 py-2.5 shadow-ticket">
      <p className="text-[11px] font-bold text-sand mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-semibold text-cream tabular flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: String((p.payload as { fill?: string })?.fill ?? "#f59e0b") }} />
          <span className="text-faint capitalize">{p.name}:</span> {money ? formatIDR(Number(p.value ?? 0)) : p.value}
        </p>
      ))}
    </div>
  );
}

/* ------------------------------ REVENUE 30 HARI ----------------------------- */
export function RevenueChart({ data }: { data: AnalyticsSummary["daily"] }) {
  return (
    <ResponsiveContainer width="100%" height={290}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#2b251b" strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "#2b251b" }} interval={4} />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : `${Math.round(v / 1000)}rb`)}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#f59e0b", strokeOpacity: 0.3 }} />
        <Area type="monotone" dataKey="revenue" name="Pendapatan" stroke="#f59e0b" strokeWidth={2.4} fill="url(#revGrad)" />
        <Line type="monotone" dataKey="profit" name="Profit" stroke="#34d399" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------- HOURLY CHART ------------------------------ */
export function HourlyChart({ data }: { data: AnalyticsSummary["hourly"] }) {
  const max = Math.max(...data.map((d) => d.hour), 0);
  const nowH = new Date().getHours();
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid stroke="#2b251b" strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "#2b251b" }} interval={1} />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${Math.round(v / 1000)}rb`}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f59e0b", fillOpacity: 0.08 }} />
        <Bar dataKey="revenue" name="Pendapatan" radius={[5, 5, 0, 0]}>
          {data.map((d) => (
            <Cell
              key={d.hour}
              fill={d.hour === max || d.hour === nowH ? "#fbbf24" : "#7c5613"}
              fillOpacity={d.hour > nowH ? 0.35 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------- TOP PRODUCTS ------------------------------ */
export function TopProducts({ data }: { data: AnalyticsSummary["topProducts"] }) {
  const max = Math.max(...data.map((d) => d.qty), 1);
  return (
    <div className="space-y-3.5">
      {data.map((p, i) => (
        <div key={p.name} className="group">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[12.5px] font-semibold text-cream flex items-center gap-2">
              <span className="font-display text-[10px] text-faint tabular w-4">{String(i + 1).padStart(2, "0")}</span>
              {p.name}
            </p>
            <p className="text-[11px] text-faint tabular">
              <span className="text-brand font-bold">{p.qty}</span> terjual • {formatIDR(p.revenue, true)}
            </p>
          </div>
          <div className="h-2 rounded-full bg-coal overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-2 to-glow transition-all duration-700"
              style={{ width: `${(p.qty / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ PAYMENT DONUT ------------------------------ */
const PAY_COLORS: Record<string, string> = { cash: "#f59e0b", qris: "#38bdf8", debit: "#a78bfa" };
const PAY_LABELS: Record<string, string> = { cash: "Tunai", qris: "QRIS", debit: "Debit" };

export function PaymentDonut({ data }: { data: AnalyticsSummary["paymentSplit"] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const shaped = data.map((d) => ({ ...d, label: PAY_LABELS[d.method] ?? d.method }));
  return (
    <div className="flex items-center gap-5">
      <div className="relative size-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shaped}
              dataKey="value"
              nameKey="label"
              innerRadius={52}
              outerRadius={72}
              paddingAngle={4}
              strokeWidth={0}
            >
              {shaped.map((d) => (
                <Cell key={d.method} fill={PAY_COLORS[d.method] ?? "#f59e0b"} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-[0.2em] text-faint">30 hari</p>
            <p className="font-display text-sm font-bold tabular">{formatIDR(total, true)}</p>
          </div>
        </div>
      </div>
      <div className="space-y-2.5 flex-1">
        {shaped.map((d) => (
          <div key={d.method} className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: PAY_COLORS[d.method] }} />
            <span className="text-xs text-sand flex-1">{d.label}</span>
            <span className="text-xs font-bold tabular text-cream">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
