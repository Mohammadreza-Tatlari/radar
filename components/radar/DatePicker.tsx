// components/radar/DatePicker.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import {
  toJalali, fromJalali, jalaliDaysInMonth, jalaliMonthStartOffset,
  formatJalali, formatJalaliShort, toPersianDigits,
  JALALI_MONTHS, JALALI_WEEKDAYS,
  type JalaliDate,
} from "@/lib/jalali";

type Props = {
  value:    JalaliDate | null;  // null means "live mode" (no date selected)
  onChange: (date: JalaliDate | null) => void;
};

export function DatePicker({ value, onChange }: Props) {
  const todayJalali = toJalali(new Date());

  // The month currently shown in the calendar grid
  const [viewYear,  setViewYear]  = useState(value?.jy ?? todayJalali.jy);
  const [viewMonth, setViewMonth] = useState(value?.jm ?? todayJalali.jm);
  const [isOpen,    setIsOpen]    = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close calendar when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goToPrevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  }

  function goToNextMonth() {
    // Don't allow navigating past current month
    if (viewYear === todayJalali.jy && viewMonth === todayJalali.jm) return;
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  }

  function handleDayClick(day: number) {
    const selected: JalaliDate = { jy: viewYear, jm: viewMonth, jd: day };

    // Don't allow selecting future dates
    const selectedGregorian = fromJalali(selected);
    if (selectedGregorian > new Date()) return;

    onChange(selected);
    setIsOpen(false);
  }

  function handleTodayClick() {
    onChange(null);  // null = back to live mode
    setIsOpen(false);
  }

  // Build the grid of days
  const daysInMonth  = jalaliDaysInMonth(viewYear, viewMonth);
  const startOffset  = jalaliMonthStartOffset(viewYear, viewMonth);
  const isNextDisabled = viewYear === todayJalali.jy && viewMonth === todayJalali.jm;

  // Pill label
  const pillLabel = value
    ? formatJalali(value)
    : `${formatJalaliShort(todayJalali)} — زنده`;

  return (
    <div ref={containerRef} style={{ position: "relative", direction: "rtl" }}>

      {/* ── Collapsed pill ───────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M1 6h14" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M5 1v2M11 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span style={{ fontFamily: "Vazirmatn, Tahoma, sans-serif" }}>
          {pillLabel}
        </span>
      </button>

      {/* ── Expanded calendar ────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="absolute top-10 left-0 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4"
          style={{ width: "280px", fontFamily: "Vazirmatn, Tahoma, sans-serif" }}
        >
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            {/* Next month arrow (right side in RTL) */}
            <button
              onClick={goToNextMonth}
              disabled={isNextDisabled}
              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                isNextDisabled
                  ? "text-gray-700 cursor-not-allowed"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              →
            </button>

            <span className="text-sm font-medium text-white">
              {JALALI_MONTHS[viewMonth - 1]} {toPersianDigits(viewYear)}
            </span>

            {/* Prev month arrow (left side in RTL) */}
            <button
              onClick={goToPrevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            >
              ←
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2">
            {JALALI_WEEKDAYS.map(d => (
              <div key={d} className="text-center text-xs text-cyan-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-1">
            {/* Empty cells for offset */}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday    = viewYear === todayJalali.jy && viewMonth === todayJalali.jm && day === todayJalali.jd;
              const isSelected = value && value.jy === viewYear && value.jm === viewMonth && value.jd === day;

              // Is this day in the future?
              const dayDate = fromJalali({ jy: viewYear, jm: viewMonth, jd: day });
              const isFuture = dayDate > new Date();

              return (
                <button
                  key={day}
                  onClick={() => !isFuture && handleDayClick(day)}
                  disabled={isFuture}
                  className={`
                    h-8 w-full text-xs rounded-lg transition-colors
                    ${isFuture   ? "text-gray-700 cursor-not-allowed" : ""}
                    ${isSelected ? "bg-cyan-500 text-black font-medium" : ""}
                    ${isToday && !isSelected ? "border border-cyan-500 text-cyan-400" : ""}
                    ${!isSelected && !isToday && !isFuture ? "text-gray-300 hover:bg-gray-800 hover:text-white" : ""}
                  `}
                >
                  {toPersianDigits(day)}
                </button>
              );
            })}
          </div>

          {/* Footer buttons */}
          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-800">
            <button
              onClick={handleTodayClick}
              className="flex-1 py-1.5 text-xs rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              امروز
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="flex-1 py-1.5 text-xs rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              ادامه
            </button>
          </div>
        </div>
      )}
    </div>
  );
}