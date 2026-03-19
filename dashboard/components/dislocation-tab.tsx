"use client";

import { useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Presentation } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/kpi-card";
import { AEBySegmentChart } from "@/components/charts/ae-by-segment";
import { AEHeatmap } from "@/components/charts/ae-heatmap";
import { YoYComparisonChart } from "@/components/charts/yoy-comparison";
import { RateAdequacyTable } from "@/components/charts/rate-adequacy-table";
import { AEBarChart } from "@/components/charts/ae-bar-chart";
import { Validation2025 } from "@/components/charts/validation-2025";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Diagnosis text generation ───────────────────────────────────────
// Pure function: data in → structured diagnosis out
export function generateDiagnosis(data: any): {
  title: string;
  body: string;
  isStressed: boolean;
} {
  const ae = data.kpis?.portfolioAE || 0;
  if (ae <= 1.05) {
    return {
      title: "Portfolio Performing as Expected",
      body: "Actual experience is in line with GLM predictions across all segments.",
      isStressed: false,
    };
  }

  const worstSeg = data.kpis?.worstSegment || "Unknown";
  const worstSegAE = data.kpis?.worstSegmentAE || 0;
  const worstMonth = data.kpis?.worstMonth || "Unknown";

  // Find if frequency or severity is the primary driver
  const yoy = data.yoy || [];
  let freqDriven = 0;
  let sevDriven = 0;
  for (const row of yoy) {
    const freqChange = row.freq2025 > 0 ? (row.freq2026 - row.freq2025) / row.freq2025 : 0;
    const sevChange = row.sev2025 > 0 ? (row.sev2026 - row.sev2025) / row.sev2025 : 0;
    if (freqChange > sevChange) freqDriven++;
    else sevDriven++;
  }
  const primaryDriver = freqDriven >= sevDriven ? "frequency increases" : "severity increases";

  // Find worst destination type
  const destTypes = data.aeByDestType || [];
  const worstDest = destTypes.length > 0
    ? destTypes.reduce((a: any, b: any) => a.ae > b.ae ? a : b)
    : null;
  const worstDestName = worstDest
    ? worstDest.destinationType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    : null;

  // Find hurricane season concentration from heatmap
  const heatmap = data.heatmap || [];
  const hurricaneMonths = heatmap.filter((h: any) => h.month >= 8 && h.month <= 10);
  const avgHurricaneAE = hurricaneMonths.length > 0
    ? hurricaneMonths.reduce((s: number, h: any) => s + h.ae, 0) / hurricaneMonths.length
    : 0;
  const hasSeasonalConcentration = avgHurricaneAE > ae * 1.1;

  const deterioration = ((ae - 1) * 100).toFixed(0);

  let body = `${worstSeg} segment deteriorated ${deterioration}% above expected (A/E = ${worstSegAE.toFixed(2)}), driven primarily by ${primaryDriver}`;

  if (hasSeasonalConcentration) {
    body += ` concentrated in Aug\u2013Oct (hurricane season)`;
  }

  if (worstDestName && worstDest.ae > 1.1) {
    body += `. ${worstDestName} destinations show the highest A/E at ${worstDest.ae.toFixed(2)}`;
  }

  body += ".";

  return {
    title: "Portfolio Under Stress",
    body,
    isStressed: true,
  };
}

