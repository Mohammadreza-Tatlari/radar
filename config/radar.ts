// config/radar.ts

export const NODES = [
    { id: "Local-Server", label: "Local Server", probe: "172.24.5.23:9115" },
    { id: "Iran",         label: "Iran",         probe: "172.24.5.22:9115" },
    { id: "USA",          label: "USA",          probe: "172.24.5.22:9115" },
    { id: "Germany",      label: "Germany",      probe: "172.24.5.22:9115" },
    { id: "France",       label: "France",       probe: "172.24.5.22:9115" },
    //{ id: "USA",          label: "USA",           probe: "172.24.5.25:9115" }, // ← add this when new node is added in prometheus file_sd
  ] as const;
  
  export const DOMAINS = [
    { id: "github",    label: "GitHub",    http: "https://github.com",    icmp: "github.com",    tcp: "github.com:443"    },
    { id: "google",    label: "Google",    http: "https://google.com",    icmp: "google.com",    tcp: "google.com:443"    },
    { id: "chatgpt",   label: "ChatGPT",   http: "https://chatgpt.com",   icmp: "chatgpt.com",   tcp: "chatgpt.com:443"   },
    { id: "wikipedia", label: "Wikipedia", http: "https://wikipedia.org", icmp: "wikipedia.org", tcp: "wikipedia.org:443" },
    { id: "soft98",    label: "Soft98",    http: "https://soft98.ir",     icmp: "soft98.ir",     tcp: "soft98.ir:443"     },
  ] as const;
  
  export const PROTOCOLS = [
    {
      id:     "http",
      label:  "HTTP TLS",
      job:    "blackbox-http",
      metric: "probe_http_duration_seconds",
      // HTTP has phases: connect, tls, processing, transfer, resolve
      // we default to "tls" to match your Grafana dashboard
      defaultPhase: "tls",
      phases: ["connect", "tls", "processing", "transfer", "resolve"],
      unit:   "ms",
    },
    {
      id:     "icmp",
      label:  "ICMP Ping",
      job:    "blackbox-icmp",
      metric: "probe_duration_seconds",
      defaultPhase: null,   // no phase label for ICMP
      phases: [],
      unit:   "ms",
    },
    {
      id:     "tcp",
      label:  "TCP Connect",
      job:    "blackbox-tcp",
      metric: "probe_duration_seconds",
      defaultPhase: null,   // no phase label for TCP
      phases: [],
      unit:   "ms",
    },
  ] as const;
  
  export const TIME_RANGES = [
    { label: "Last 1h",  seconds: 3600,  step: "30s" },
    { label: "Last 6h",  seconds: 21600, step: "2m"  },
    { label: "Last 24h", seconds: 86400, step: "10m" },
  ] as const;
  
  // These match your Grafana line colors as closely as possible
  export const DOMAIN_COLORS: Record<string, string> = {
    github:    "#f59e0b",  // amber
    google:    "#eab308",  // yellow  
    chatgpt:   "#22c55e",  // green
    wikipedia: "#f97316",  // orange
    soft98:    "#3b82f6",  // blue
  };