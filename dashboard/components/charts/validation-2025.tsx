"use client";

import { AEBarChart } from "./ae-bar-chart";

interface Validation2025Props {
  data: {
    portfolioAE: number;
    bySegment: { segment: string; ae: number; expected: number; actual: number }[];
  };
}

export function Validation2025({ data }: Validation2025Props) {
  if (!data.bySegment || data.bySegment.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 rounded-lg bg-muted/50">
        2025 validation data unavailable
      </div>
    );
  }

  const chartData = data.bySegment.map((d) => ({
    label: d.segment,
    ae: d.ae,
    expected: d.expected,
    actual: d.actual,
  }));

  return (
    <AEBarChart
      title={`2025 Model Validation — Portfolio A/E: ${data.portfolioAE.toFixed(2)}`}
      data={chartData}
      showWorstBadge={false}
    />
  );
}
