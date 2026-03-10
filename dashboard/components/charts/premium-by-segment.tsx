"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  data: { segment: string; hotel: number; flight: number }[];
}

const formatCurrency = (v: number) =>
  `$${(v / 1000).toFixed(0)}K`;

export function PremiumBySegmentChart({ data }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pure Premium by Segment</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="segment"
              tickFormatter={(v) =>
                v.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
              }
              fontSize={12}
            />
            <YAxis tickFormatter={formatCurrency} fontSize={12} />
            <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
            <Legend />
            <Bar dataKey="hotel" stackId="a" fill="#3b82f6" name="Hotel" radius={[0, 0, 0, 0]} />
            <Bar dataKey="flight" stackId="a" fill="#f97316" name="Flight" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
