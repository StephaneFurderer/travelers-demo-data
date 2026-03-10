"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function aeColor(ae: number) {
  if (ae <= 1.05) return "#22c55e"; // green
  if (ae <= 1.20) return "#eab308"; // yellow
  return "#ef4444"; // red
}

export function AEBySegmentChart({ data }: { data: any[] }) {
  const chartData = data.map((d) => ({
    segment: d.segment
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    ae: d.ae,
    expected: d.expected,
    actual: d.actual,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">A/E Ratio by Segment (2026)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, "auto"]} />
            <YAxis type="category" dataKey="segment" width={120} />
            <Tooltip
              formatter={(value) => [Number(value).toFixed(2), "A/E"]}
              labelFormatter={(label) => `Segment: ${label}`}
            />
            <ReferenceLine x={1.0} stroke="#666" strokeDasharray="5 5" label="1.0" />
            <Bar dataKey="ae" name="A/E Ratio">
              {chartData.map((entry, index) => (
                <Cell key={index} fill={aeColor(entry.ae)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
