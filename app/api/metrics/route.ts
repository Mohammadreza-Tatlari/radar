// Testing commands:
// http://172.24.5.22:3000/api/metrics?region=Iran&protocol=http&phase=tls&range=3600
// http://172.24.5.22:3000/api/metrics?region=Local-Server&protocol=http&phase=tls&range=3600
// http://172.24.5.22:3000/api/metrics?region=Iran&protocol=icmp&range=3600

// app/api/metrics/route.ts

import { NextRequest } from "next/server";
import { DOMAINS, PROTOCOLS } from "@/config/radar";
import type { MetricsResponse, PrometheusResponse, DomainMetrics } from "@/types/radar";

export async function GET(request: NextRequest) {

  // ── 1. Read and validate query parameters ──────────────────────────────────
  const { searchParams } = request.nextUrl;

  const region   = searchParams.get("region");
  const protocolId = searchParams.get("protocol");
  const phase    = searchParams.get("phase");     // only used for http, null for others
  const rangeRaw = searchParams.get("range");     // seconds as a string, e.g. "3600"

  // Basic validation — return a clear error if something is missing
  if (!region || !protocolId || !rangeRaw) {
    return Response.json(
      { error: "Missing required parameters: region, protocol, range" },
      { status: 400 }
    );
  }

  const rangeSeconds = parseInt(rangeRaw, 10);
  if (isNaN(rangeSeconds)) {
    return Response.json(
      { error: "range must be a number" },
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
  const now   = Math.floor(Date.now() / 1000);  // current Unix timestamp in seconds
  const start = now - rangeSeconds;

  // Step size: we pick it based on range to avoid returning too many data points
  // 1h → 30s steps = 120 points per domain (fine)
  // 6h → 2m steps  = 180 points per domain (fine)
  // 24h → 10m steps = 144 points per domain (fine)
  const step = rangeSeconds <= 3600 ? "30s" : rangeSeconds <= 21600 ? "2m" : "10m";

  // ── 4. Query Prometheus for each domain ────────────────────────────────────
  const prometheusUrl = process.env.PROMETHEUS_URL;
  if (!prometheusUrl) {
    return Response.json(
      { error: "PROMETHEUS_URL environment variable is not set" },
      { status: 500 }
    );
  }

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

      const query = `${protocol.metric}{${labelFilters}}`;

      // Build the full Prometheus query_range URL
      const url = new URL(`${prometheusUrl}/api/v1/query_range`);
      url.searchParams.set("query", query);
      url.searchParams.set("start", String(start));
      url.searchParams.set("end",   String(now));
      url.searchParams.set("step",  step);

      try {
        const res = await fetch(url.toString(), {
          // Tell Next.js not to cache this — we always want fresh data
          cache: "no-store",
        });

        if (!res.ok) {
          console.error(`Prometheus returned ${res.status} for domain ${domain.id}`);
          return { domainId: domain.id, domainLabel: domain.label, data: [] };
        }

        const json: PrometheusResponse = await res.json();

        if (json.status !== "success" || json.data.result.length === 0) {
          // No data for this domain — return empty array, not an error
          return { domainId: domain.id, domainLabel: domain.label, data: [] };
        }

        // Prometheus returns values as [timestamp, "value_string"]
        // We convert the value to milliseconds (Prometheus stores seconds)
        const data = json.data.result[0].values.map(([timestamp, valueStr]) => ({
          timestamp,
          value: parseFloat(valueStr) * 1000,  // convert seconds → ms
        }));

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