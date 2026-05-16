// lib/smoothing.ts

import type { MetricPoint } from "@/types/radar";
import { PROBE_TIMEOUT_MS } from "@/config/radar";

/**
 * Marks data points above the timeout threshold as failures.
 * Returns the cleaned series (timeouts removed) and a failure summary.
 *
 * Instead of removing points entirely (which would cause connectNulls
 * to bridge the gap), we return them as null so Recharts draws a gap.
 */
export type ProcessedSeries = {
  cleaned: (MetricPoint | null)[];  // null = failed probe
  failureRate: number;               // 0.0 to 1.0
  isFullyDown: boolean;              // true if >80% of points are failures
};


export function filterTimeouts(points: MetricPoint[]): ProcessedSeries {
  if (points.length === 0) {
    return { cleaned: [], failureRate: 0, isFullyDown: false };
  }

  const cleaned = points.map(p =>
    p.value >= PROBE_TIMEOUT_MS ? null : p
  );

  const failureCount = cleaned.filter(p => p === null).length;
  const failureRate  = failureCount / points.length;

  return {
    cleaned,
    failureRate,
    isFullyDown: failureRate > 0.8,
  };
}


/**
 * Calculates the median of an array of numbers.
 * More robust than average for noisy data because it ignores extremes.
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculates the Median Absolute Deviation — a robust measure of how spread
 * out values are, similar to standard deviation but not skewed by outliers.
 *
 * MAD = median( |each_value - median_of_all_values| )
 *
 * A point is an outlier if it deviates from the median by more than
 * (threshold × MAD). This adapts to the actual spread of your data
 * instead of using a fixed multiplier.
 */
function medianAbsoluteDeviation(values: number[], med: number): number {
  const deviations = values.map(v => Math.abs(v - med));
  return median(deviations);
}

/**
 * Removes single-sample spikes using MAD-based outlier detection.
 *
 * A point is replaced only if ALL three conditions are true:
 *  1. It deviates from the median by more than (threshold × MAD)
 *  2. Its left neighbor is NOT also an outlier
 *  3. Its right neighbor is NOT also an outlier
 *
 * This means sustained events (real degradation lasting 2+ samples)
 * are always preserved. Only truly isolated one-sample anomalies are smoothed.
 *
 * threshold=3.5 is the standard value from statistics literature for
 * detecting outliers with MAD. Lower = more aggressive, Higher = more lenient.
 */
export function removeSingleSampleSpikes(
  points: MetricPoint[],
  threshold: number = 3.5
): MetricPoint[] {
  if (points.length < 3) return points;

  const values = points.map(p => p.value);
  const med = median(values);
  const mad = medianAbsoluteDeviation(values, med);

  // If MAD is 0 (all values identical) or data is too flat, skip filtering
  // A very small MAD means the series is essentially constant — nothing to filter
  if (mad < 0.001) return points;

  // Consistency factor 1.4826 makes MAD comparable to standard deviation
  // for normally distributed data — this is the standard statistical adjustment
  const adjustedMad = mad * 1.4826;

  // Pre-compute which points are outliers so we can check neighbors efficiently
  const isOutlier = values.map(v => Math.abs(v - med) / adjustedMad > threshold);

  return points.map((point, i) => {
    if (i === 0 || i === points.length - 1) return point;
    if (!isOutlier[i]) return point;

    // Only replace if this outlier is isolated (neighbors are not outliers)
    const neighborsSustained = isOutlier[i - 1] || isOutlier[i + 1];
    if (neighborsSustained) return point;

    // Replace isolated spike with interpolated value between neighbors
    return {
      timestamp: point.timestamp,
      value: (points[i - 1].value + points[i + 1].value) / 2,
    };
  });
}

/**
 * Rolling average — smooths the line by averaging each point with its neighbors.
 * windowSize=3 means each point = average of (previous, current, next).
 * windowSize=5 gives more smoothing but loses more detail.
 *
 * Unlike spike removal, this affects every point — it softens both
 * peaks and valleys. Use it when you want a clean trend line.
 */
export function rollingAverage(
  points: MetricPoint[],
  windowSize: number = 3
): MetricPoint[] {
  if (points.length < windowSize) return points;

  const half = Math.floor(windowSize / 2);

  return points.map((point, i) => {
    const start  = Math.max(0, i - half);
    const end    = Math.min(points.length - 1, i + half);
    const window = points.slice(start, end + 1);
    const avg    = window.reduce((sum, p) => sum + p.value, 0) / window.length;

    return { timestamp: point.timestamp, value: avg };
  });
}