// components/radar/RegionChart.tsx
"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import { useMetrics } from "@/hooks/useMetrics";
import { DOMAIN_COLORS, DOMAINS, PROTOCOLS } from "@/config/radar";
import type { MetricPoint, DomainStatus } from "@/types/radar";
import {
  removeSingleSampleSpikes,
  rollingAverage,
  filterTimeouts,
} from "@/lib/smoothing";

type Props =
  | { region: string; protocol: string; phase?: string | null; smoothing: "none"|"spike"|"rolling"; mode: "range";  range: number }
  | { region: string; protocol: string; phase?: string | null; smoothing: "none"|"spike"|"rolling"; mode: "window"; start: number; end: number };

// ── Tooltip ────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const validEntries = payload.filter((e: any) => e.value != null);
  if (!validEntries.length) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-2">
        {format(new Date(label * 1000), "HH:mm:ss")}
      </p>
      {validEntries.map((entry: any) => (
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

// ── Status badge shown per domain below the chart ──────────────────────────
function DomainStatusBadge({ status, color }: { status: DomainStatus; color: string }) {
  const domain = DOMAINS.find(d => d.id === status.domainId);

  // Fully down — red badge with ✕
  if (status.isFullyDown) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-950 border border-red-800">
        <span className="text-red-400 text-xs font-bold leading-none">✕</span>
        <span className="text-red-300 text-xs">{domain?.label ?? status.domainId}</span>
      </div>
    );
  }

  // Partially failing — amber badge with failure rate
  if (status.failureRate > 0.1) {
    const pct = Math.round(status.failureRate * 100);
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-950 border border-amber-800">
        <span className="text-amber-400 text-xs font-bold leading-none">!</span>
        <span className="text-amber-300 text-xs">{domain?.label ?? status.domainId}</span>
        <span className="text-amber-500 text-xs">{pct}% loss</span>
      </div>
    );
  }

  // Healthy — green dot, no badge (stays subtle)
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md">
      <span
        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-gray-500 text-xs">{domain?.label ?? status.domainId}</span>
      {status.lastValue !== null && (
        <span className="text-gray-600 text-xs">
          {status.lastValue.toFixed(1)} ms
        </span>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function RegionChart(props: Props) {
  const { region, protocol, phase, smoothing } = props;

  const { data, isLoading, isError } = useMetrics(
    props.mode === "range"
      ? { region, protocol, phase, mode: "range",  range: props.range }
      : { region, protocol, phase, mode: "window", start: props.start, end: props.end }
  );

  const protocolConfig = PROTOCOLS.find(p => p.id === protocol);

  // ── Loading ────────────────────────────────────────────────────────────
  if (isLoading && !data) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="h-4 w-48 bg-gray-800 rounded animate-pulse mb-6" />
        <div className="h-52 bg-gray-800 rounded animate-pulse" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="bg-gray-900 border border-red-900 rounded-xl p-5">
        <p className="text-sm text-gray-400 mb-1">{region}</p>
        <p className="text-red-400 text-xs">
          Failed to load metrics. Check that Prometheus is reachable.
        </p>
      </div>
    );
  }

  // ── Process data per domain ────────────────────────────────────────────
  // We process each domain's data independently so we can:
  //  1. Filter out timeout values (≥ PROBE_TIMEOUT_MS)
  //  2. Apply smoothing to what remains
  //  3. Collect status information for the badges
  
  const domainStatuses: DomainStatus[] = [];

  // Map of domainId → (unix seconds → point or null timeout at that sample)
  // Timestamp keys align each chart row with the correct sample; index-based
  // lookup breaks when domains differ in length or timestep sets (e.g. ICMP vs HTTP).
  const processedByDomain = new Map<string, Map<number, MetricPoint | null>>();

  data?.domains.forEach(domain => {
    const rawData = domain.data as MetricPoint[];

    // No samples (scrape miss or missing series) — treat like unreachable, same badge as ICMP down
    if (rawData.length === 0) {
      domainStatuses.push({
        domainId:    domain.domainId,
        domainLabel: domain.domainLabel,
        failureRate: 1,
        isFullyDown: true,
        lastValue:   null,
      });
      return;
    }

    // Step 1 — separate real measurements from timeouts
    const { cleaned, failureRate, isFullyDown } = filterTimeouts(rawData);

    // Step 2 — apply smoothing only to non-null points
    // We extract valid points, smooth them, then re-insert at original positions
    const validPoints = cleaned.filter((p): p is MetricPoint => p !== null);

    const smoothed =
      smoothing === "spike"   ? removeSingleSampleSpikes(validPoints, 3.5) :
      smoothing === "rolling" ? rollingAverage(validPoints, 3) :
      validPoints;

    // Re-merge: put smoothed values back, keep nulls where timeouts were
    let smoothedIdx = 0;
    const merged = cleaned.map(p => {
      if (p === null) return null;
      return smoothed[smoothedIdx++] ?? p;
    });

    const byTimestamp = new Map<number, MetricPoint | null>();
    rawData.forEach((raw, i) => {
      byTimestamp.set(raw.timestamp, merged[i] ?? null);
    });
    processedByDomain.set(domain.domainId, byTimestamp);

    // Step 3 — compute status for badge
    const lastValid = [...merged].reverse().find(p => p !== null);
    domainStatuses.push({
      domainId:    domain.domainId,
      domainLabel: domain.domainLabel,
      failureRate,
      isFullyDown,
      lastValue:   lastValid?.value ?? null,
    });
  });

  // ── Build Recharts data array ──────────────────────────────────────────
  // Collect all timestamps across all domains
  const allTimestamps = Array.from(
    new Set(
      data?.domains.flatMap(d => d.data.map((p: MetricPoint) => p.timestamp)) ?? []
    )
  ).sort((a, b) => a - b);

  const chartData = allTimestamps.map(ts => {
    const point: Record<string, number | null | undefined> = { timestamp: ts };

    data?.domains.forEach(domain => {
      const byTs = processedByDomain.get(domain.domainId);
      if (!byTs) return;

      const p = byTs.get(ts);
      // No sample at this timestamp for this domain — leave key unset
      if (p === undefined) return;

      // null means timeout — we set the key to null so Recharts draws a gap
      if (p === null) {
        point[domain.domainId] = null;
        return;
      }

      point[domain.domainId] = parseFloat(p.value.toFixed(3));
    });

    return point;
  });

  const hasData = chartData.length > 0;

  // Are ALL domains fully down for this region?
  const regionFullyDown = domainStatuses.length > 0 &&
    domainStatuses.every(s => s.isFullyDown);

  const title = phase
    ? `${region} — ${protocolConfig?.label} (${phase})`
    : `${region} — ${protocolConfig?.label}`;

  return (
    <div className={`bg-gray-900 border rounded-xl p-5 ${
      regionFullyDown ? "border-red-900" : "border-gray-800"
    }`}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-gray-200">{title}</h2>
          {regionFullyDown && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-red-950 text-red-400 border border-red-800">
              unreachable
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">ms</span>
      </div>

      {/* Chart or empty state */}
      {!hasData ? (
        <div className="h-52 flex items-center justify-center text-gray-600 text-sm">
          No data for this time range
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>

            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />

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
              // Cap the Y axis at 1000ms — timeout values (4500ms) are
              // already filtered out, but this prevents any edge cases
              // from stretching the axis and compressing the real data
              domain={[0, (dataMax: number) => Math.min(dataMax * 1.1, 1000)]}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* No Legend here — we replace it with the status badges below */}

            {DOMAINS.map(domain => (
              <Line
                key={domain.id}
                type="monotone"
                dataKey={domain.id}
                stroke={DOMAIN_COLORS[domain.id]}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls={false}  // gaps appear where probes timed out
              />
            ))}

          </LineChart>
        </ResponsiveContainer>
      )}

      {/* ── Status badges — replace the Recharts legend ───────────────── */}
      {domainStatuses.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-800">
          {domainStatuses.map(status => (
            <DomainStatusBadge
              key={status.domainId}
              status={status}
              color={DOMAIN_COLORS[status.domainId]}
            />
          ))}
        </div>
      )}

    </div>
  );
}