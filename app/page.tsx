// app/radar/page.tsx
"use client";

import { useState } from "react";
import { NODES, PROTOCOLS, TIME_RANGES } from "@/config/radar";
import { RegionChart } from "@/components/radar/RegionChart";
import { DatePicker }  from "@/components/radar/DatePicker";
import { jalaliDayToTimeRange, toJalali, type JalaliDate } from "@/lib/jalali";

export default function RadarPage() {
  const [selectedProtocol, setSelectedProtocol] = useState("http");
  const [selectedPhase,    setSelectedPhase]    = useState("tls");
  const [selectedRange,    setSelectedRange]    = useState(3600);
  const [smoothing,        setSmoothing]        = useState<"none"|"spike"|"rolling">("rolling");
  const [pickedDate,       setPickedDate]        = useState<JalaliDate | null>(null);

  const handleProtocolChange = (protocolId: string) => {
    setSelectedProtocol(protocolId);
    const proto = PROTOCOLS.find(p => p.id === protocolId);
    setSelectedPhase(proto?.defaultPhase ?? "tls");
  };

  const activeProtocol = PROTOCOLS.find(p => p.id === selectedProtocol);

  // When a date is picked, compute its full-day window once here
  // and pass it down to all charts — avoids recomputing in each chart
  const timeWindow = pickedDate
    ? jalaliDayToTimeRange(pickedDate)
    : null;

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

          <div className="flex flex-wrap items-center gap-2">

            {/* Date picker — always visible */}
            <DatePicker
              value={pickedDate}
              onChange={setPickedDate}
            />

            <div className="w-px h-5 bg-gray-700" />

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

            <div className="w-px h-5 bg-gray-700" />

            {/* If you want to add monitoring the phases of HTTPS you can simply uncomment this section */}
            {/* Phase selector — HTTP only */}
            {/* {activeProtocol && activeProtocol.phases.length > 0 && (
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
            )} */}

            {/* Time range buttons — only shown in live mode (no date picked) */}
            {!pickedDate && (
              <>
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
                <div className="w-px h-5 bg-gray-700" />
              </>
            )}

            {/* Smoothing selector */}
            {[
              // { id: "none",    label: "Raw"       },
              // { id: "spike",   label: "No spikes" },
              { id: "rolling", label: "Smooth"    },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setSmoothing(opt.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  smoothing === opt.id
                    ? "bg-gray-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}

          </div>
        </div>
      </div>

      {/* ── Chart grid ────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-1 gap-4">  {/* change xl:grid-cols-2 if you want tables to be side by side*/}
          {NODES.map(node => (
            <RegionChart
              key={node.id}
              region={node.id}
              protocol={selectedProtocol}
              phase={selectedPhase || null}
              smoothing={smoothing}
              // Pass either window mode or range mode depending on date picker state
              {...(timeWindow
                ? { mode: "window" as const, start: timeWindow.start, end: timeWindow.end }
                : { mode: "range"  as const, range: selectedRange }
              )}
            />
          ))}
        </div>
      </div>

    </main>
  );
}