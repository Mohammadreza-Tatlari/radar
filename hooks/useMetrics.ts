// hooks/useMetrics.ts
import useSWR from "swr";
import type { MetricsResponse } from "@/types/radar";

const fetcher = (url: string): Promise<MetricsResponse> =>
  fetch(url).then(res => {
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  });

// Two modes — either a rolling range from now, or explicit start/end
type UseMetricsParams =
  | { region: string; protocol: string; phase?: string | null; mode: "range";  range: number }
  | { region: string; protocol: string; phase?: string | null; mode: "window"; start: number; end: number };

export function useMetrics(params: UseMetricsParams) {
  const base = new URLSearchParams({
    region:   params.region,
    protocol: params.protocol,
    ...(params.phase ? { phase: params.phase } : {}),
  });

  if (params.mode === "range") {
    base.set("range", String(params.range));
  } else {
    base.set("start", String(params.start));
    base.set("end",   String(params.end));
  }

  // Only auto-refresh when in range mode (live data)
  // When viewing a past date the data doesn't change, no need to refresh
  const shouldRefresh = params.mode === "range";

  const { data, error, isLoading } = useSWR<MetricsResponse>(
    `/api/metrics?${base.toString()}`,
    fetcher,
    {
      refreshInterval:  shouldRefresh ? 30_000 : 0,
      revalidateOnFocus: false,
      keepPreviousData:  true,
    }
  );

  return { data, isLoading, isError: !!error, error };
}