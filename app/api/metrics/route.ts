// Testing commands:
// http://172.24.5.22:3000/api/metrics?region=Iran&protocol=http&phase=tls&range=3600
// http://172.24.5.22:3000/api/metrics?region=Local-Server&protocol=http&phase=tls&range=3600
// http://172.24.5.22:3000/api/metrics?region=Iran&protocol=icmp&range=3600

// app/api/metrics/route.ts

import { NextRequest } from "next/server";
import { DOMAINS, PROTOCOLS, PROBE_TIMEOUT_MS } from "@/config/radar";
import type { MetricsResponse, PrometheusResponse, DomainMetrics } from "@/types/radar";

/** Gauge timestamps sometimes differ slightly from phase duration samples — pick nearest within this skew (seconds). */
const GAUGE_TS_SKEW_SEC = 25;

function gaugeAtTs(
  ts: number,
  exact: Map<number, number>,
  pairs: [number, string][]
): number | undefined {
  const direct = exact.get(ts);
  if (direct !== undefined) return direct;
  let best: number | undefined;
  let bestD = Infinity;
  for (const [t, v] of pairs) {
    const d = Math.abs(t - ts);
    if (d <= GAUGE_TS_SKEW_SEC && d < bestD) {
      bestD = d;
      best = parseFloat(v);
    }
  }
  return best;
}

function buildGaugeSeries(
  json: PrometheusResponse
): { pairs: [number, string][]; byTs: Map<number, number> } {
  const byTs = new Map<number, number>();
  if (json.status !== "success" || json.data.result.length === 0) {
    return { pairs: [], byTs };
  }
  const pairs = json.data.result[0].values;
  for (const [t, v] of pairs) {
    byTs.set(t, parseFloat(v));
  }
  return { pairs, byTs };
}

/** Sub-ms TLS/connect samples are noise; ~100ms (e.g. chatgpt.com) means the phase ran. */
const HTTP_MIN_VALID_PHASE_MS = 1;

/**
 * Blackbox sets probe_success=0 when status is outside valid_status_codes (often 2xx-only).
 * chatgpt.com can return 403 (Cloudflare) or 301 while still completing TLS with real timings.
 */
