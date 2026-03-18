"use client";

import { AEBarChart } from "./ae-bar-chart";

export function AEBySegmentChart({ data, showWorstBadge = false }: { data: any[]; showWorstBadge?: boolean }) {
  const chartData = data.map((d) => ({
    label: d.segment
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    ae: d.ae,
    expected: d.expected,
    actual: d.actual,
  }));

  return (
    <AEBarChart
      title="A/E Ratio by Segment (2026)"
      data={chartData}
      showWorstBadge={showWorstBadge}
    />
  );
}
