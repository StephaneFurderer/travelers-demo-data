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

interface Coefficient {
  name: string;
  key: string;
  value: number;
  description: string;
}

interface CoefficientGroup {
  category: string;
  coefficients: Coefficient[];
}

interface Props {
  title: string;
  groups: CoefficientGroup[];
  modelDescription: string;
}

function coefficientColor(value: number) {
  if (value > 0) return "bg-red-50 text-red-900";
  if (value < 0) return "bg-green-50 text-green-900";
  return "";
}

export function CoefficientTable({ title, groups, modelDescription }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{modelDescription}</p>
      </CardHeader>
      <CardContent>
        {groups.map((group) => (
          <div key={group.category} className="mb-4 last:mb-0">
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">
              {group.category}
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factor</TableHead>
                  <TableHead className="text-right">Coefficient</TableHead>
                  <TableHead className="text-right">Effect (exp)</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.coefficients.map((coeff) => (
                  <TableRow key={coeff.key} className={coefficientColor(coeff.value)}>
                    <TableCell className="font-medium">{coeff.name}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {coeff.value >= 0 ? "+" : ""}
                      {coeff.value.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {Math.exp(coeff.value).toFixed(3)}x
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {coeff.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
