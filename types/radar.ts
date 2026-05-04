// types/radar.ts

// Represents a single data point returned from Prometheus
export type MetricPoint = {
    timestamp: number;  // Unix timestamp in seconds
    value: number;      // Duration in seconds (we convert to ms in the hook)
  };
  
  // What the API route returns for one domain
  export type DomainMetrics = {
    domainId: string;
    domainLabel: string;
    data: MetricPoint[];
  };
  
  // What the full API response looks like
  export type MetricsResponse = {
    region: string;
    protocol: string;
    phase: string | null;
    range: number;
    domains: DomainMetrics[];
  };
  
  // The shape of a raw Prometheus query_range result
  // (you don't need to memorize this — it's just to make TypeScript happy)
  export type PrometheusResult = {
    metric: Record<string, string>;
    values: [number, string][];  // [timestamp, value_as_string]
  };
  
  export type PrometheusResponse = {
    status: "success" | "error";
    data: {
      resultType: string;
      result: PrometheusResult[];
    };
  };