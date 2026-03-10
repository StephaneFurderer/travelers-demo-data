"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function adequacyBadge(adequacy: string) {
  switch (adequacy) {
    case "adequate":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Adequate</Badge>;
    case "watch":
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Watch</Badge>;
    case "inadequate":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Inadequate</Badge>;
    default:
      return <Badge variant="outline">{adequacy}</Badge>;
  }
}

export function RateAdequacyTable({ data }: { data: any[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Rate Adequacy Analysis (2026)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dimension</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Expected Loss</TableHead>
              <TableHead className="text-right">Actual Loss</TableHead>
              <TableHead className="text-right">A/E</TableHead>
              <TableHead className="text-center">Adequacy</TableHead>
              <TableHead className="text-right">Rec. Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r: any) => (
              <TableRow key={`${r.dimensionType}-${r.dimension}`}>
                <TableCell className="font-medium">{r.dimension}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {r.dimensionType}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{fmt(r.expected)}</TableCell>
                <TableCell className="text-right">{fmt(r.actual)}</TableCell>
                <TableCell className="text-right">
                  <span
                    className={
                      r.ae > 1.20
                        ? "text-red-600 font-semibold"
                        : r.ae > 1.05
                        ? "text-amber-600"
                        : "text-green-600"
                    }
                  >
                    {r.ae.toFixed(2)}
                  </span>
                </TableCell>
                <TableCell className="text-center">{adequacyBadge(r.adequacy)}</TableCell>
                <TableCell className="text-right">
                  {r.recommendedChange > 0 ? (
                    <span className="text-red-600 font-medium">+{r.recommendedChange}%</span>
                  ) : (
                    <span className="text-green-600">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
