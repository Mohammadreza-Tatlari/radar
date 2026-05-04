// app/radar/page.tsx
"use client";

import { useState } from "react";
import { NODES, PROTOCOLS, TIME_RANGES } from "@/config/radar";
import { RegionChart } from "@/components/radar/RegionChart";

export default function RadarPage() {

  // These three pieces of state control what all charts show simultaneously
  const [selectedProtocol, setSelectedProtocol] = useState("http");
  const [selectedPhase,    setSelectedPhase]    = useState("tls");
  const [selectedRange,    setSelectedRange]    = useState(3600);

  // When the user switches protocol, reset phase to that protocol's default
  const handleProtocolChange = (protocolId: string) => {
    setSelectedProtocol(protocolId);
    const proto = PROTOCOLS.find(p => p.id === protocolId);
    setSelectedPhase(proto?.defaultPhase ?? "");
  };

  const activeProtocol = PROTOCOLS.find(p => p.id === selectedProtocol);

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center gap-4">

          <div className="flex-1">
            <h1 className="text-lg font-semibold">Network Radar</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Live probe results from {NODES.length} regions
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">

            {/* Protocol selector */}
            {PROTOCOLS.map(proto => (
              <button
                key={proto.id}
                onClick={() => handleProtocolChange(proto.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedProtocol === proto.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                }`}
              >
                {proto.label}
              </button>
            ))}

            {/* Divider */}
            <div className="w-px h-5 bg-gray-700" />

            {/* Phase selector — only shown for HTTP */}
            {activeProtocol && activeProtocol.phases.length > 0 && (
              <>
                {activeProtocol.phases.map(ph => (
                  <button
                    key={ph}
                    onClick={() => setSelectedPhase(ph)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedPhase === ph
                        ? "bg-gray-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                    }`}
                  >
                    {ph}
                  </button>
                ))}
                <div className="w-px h-5 bg-gray-700" />
              </>
            )}

            {/* Time range selector */}
            {TIME_RANGES.map(tr => (
              <button
                key={tr.seconds}
                onClick={() => setSelectedRange(tr.seconds)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedRange === tr.seconds
                    ? "bg-gray-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                }`}
              >
                {tr.label}
              </button>
            ))}

          </div>
        </div>
      </div>

      {/* ── Chart grid ────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {NODES.map(node => (
            <RegionChart
              key={node.id}
              region={node.id}
              protocol={selectedProtocol}
              phase={selectedPhase || null}
              range={selectedRange}
            />
          ))}
        </div>
      </div>

    </main>
  );
}