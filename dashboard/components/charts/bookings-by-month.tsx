"use client";

import {
  LineChart,
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
  data: { month: string; winter_birds: number; holiday_travelers: number; baseline: number }[];
}

export function BookingsByMonthChart({ data }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Bookings by Departure Month</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="winter_birds" stroke="#3b82f6" name="Winter Birds" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="holiday_travelers" stroke="#f97316" name="Holiday Travelers" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="baseline" stroke="#10b981" name="Baseline" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