// ─── Stepper section wrapper ─────────────────────────────────────────
function StepSection({
  step,
  currentStep,
  presenterMode,
  children,
  className = "",
}: {
  step: number;
  currentStep: number;
  presenterMode: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const visible = !presenterMode || step <= currentStep;
  return (
    <div
      className={`transition-all duration-300 ease-in-out ${
        visible ? "opacity-100 max-h-[5000px]" : "opacity-0 max-h-0 overflow-hidden"
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────
const TOTAL_STEPS = 5;

interface DislocationTabProps {
  data: any;
  onNavigateToMap?: (destinationType: string) => void;
}

export function DislocationTab({ data, onNavigateToMap }: DislocationTabProps) {
  const [presenterMode, setPresenterMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  if (!data.kpis.has2026Data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No 2026 data found. Run the 2026 generator to populate dislocated portfolio data.
        </CardContent>
      </Card>
    );
  }

  const diagnosis = generateDiagnosis(data);

  // Find worst dest type for cross-tab link
  const worstDestType = data.aeByDestType?.length > 0
    ? data.aeByDestType.reduce((a: any, b: any) => a.ae > b.ae ? a : b)
    : null;
  const worstDestLabel = worstDestType
    ? worstDestType.destinationType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    : null;

  // Dest-type chart data
  const destTypeChartData = (data.aeByDestType || []).map((d: any) => ({
    label: d.destinationType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
    ae: d.ae,
    expected: d.expected,
    actual: d.actual,
  }));

  return (
    <div className="space-y-6">
      {/* ─── Stepper Controls ─── */}
      <div className="sticky top-[73px] z-40 flex items-center justify-between rounded-lg border bg-background/95 backdrop-blur px-4 py-2 shadow-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPresenterMode(!presenterMode)}
          className="gap-1.5"
        >
          <Presentation className="h-4 w-4" />
          {presenterMode ? "Exit Presenter Mode" : "Presenter Mode"}
        </Button>
        {presenterMode && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="text-sm text-muted-foreground min-w-[80px] text-center">
              Step {currentStep + 1} of {TOTAL_STEPS + 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep((s) => Math.min(TOTAL_STEPS, s + 1))}
              disabled={currentStep === TOTAL_STEPS}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* ─── Section 0: Diagnosis Hero Banner ─── (always visible) */}
      <Card className={diagnosis.isStressed ? "bg-[#ef4444]/10 border-[#ef4444]/30" : "bg-[#10b981]/10 border-[#10b981]/30"}>
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="h-6 w-6 mt-0.5 shrink-0"
              style={{ color: diagnosis.isStressed ? "#f59e0b" : "#10b981" }}
            />
            <div className="space-y-3">
              <h2 className="text-xl font-bold">{diagnosis.title}</h2>
              <p className="text-base text-foreground/80">{diagnosis.body}</p>
              <div className="flex gap-4 pt-1">
                <div>
                  <p className="text-xs text-muted-foreground">Portfolio A/E</p>
                  <p className="text-lg font-bold">{data.kpis.portfolioAE.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Worst Segment</p>
                  <p className="text-lg font-bold">{data.kpis.worstSegment}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Worst Month</p>
                  <p className="text-lg font-bold">{data.kpis.worstMonth}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Section 1: "The Model Was Sound" (2025) ─── */}
      <StepSection step={1} currentStep={currentStep} presenterMode={presenterMode}
        className="rounded-lg border-l-4 border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 space-y-3"
      >
        <div>
          <h2 className="text-lg font-semibold">The Model Was Sound</h2>
          <p className="text-sm text-muted-foreground">
            In 2025, our GLM accurately predicted claims across all three segments.
            A/E ratios near 1.0 confirm the model was well-calibrated before the shift.
          </p>
        </div>
        <Validation2025 data={data.validation2025} />
      </StepSection>

      {/* ─── Section 2: "Something Shifted" (2026) ─── */}
      <StepSection step={2} currentStep={currentStep} presenterMode={presenterMode}
        className="rounded-lg border-l-4 border-red-400 bg-red-50/30 dark:bg-red-950/20 p-4 space-y-4"
      >
        <div>
          <h2 className="text-lg font-semibold">Something Shifted</h2>
          <p className="text-sm text-muted-foreground">
            2026 actual losses exceed model predictions. The portfolio is underpriced.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Portfolio A/E"
            value={data.kpis.portfolioAE.toFixed(2)}
            subtitle="Actual / Expected loss"
          />
          <KpiCard
            title="Worst Segment"
            value={data.kpis.worstSegment}
            subtitle={`A/E = ${data.kpis.worstSegmentAE.toFixed(2)}`}
          />
          <KpiCard
            title="Worst Month"
            value={data.kpis.worstMonth}
            subtitle={`A/E = ${data.kpis.worstMonthAE.toFixed(2)}`}
          />
          <KpiCard
            title="Model Accuracy"
            value={`${data.kpis.modelAccuracy}%`}
            subtitle="1/A/E as % (100% = perfect)"
          />
        </div>
        <AEBySegmentChart data={data.aeBySegment} showWorstBadge />
      </StepSection>

      {/* ─── Section 3: "Frequency & Severity Decomposition" ─── */}
      <StepSection step={3} currentStep={currentStep} presenterMode={presenterMode}>
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Frequency & Severity Decomposition</h2>
            <p className="text-sm text-muted-foreground">
              Breaking down the deterioration: is the portfolio experiencing more claims (frequency) or larger claims (severity)?
            </p>
          </div>
          <YoYComparisonChart data={data.yoy} />
        </div>
      </StepSection>

      {/* ─── Section 4: "When and Where" ─── */}
      <StepSection step={4} currentStep={currentStep} presenterMode={presenterMode}>
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">When and Where</h2>
            <p className="text-sm text-muted-foreground">
              Identifying the temporal and geographic concentration of the dislocation.
            </p>
          </div>
          <AEHeatmap data={data.heatmap} />
          <AEBarChart
            title="A/E Ratio by Destination Type (2026)"
            data={destTypeChartData}
            showWorstBadge
          />
          {worstDestType && worstDestType.ae > 1.1 && onNavigateToMap && (
            <button
              onClick={() => onNavigateToMap(worstDestType.destinationType)}
              className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              Investigate {worstDestLabel} on Map &rarr;
            </button>
          )}
        </div>
      </StepSection>

      {/* ─── Section 5: "Rate Adequacy" ─── */}
      <StepSection step={5} currentStep={currentStep} presenterMode={presenterMode}>
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Rate Adequacy</h2>
            <p className="text-sm text-muted-foreground">
              Recommended pricing actions based on observed dislocation.
            </p>
          </div>
          <RateAdequacyTable data={data.rateAdequacy} />
        </div>
      </StepSection>
    </div>
  );
}
