// components/radar/RegionChart.tsx
"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import { useMetrics } from "@/hooks/useMetrics";
import { DOMAIN_COLORS, DOMAINS, PROTOCOLS } from "@/config/radar";
import type { MetricPoint } from "@/types/radar";
import { removeSingleSampleSpikes, rollingAverage } from "@/lib/smoothing";

type Props =
  | { region: string; protocol: string; phase?: string | null; smoothing: "none"|"spike"|"rolling"; mode: "range";  range: number }
  | { region: string; protocol: string; phase?: string | null; smoothing: "none"|"spike"|"rolling"; mode: "window"; start: number; end: number };

// ── Custom tooltip shown when hovering over the chart ─────────────────────
// Recharts passes its own props here — we type them loosely to keep it simple
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-2">
        {format(new Date(label * 1000), "HH:mm:ss")}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-300">{entry.name}:</span>
          <span className="text-white font-medium">
            {entry.value.toFixed(2)} ms
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function RegionChart(props: Props) {
  const { region, protocol, phase, smoothing } = props;

  const { data, isLoading, isError } = useMetrics(
    props.mode === "range"
      ? {
          region: props.region,
          protocol: props.protocol,
          phase: props.phase,
          mode: "range",
          range: props.range,
        }
      : {
          region: props.region,
          protocol: props.protocol,
          phase: props.phase,
          mode: "window",
          start: props.start,
          end: props.end,
        }
  );

  const protocolConfig = PROTOCOLS.find(p => p.id === protocol);

  // ── Loading state ──────────────────────────────────────────────────────
  if (isLoading && !data) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="h-4 w-48 bg-gray-800 rounded animate-pulse mb-6" />
        <div className="h-52 bg-gray-800 rounded animate-pulse" />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="bg-gray-900 border border-red-900 rounded-xl p-5">
        <p className="text-sm text-gray-400 mb-1">{region}</p>
        <p className="text-red-400 text-xs">Failed to load metrics. Check that Prometheus is reachable.</p>
      </div>
    );
  }

  // ── Transform data for Recharts ────────────────────────────────────────
  // Recharts expects an array of objects where each object is one point in time:
  // [ { timestamp: 1234, github: 97.2, google: 245.1, ... }, ... ]
  //
  // But our API returns data grouped by domain:
  // { domains: [ { domainId: "github", data: [{timestamp, value}] }, ... ] }
  //
  // So we need to "pivot" the data — collect all unique timestamps,
  // then for each timestamp find the value from each domain.

  const allTimestamps = Array.from(
    new Set(data?.domains.flatMap(d => d.data.map((p: MetricPoint) => p.timestamp)) ?? [])
  ).sort((a, b) => a - b);


  const chartData = allTimestamps.map(ts => {
    const point: Record<string, number> = { timestamp: ts };
  
    data?.domains.forEach(domain => {
      // Apply smoothing per domain before adding to chart data
      const rawData = domain.data as MetricPoint[];
  
      // if you want to tune it per-protocol (ICMP is noisier than HTTP), you can pass a custom threshold
      const processedData =
        smoothing === "spike"   ? removeSingleSampleSpikes(rawData, 3.5) :
        smoothing === "rolling" ? rollingAverage(rawData, 3) :
        rawData;  // "none" — raw data, no processing
  
      const match = processedData.find((p: MetricPoint) => p.timestamp === ts);
      if (match) point[domain.domainId] = parseFloat(match.value.toFixed(3));
    });
  
    return point;
  });

  // const chartData = allTimestamps.map(ts => {
  //   const point: Record<string, number> = { timestamp: ts };
  //   data?.domains.forEach(domain => {
  //     const match = domain.data.find((p: MetricPoint) => p.timestamp === ts);
  //     if (match) point[domain.domainId] = parseFloat(match.value.toFixed(3));
  //   });
  //   return point;
  // });

  const hasData = chartData.length > 0;

  // ── Chart title ────────────────────────────────────────────────────────
  const title = phase
    ? `${region} — ${protocolConfig?.label} (${phase})`
    : `${region} — ${protocolConfig?.label}`;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-200">{title}</h2>
        <span className="text-xs text-gray-500">ms</span>
      </div>

      {/* No data fallback */}
      {!hasData ? (
        <div className="h-52 flex items-center justify-center text-gray-600 text-sm">
          No data for this time range
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1f2937"
              vertical={false}
            />

            <XAxis
              dataKey="timestamp"
              tickFormatter={ts => format(new Date(ts * 1000), "HH:mm")}
              tick={{ fill: "#6b7280", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#1f2937" }}
              minTickGap={60}
            />

            <YAxis
              tickFormatter={v => `${v}`}
              tick={{ fill: "#6b7280", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={45}
              domain={["auto", "auto"]}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
              formatter={(value) => (
                <span style={{ color: "#9ca3af" }}>
                  {DOMAINS.find(d => d.id === value)?.label ?? value}
                </span>
              )}
            />

            {/* Render one Line per domain */}
            {DOMAINS.map(domain => (
              <Line
                key={domain.id}
                type="monotone"
                dataKey={domain.id}
                stroke={DOMAIN_COLORS[domain.id]}
                strokeWidth={1.5}
                dot={false}            // no dots on the line — cleaner for dense time series
                activeDot={{ r: 3 }}   // small dot appears on hover
                connectNulls={false}   // don't draw a line across missing data gaps
              />
            ))}

          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}