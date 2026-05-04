// hooks/useMetrics.ts
import useSWR from "swr";
import type { MetricsResponse } from "@/types/radar";

// The fetcher function SWR uses — just a typed wrapper around fetch
const fetcher = (url: string): Promise<MetricsResponse> =>
  fetch(url).then(res => {
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  });

type UseMetricsParams = {
  region:   string;
  protocol: string;
  phase?:   string | null;
  range:    number;
};

export function useMetrics({ region, protocol, phase, range }: UseMetricsParams) {
  // Build the URL — only include phase param if it has a value
  const params = new URLSearchParams({
    region,
    protocol,
    range: String(range),
    ...(phase ? { phase } : {}),
  });

  const { data, error, isLoading } = useSWR<MetricsResponse>(
    `/api/metrics?${params.toString()}`,
    fetcher,
    {
      refreshInterval: 30_000,    // re-fetch every 30 seconds, like Grafana's refresh
      revalidateOnFocus: false,   // don't re-fetch just because user switched tabs
      keepPreviousData: true,     // keep showing old chart while new data loads
    }
  );

  return {
    data,
    isLoading,
    isError: !!error,
    error,
  };
}