function isHttpProbeReachable(
  success: number | undefined,
  statusCode: number | undefined,
  durationMs: number
): boolean {
  if (success === 1) return true;

  // Timed phase completed — stronger signal than probe_success for redirect/block pages
  if (
    Number.isFinite(durationMs) &&
    durationMs >= HTTP_MIN_VALID_PHASE_MS &&
    durationMs < PROBE_TIMEOUT_MS
  ) {
    return true;
  }

  // Any HTTP status means the server answered (403, 301, 5xx, …); 0 = no response
  if (
    statusCode !== undefined &&
    Number.isFinite(statusCode) &&
    statusCode >= 100 &&
    statusCode < 600
  ) {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {

  // ── 1. Read and validate query parameters ──────────────────────────────────
  const { searchParams } = request.nextUrl;

  const region   = searchParams.get("region");
  const protocolId = searchParams.get("protocol");
  const phase    = searchParams.get("phase");     // only used for http, null for others
  const rangeRaw = searchParams.get("range");     // seconds as a string, e.g. "3600"
  const startRaw   = searchParams.get("start");  
  const endRaw     = searchParams.get("end");    


  // Basic validation — return a clear error if something is missing
  if (!region || !protocolId) {
    return Response.json(
      { error: "Missing required parameters: region, protocol" },
      { status: 400 }
    );
  }

  // ── 2. Find the protocol config ────────────────────────────────────────────
  const protocol = PROTOCOLS.find(p => p.id === protocolId);
  if (!protocol) {
    return Response.json(
      { error: `Unknown protocol: ${protocolId}. Valid values: http, icmp, tcp` },
      { status: 400 }
    );
  }



  // ── 3. Build time window ───────────────────────────────────────────────────
// Two modes:
//  1. Explicit start/end (user picked a date from the calendar)
//  2. Range-from-now (user selected Last 1h / 6h / 24h)
let start: number;
let end:   number;
let rangeSeconds: number;

if (startRaw && endRaw) {
  start = parseInt(startRaw, 10);
  end   = parseInt(endRaw,   10);
  if (isNaN(start) || isNaN(end)) {
    return Response.json({ error: "start/end must be numbers" }, { status: 400 });
  }
  if (end <= start) {
    return Response.json({ error: "end must be greater than start" }, { status: 400 });
  }
  rangeSeconds = end - start;
} else if (rangeRaw) {
  const parsedRangeSeconds = parseInt(rangeRaw, 10);
  if (isNaN(parsedRangeSeconds)) {
    return Response.json({ error: "range must be a number" }, { status: 400 });
  }
  end   = Math.floor(Date.now() / 1000);
  start = end - parsedRangeSeconds;
  rangeSeconds = end - start;
} else {
  return Response.json(
    { error: "Provide either range or both start and end" },
    { status: 400 }
  );
}

// Step size scales with the window duration
//const duration = end - start;
///const step = duration <= 3600 ? "30s" : duration <= 21600 ? "2m" : "10m";
  // ── 3. Build time window ───────────────────────────────────────────────────
  //const now   = Math.floor(Date.now() / 1000);  // current Unix timestamp in seconds
  //const start = now - rangeSeconds;

  // Step size: we pick it based on range to avoid returning too many data points
  // 1h → 30s steps = 120 points per domain (fine)
  // 6h → 2m steps  = 180 points per domain (fine)
  // 24h → 10m steps = 144 points per domain (fine)
  //const step = rangeSeconds <= 3600 ? "30s" : rangeSeconds <= 21600 ? "2m" : "10m";

  // ── 4. Query Prometheus for each domain ────────────────────────────────────
  const prometheusUrl = process.env.PROMETHEUS_URL;
  if (!prometheusUrl) {
    return Response.json(
      { error: "PROMETHEUS_URL environment variable is not set" },
      { status: 500 }
    );
  }

  const windowDuration = end - start;
  const queryStep =
    windowDuration <= 3600 ? "30s" : windowDuration <= 21600 ? "2m" : "10m";

  const rangeUrl = (promql: string) => {
    const url = new URL(`${prometheusUrl}/api/v1/query_range`);
    url.searchParams.set("query", promql);
    url.searchParams.set("start", String(start));
    url.searchParams.set("end", String(end));
    url.searchParams.set("step", queryStep);
    return url.toString();
  };

  // We fire one Prometheus request per domain, all in parallel
  const domainResults = await Promise.all(
    DOMAINS.map(async (domain): Promise<DomainMetrics> => {

      // Pick the correct instance label value based on protocol
      // HTTP uses the full URL, ICMP uses bare domain, TCP uses domain:port
      const instance =
        protocolId === "http" ? domain.http :
        protocolId === "icmp" ? domain.icmp :
        domain.tcp;

      // Build the PromQL query string
      // For HTTP we also filter by phase (e.g. "tls")
      // For ICMP and TCP there is no phase label
      const labelFilters = [
        `job="${protocol.job}"`,
        `region="${region}"`,
        `instance="${instance}"`,
        ...(protocolId === "http" && phase ? [`phase="${phase}"`] : []),
      ].join(", ");

      const durationQuery = `${protocol.metric}{${labelFilters}}`;
      // probe_success has no phase label — same instance/job/region as the probe
      const successLabelFilters = [
        `job="${protocol.job}"`,
        `region="${region}"`,
        `instance="${instance}"`,
      ].join(", ");
      const successQuery = `probe_success{${successLabelFilters}}`;
      const httpStatusQuery = `probe_http_status_code{${successLabelFilters}}`;

      try {
        const fetches: Promise<Response>[] = [
          fetch(rangeUrl(durationQuery), { cache: "no-store" }),
          fetch(rangeUrl(successQuery), { cache: "no-store" }),
        ];
        if (protocolId === "http") {
          fetches.push(fetch(rangeUrl(httpStatusQuery), { cache: "no-store" }));
        }

        const responses = await Promise.all(fetches);
        const durRes = responses[0];
        const sucRes = responses[1];
        const statusRes = protocolId === "http" ? responses[2] : undefined;

        if (!durRes.ok) {
          console.error(`Prometheus returned ${durRes.status} for domain ${domain.id}`);
          return { domainId: domain.id, domainLabel: domain.label, data: [] };
        }

        const durJson: PrometheusResponse = await durRes.json();
        const sucJson: PrometheusResponse = sucRes.ok
          ? await sucRes.json()
          : { status: "error", data: { resultType: "", result: [] } };
        const statusJson: PrometheusResponse =
          statusRes?.ok
            ? await statusRes.json()
            : { status: "error", data: { resultType: "", result: [] } };

        if (durJson.status !== "success" || durJson.data.result.length === 0) {
          // No data for this domain — return empty array, not an error
          return { domainId: domain.id, domainLabel: domain.label, data: [] };
        }

        const { pairs: successPairs, byTs: successByTs } = buildGaugeSeries(sucJson);
        const { pairs: statusPairs, byTs: statusByTs } =
          protocolId === "http" ? buildGaugeSeries(statusJson) : { pairs: [], byTs: new Map() };

        // Prometheus returns values as [timestamp, "value_string"]
        // We convert the value to milliseconds (Prometheus stores seconds).
        // Failed HTTP probes often report ~0s phase duration while probe_success==0;
        // ICMP usually exposes ~timeout duration. Align both by folding failures into
        // the same timeout band the UI already treats as "down".
        const data = durJson.data.result[0].values.map(([timestamp, valueStr]) => {
          let value = parseFloat(valueStr) * 1000;
          if (!Number.isFinite(value)) {
            value = PROBE_TIMEOUT_MS;
          }

          const ok = gaugeAtTs(timestamp, successByTs, successPairs);
          const statusCode =
            protocolId === "http"
              ? gaugeAtTs(timestamp, statusByTs, statusPairs)
              : undefined;

          const reachable =
            protocolId === "http"
              ? isHttpProbeReachable(ok, statusCode, value)
              : ok !== 0;

          if (!reachable) {
            value = PROBE_TIMEOUT_MS;
          }
          return { timestamp, value };
        });

        return { domainId: domain.id, domainLabel: domain.label, data };

      } catch (err) {
        // Network error reaching Prometheus — return empty, don't crash the whole response
        console.error(`Failed to fetch domain ${domain.id}:`, err);
        return { domainId: domain.id, domainLabel: domain.label, data: [] };
      }
    })
  );

  // ── 5. Return the assembled response ───────────────────────────────────────
  const response: MetricsResponse = {
    region,
    protocol:  protocolId,
    phase:     phase ?? null,
    range:     rangeSeconds,
    domains:   domainResults,
  };

  return Response.json(response);
}