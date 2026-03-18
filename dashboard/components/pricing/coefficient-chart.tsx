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

interface Props {
  title: string;
  data: { name: string; value: number }[];
  referenceLabel?: string;
}

export function CoefficientChart({ title, data, referenceLabel }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {referenceLabel && (
          <p className="text-xs text-muted-foreground">{referenceLabel}</p>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis type="number" fontSize={12} tickFormatter={(v) => v.toFixed(2)} />
            <YAxis type="category" dataKey="name" fontSize={12} width={70} />
            <Tooltip
              formatter={(v) => Number(v).toFixed(4)}
              labelFormatter={(label) => `Factor: ${label}`}
            />
            <ReferenceLine x={0} stroke="#6b7280" strokeDasharray="3 3" />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.value >= 0 ? "#f43f5e" : "#10b981"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
