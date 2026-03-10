"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function aeColor(ae: number): string {
  if (ae === 0) return "bg-gray-100 text-gray-400";
  if (ae <= 1.05) return "bg-green-100 text-green-800";
  if (ae <= 1.20) return "bg-yellow-100 text-yellow-800";
  if (ae <= 1.50) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800 font-semibold";
}

function segmentLabel(seg: string) {
  return seg.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

export function AEHeatmap({ data }: { data: any[] }) {
  const segments = ["winter_birds", "holiday_travelers", "baseline"];

  // Build lookup: segment+month → ae
  const lookup: Record<string, any> = {};
  for (const cell of data) {
    lookup[`${cell.segment}-${cell.month}`] = cell;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">A/E Heatmap — Segment x Departure Month (2026)</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 border-b font-medium">Segment</th>
              {MONTHS.map((m) => (
                <th key={m} className="text-center p-2 border-b font-medium text-xs">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {segments.map((seg) => (
              <tr key={seg}>
                <td className="p-2 border-b font-medium whitespace-nowrap">
                  {segmentLabel(seg)}
                </td>
                {MONTHS.map((_, mi) => {
                  const cell = lookup[`${seg}-${mi + 1}`];
                  const ae = cell?.ae || 0;
                  return (
                    <td
                      key={mi}
                      className={`text-center p-2 border-b text-xs ${aeColor(ae)}`}
                      title={`Expected: $${cell?.expected?.toLocaleString() || 0}, Actual: $${cell?.actual?.toLocaleString() || 0}`}
                    >
                      {ae > 0 ? ae.toFixed(2) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
