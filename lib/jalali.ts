// lib/jalali.ts
// Thin wrappers around jalaali-js so the rest of the app
// never imports jalaali-js directly — easier to swap later if needed.

import jalaali from "jalaali-js";

export type JalaliDate = {
  jy: number;  // Jalali year  e.g. 1403
  jm: number;  // Jalali month e.g. 2  (Ordibehesht)
  jd: number;  // Jalali day   e.g. 19
};

// Persian month names
export const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر",
  "مرداد",  "شهریور",   "مهر",   "آبان",
  "آذر",    "دی",       "بهمن",  "اسفند",
];

// Persian day-of-week labels (Saturday-first, which is the Iranian week)
export const JALALI_WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

/** Convert a JavaScript Date to a JalaliDate */
export function toJalali(date: Date): JalaliDate {
  return jalaali.toJalaali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );
}

/** Convert a JalaliDate to a JavaScript Date (at midnight local time) */
export function fromJalali(jd: JalaliDate): Date {
  const g = jalaali.toGregorian(jd.jy, jd.jm, jd.jd);
  return new Date(g.gy, g.gm - 1, g.gd, 0, 0, 0, 0);
}

/** How many days are in a given Jalali month */
export function jalaliDaysInMonth(jy: number, jm: number): number {
  return jalaali.jalaaliMonthLength(jy, jm);
}

/**
 * What Gregorian day-of-week does the 1st of this Jalali month fall on?
 * Returns 0=Saturday, 1=Sunday, ... 6=Friday (Iranian week starts Saturday)
 */
export function jalaliMonthStartOffset(jy: number, jm: number): number {
  const g = jalaali.toGregorian(jy, jm, 1);
  const date = new Date(g.gy, g.gm - 1, g.gd);
  // JS getDay(): 0=Sun,1=Mon,...,6=Sat
  // We want:     0=Sat,1=Sun,...,6=Fri
  const jsDay = date.getDay();
  return (jsDay + 1) % 7;
}

/** Format a JalaliDate as a readable Persian string e.g. "۱۳ اردیبهشت ۱۴۰۳" */
export function formatJalali(jd: JalaliDate): string {
  return `${toPersianDigits(jd.jd)} ${JALALI_MONTHS[jd.jm - 1]} ${toPersianDigits(jd.jy)}`;
}

/** Format just day + month name e.g. "۱۳ اردیبهشت" */
export function formatJalaliShort(jd: JalaliDate): string {
  return `${toPersianDigits(jd.jd)} ${JALALI_MONTHS[jd.jm - 1]}`;
}

/** Convert western digits to Persian digits */
export function toPersianDigits(n: number): string {
  return String(n).replace(/\d/g, d =>
    String.fromCharCode(0x06F0 + parseInt(d))
  );
}

/**
 * Given a selected Jalali date, return the Gregorian start and end
 * Unix timestamps for that full day (00:00:00 → 23:59:59)
 */
export function jalaliDayToTimeRange(jd: JalaliDate): { start: number; end: number } {
  const startDate = fromJalali(jd);
  const endDate   = new Date(startDate);
  endDate.setHours(23, 59, 59, 999);
  return {
    start: Math.floor(startDate.getTime() / 1000),
    end:   Math.floor(endDate.getTime()   / 1000),
  };
}