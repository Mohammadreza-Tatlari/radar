// app/api/metrics/route.ts
const query = `probe_http_duration_seconds{
    phase="tls",
    region="${region}",
    instance="${domain}"
  }[${range}s]`;
  
  const url = `http://your-prometheus:9090/api/v1/query_range?query=${query}`;