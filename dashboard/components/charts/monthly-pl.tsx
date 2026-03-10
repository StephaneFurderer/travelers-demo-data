"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  data: { month: string; premium: number; incurred: number; lossRatio: number }[];
}

export function MonthlyPLChart({ data }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Premium, Losses & Loss Ratio by Departure Month
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis
              yAxisId="left"
              fontSize={12}
              tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              fontSize={12}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              domain={[0, "auto"]}
            />
            <Tooltip
              formatter={(v, name) => {
                if (name === "Loss Ratio") return `${(Number(v) * 100).toFixed(1)}%`;
                return `$${Number(v).toLocaleString()}`;
              }}
            />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="premium"
              fill="#3b82f6"
              name="Premium"
              radius={[4, 4, 0, 0]}
              opacity={0.8}
            />
            <Bar
              yAxisId="left"
              dataKey="incurred"
              fill="#ef4444"
              name="Incurred Losses"
              radius={[4, 4, 0, 0]}
              opacity={0.8}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="lossRatio"
              stroke="#f59e0b"
              name="Loss Ratio"
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
