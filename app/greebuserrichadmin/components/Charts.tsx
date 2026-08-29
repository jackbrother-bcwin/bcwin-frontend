"use client";

import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
} from "recharts";

const COLORS = [
  "#2563eb",
  "#3b82f6",
  "#60a5fa",
  "#93c5fd",
  "#1d4ed8",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

class ChartErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    console.error("Chart rendering error caught:", error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center text-xs text-slate-400">
          Unable to render chart
        </div>
      );
    }
    return this.props.children;
  }
}

function ChartShell({
  title,
  height,
  children,
}: {
  title?: string;
  height: number;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ChartErrorBoundary>
      <div className="admin-surface min-w-0 p-3 sm:p-4">
        {title && (
          <h3 className="mb-3 text-sm font-bold text-slate-700">{title}</h3>
        )}
        <div
          className="w-full min-w-0 overflow-hidden"
          style={{ height, minHeight: Math.min(height, 200) }}
        >
          {mounted ? children : null}
        </div>
      </div>
    </ChartErrorBoundary>
  );
}

export function AdminBarChart({
  data,
  xKey,
  yKey,
  yKey2,
  height = 260,
  title,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  yKey2?: string;
  height?: number;
  title?: string;
}) {
  const sanitized = (data || []).map((item) => ({
    ...item,
    [yKey]: Number(item[yKey]) || 0,
    ...(yKey2 ? { [yKey2]: Number(item[yKey2]) || 0 } : {}),
  }));

  if (!sanitized.length) return null;
  return (
    <ChartShell title={title} height={height}>
      <ResponsiveContainer width="99%" height="100%">
        <BarChart data={sanitized} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 10 }}
            stroke="#94a3b8"
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" width={36} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 12,
            }}
          />
          <Bar dataKey={yKey} fill="#2563eb" radius={[6, 6, 0, 0]} />
          {yKey2 && (
            <Bar dataKey={yKey2} fill="#22c55e" radius={[6, 6, 0, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function AdminPieChart({
  data,
  nameKey = "name",
  valueKey = "value",
  height = 260,
  title,
}: {
  data: Array<Record<string, string | number>>;
  nameKey?: string;
  valueKey?: string;
  height?: number;
  title?: string;
}) {
  const sanitized = (data || [])
    .map((item) => {
      const val = Number(item[valueKey]);
      return {
        ...item,
        [valueKey]: isFinite(val) && val > 0 ? val : 0,
      };
    })
    .filter((item) => Number(item[valueKey]) > 0);

  if (!sanitized.length) return null;
  return (
    <ChartShell title={title} height={height}>
      <ResponsiveContainer width="99%" height="100%">
        <PieChart>
          <Pie
            data={sanitized}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            outerRadius="70%"
            innerRadius="38%"
            paddingAngle={2}
            label={false}
          >
            {sanitized.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            layout="horizontal"
            verticalAlign="bottom"
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function AdminLineChart({
  data,
  xKey,
  lines,
  height = 260,
  title,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  lines: { key: string; color?: string }[];
  height?: number;
  title?: string;
}) {
  const sanitized = (data || []).map((item) => {
    const copy: Record<string, string | number> = { ...item };
    lines.forEach((l) => {
      copy[l.key] = Number(item[l.key]) || 0;
    });
    return copy;
  });

  if (!sanitized.length) return null;
  return (
    <ChartShell title={title} height={height}>
      <ResponsiveContainer width="99%" height="100%">
        <LineChart data={sanitized} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={36} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {lines.map((l, i) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              stroke={l.color ?? COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function AdminAreaChart({
  data,
  xKey,
  yKey,
  height = 240,
  title,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  height?: number;
  title?: string;
}) {
  const sanitized = (data || []).map((item) => ({
    ...item,
    [yKey]: Number(item[yKey]) || 0,
  }));

  if (!sanitized.length) return null;
  return (
    <ChartShell title={title} height={height}>
      <ResponsiveContainer width="99%" height="100%">
        <AreaChart data={sanitized} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="adminArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={36} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey={yKey}
            stroke="#2563eb"
            fill="url(#adminArea)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
