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
import { Badge } from "@/components/ui/badge";

function aeColor(ae: number) {
  if (ae <= 1.05) return "#22c55e"; // green
  if (ae <= 1.20) return "#eab308"; // yellow
  return "#ef4444"; // red
}

interface AEBarChartProps {
  title: string;
  data: { label: string; ae: number; expected?: number; actual?: number }[];
  /** Show "Worst" badge on the item(s) with highest A/E > 1.05 */
  showWorstBadge?: boolean;
  height?: number;
}

export function AEBarChart({ title, data, showWorstBadge = false, height = 250 }: AEBarChartProps) {
  const maxAE = data.length > 0 ? Math.max(...data.map((d) => d.ae)) : 0;

  const chartData = data.map((d) => ({
    ...d,
    isWorst: showWorstBadge && d.ae === maxAE && maxAE > 1.05,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, "auto"]} />
            <YAxis
              type="category"
              dataKey="label"
              width={120}
              tick={({ x, y, payload }: any) => {
                const item = chartData.find((d) => d.label === payload.value);
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text x={-5} y={0} dy={4} textAnchor="end" fill="#666" fontSize={12}>
                      {payload.value}
                    </text>
                    {item?.isWorst && (
                      <foreignObject x={-120} y={-10} width={40} height={20}>
                        <span className="inline-flex items-center rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                          Worst
                        </span>
                      </foreignObject>
                    )}
                  </g>
                );
              }}
            />
            <Tooltip
              formatter={(value) => [Number(value).toFixed(2), "A/E"]}
              labelFormatter={(label) => String(label)}
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
