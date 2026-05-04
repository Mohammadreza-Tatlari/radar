// config.ts

export const NODES = [
    { id: "Local-Server", label: "Local Server", probe: "172.24.5.23:9115" },
    { id: "Iran",         label: "Iran",          probe: "172.24.5.22:9115" },
  ];
  
  export const DOMAINS = [
    { id: "github",    label: "GitHub",    http: "https://github.com",    icmp: "github.com",    tcp: "github.com:443"    },
    { id: "google",    label: "Google",    http: "https://google.com",    icmp: "google.com",    tcp: "google.com:443"    },
    { id: "chatgpt",   label: "ChatGPT",   http: "https://chatgpt.com",   icmp: "chatgpt.com",   tcp: "chatgpt.com:443"   },
    { id: "soft98",    label: "Soft98",    http: "https://soft98.ir",     icmp: "soft98.ir",     tcp: "soft98.ir:443"     },
    { id: "wikipedia", label: "Wikipedia", http: "https://wikipedia.org", icmp: "wikipedia.org", tcp: "wikipedia.org:443" },
  ];
  
  // These map directly to Prometheus job names
  export const PROTOCOLS = [
    { id: "http",  label: "HTTP TLS",    job: "blackbox-http",  metric: "probe_http_duration_seconds", unit: "ms" },
    { id: "icmp",  label: "ICMP Ping",   job: "blackbox-icmp",  metric: "probe_duration_seconds",      unit: "ms" },
    { id: "tcp",   label: "TCP Connect", job: "blackbox-tcp",   metric: "probe_duration_seconds",      unit: "ms" },
  ];
  
  export const TIME_RANGES = [
    { label: "Last 1h",  step: "30s",  seconds: 3600   },
    { label: "Last 6h",  step: "2m",   seconds: 21600  },
    { label: "Last 24h", step: "10m",  seconds: 86400  },
  ];
  
  export const DOMAIN_COLORS: Record<string, string> = {
    github:    "#f59e0b",
    google:    "#3b82f6",
    chatgpt:   "#10b981",
    soft98:    "#8b5cf6",
    wikipedia: "#ef4444",
  };