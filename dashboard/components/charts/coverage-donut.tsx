"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  data: { name: string; value: number }[];
}

const COLORS = ["#f59e0b", "#3b82f6", "#8b5cf6"]; // hotel_only, flight_only, hotel_and_flight

export function CoverageDonutChart({ data }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Coverage Type Split</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => Number(v).toLocaleString()} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
