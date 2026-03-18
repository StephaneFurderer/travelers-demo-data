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

interface Scenario {
  label: string;
  description: string;
  frequency: number;
  severity: number;
  purePremium: number;
}

interface Props {
  scenarios: Scenario[];
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtCurrency(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function ScenarioCalculator({ scenarios }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Actual Portfolio Experience by Segment</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scenario</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Frequency</TableHead>
              <TableHead className="text-right">Avg Severity</TableHead>
              <TableHead className="text-right">Avg Loss / Booking</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scenarios.map((s) => (
              <TableRow key={s.label}>
                <TableCell className="font-medium">{s.label}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {s.description}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {fmtPct(s.frequency)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {fmtCurrency(s.severity)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">
                  {fmtCurrency(s.purePremium)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
