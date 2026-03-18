"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  Plane,
  BarChart3,
  MapPin,
  AlertTriangle,
  TrendingUp,
  Users,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { KpiCard } from "@/components/kpi-card";
import { Filters } from "@/components/filters";
import { PremiumBySegmentChart } from "@/components/charts/premium-by-segment";
import { BookingsByMonthChart } from "@/components/charts/bookings-by-month";
import { CoverageDonutChart } from "@/components/charts/coverage-donut";
import { ClaimsBySubtypeChart } from "@/components/charts/claims-by-subtype";
import { ClaimsByMonthChart } from "@/components/charts/claims-by-month";
import { MonthlyPLChart } from "@/components/charts/monthly-pl";
import { CoefficientTable } from "@/components/pricing/coefficient-table";
import { CoefficientChart } from "@/components/pricing/coefficient-chart";
import { ScenarioCalculator } from "@/components/pricing/scenario-calculator";
import { DislocationTab } from "@/components/dislocation-tab";
import { LoadingSpinner } from "@/components/loading";
import {
  FREQ_COEFFICIENT_GROUPS,
  SEV_COEFFICIENT_GROUPS,
} from "@/lib/glm";

const ExposureMap = dynamic(
  () => import("@/components/map/exposure-map").then((m) => m.ExposureMap),
  { ssr: false, loading: () => <div className="h-[500px] flex items-center justify-center bg-muted rounded-lg">Loading map...</div> }
);

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function buildQuery(params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== "all") sp.set(k, v);
  }
  return sp.toString();
}

function segmentLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

const SEGMENT_DESCRIPTIONS: Record<string, string> = {
  winter_birds: "Snowbirds, avg age ~67, long hotel stays in FL/Gulf Coast",
  holiday_travelers: "Families, avg age ~42, Caribbean flights, holiday peaks",
  baseline: "Year-round travelers, uniform age 25-70, short hotel trips",
};

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [segment, setSegment] = useState("all");
  const [destinationType, setDestinationType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTab, setActiveTab] = useState("summary");

  const [summaryData, setSummaryData] = useState<any>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [claimsData, setClaimsData] = useState<any>(null);
  const [detailsData, setDetailsData] = useState<any>(null);
  const [pricingData, setPricingData] = useState<any>(null);
  const [dislocationData, setDislocationData] = useState<any>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [showRoutes, setShowRoutes] = useState(false);

  const filterParams = useMemo(
    () => ({
      segment,
      destination_type: destinationType,
      date_from: dateFrom,
      date_to: dateTo,
    }),
    [segment, destinationType, dateFrom, dateTo]
  );

  const fetchTab = useCallback(
    async (tab: string) => {
      const q = buildQuery(filterParams);
      setLoading((p) => ({ ...p, [tab]: true }));
      try {
        const res = await fetch(`/api/data?tab=${tab}&${q}`);
        const data = await res.json();
        const setters: Record<string, (d: any) => void> = {
          summary: setSummaryData,
          exposure: setGeoData,
          claims: setClaimsData,
          details: setDetailsData,
          pricing: setPricingData,
          dislocation: setDislocationData,
        };
        setters[tab](data);
      } catch (e) {
        console.error(`Failed to fetch ${tab}:`, e);
      } finally {
        setLoading((p) => ({ ...p, [tab]: false }));
      }
    },
    [filterParams]
  );

  // Skip SSR — dashboard is fully client-side (data fetched via API)
  useEffect(() => setMounted(true), []);

  // Fetch active tab data when filters change
  useEffect(() => {
    if (mounted) fetchTab(activeTab);
  }, [activeTab, fetchTab, mounted]);

  // State coefficient chart data
  const stateChartData = FREQ_COEFFICIENT_GROUPS
    .find((g) => g.category === "State")
    ?.coefficients.map((c) => ({ name: c.name, value: c.value }))
    .sort((a, b) => b.value - a.value) || [];

  const seasonalityChartData = FREQ_COEFFICIENT_GROUPS
    .find((g) => g.category === "Seasonality")
    ?.coefficients.map((c) => ({ name: c.name, value: c.value })) || [];

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Travel Insurance Portfolio
              </h1>
              <p className="text-sm text-muted-foreground">
                Analytics Platform
              </p>
            </div>
            <Filters
              segment={segment}
              setSegment={setSegment}
              destinationType={destinationType}
              setDestinationType={setDestinationType}
              dateFrom={dateFrom}
              setDateFrom={setDateFrom}
              dateTo={dateTo}
              setDateTo={setDateTo}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="summary" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Portfolio Overview
            </TabsTrigger>
            <TabsTrigger value="pricing" className="gap-1.5">
              <TrendingUp className="h-4 w-4" />
              Pricing Models
            </TabsTrigger>
            <TabsTrigger value="exposure" className="gap-1.5">
              <MapPin className="h-4 w-4" />
              Exposure Map
            </TabsTrigger>
            <TabsTrigger value="claims" className="gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Claims &amp; Losses
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-1.5">
              <Users className="h-4 w-4" />
              Flight &amp; Hotel Detail
            </TabsTrigger>
            <TabsTrigger value="dislocation" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Dislocation Analysis
            </TabsTrigger>
          </TabsList>

          {/* ────────────────────────────────────────────────────────── */}
          {/* Tab 1: Portfolio Overview (formerly Executive Summary)     */}
          {/* ────────────────────────────────────────────────────────── */}
          <TabsContent value="summary">
            {loading.summary ? (
              <LoadingSpinner />
            ) : summaryData ? (
              <div className="space-y-8">
                {/* Section 1: The Business */}
                <div>
                  <h2 className="text-lg font-semibold mb-1">The Business</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    A travel insurance portfolio covering hotel stays and flights
                    across US Atlantic, Gulf Coast, and Caribbean destinations.
                    Three customer segments with distinct risk profiles and
                    seasonal patterns.
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <KpiCard
                      title="Total Bookings"
                      value={summaryData.kpis.totalBookings.toLocaleString()}
                    />
                    <KpiCard
                      title="Total Policies"
                      value={summaryData.kpis.totalPolicies.toLocaleString()}
                    />
                    <KpiCard
                      title="Total Pure Premium"
                      value={fmt(summaryData.kpis.totalPurePremium)}
                    />
                  </div>
                </div>

                {/* Section 2: Two Products */}
                <div>
                  <h2 className="text-lg font-semibold mb-4">Two Products</h2>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {/* Hotel Card */}
                    <Card className="border-l-4" style={{ borderLeftColor: "var(--product-hotel, #f59e0b)" }}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Building2 className="h-5 w-5" style={{ color: "var(--product-hotel, #f59e0b)" }} />
                          Hotel
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          <span className="text-muted-foreground">Policies</span>
                          <span className="text-right font-medium">{summaryData.products.hotel.policyCount.toLocaleString()}</span>
                          <span className="text-muted-foreground">Total Premium</span>
                          <span className="text-right font-medium">{fmt(summaryData.products.hotel.totalPremium)}</span>
                          <span className="text-muted-foreground">Avg Trip Cost</span>
                          <span className="text-right font-medium">{fmt(summaryData.products.hotel.avgTripCost)}</span>
                          <span className="text-muted-foreground">Frequency</span>
                          <span className="text-right font-medium">{pct(summaryData.products.hotel.frequency)}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Flight Card */}
                    <Card className="border-l-4" style={{ borderLeftColor: "var(--product-flight, #3b82f6)" }}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Plane className="h-5 w-5" style={{ color: "var(--product-flight, #3b82f6)" }} />
                          Flight
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          <span className="text-muted-foreground">Policies</span>
                          <span className="text-right font-medium">{summaryData.products.flight.policyCount.toLocaleString()}</span>
                          <span className="text-muted-foreground">Total Premium</span>
                          <span className="text-right font-medium">{fmt(summaryData.products.flight.totalPremium)}</span>
                          <span className="text-muted-foreground">Avg Trip Cost</span>
                          <span className="text-right font-medium">{fmt(summaryData.products.flight.avgTripCost)}</span>
                          <span className="text-muted-foreground">Frequency</span>
                          <span className="text-right font-medium">{pct(summaryData.products.flight.frequency)}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Coverage Split */}
                    <CoverageDonutChart data={summaryData.coverageSplit} />
                  </div>
                </div>

                {/* Section 3: Three Customer Segments */}
                <div>
                  <h2 className="text-lg font-semibold mb-4">Three Customer Segments</h2>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {summaryData.segmentProfiles.map((sp: any) => (
                      <Card key={sp.segment}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">
                            {segmentLabel(sp.segment)}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {sp.bookings.toLocaleString()} bookings &middot; {sp.policies.toLocaleString()} policies
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <span className="text-muted-foreground">Avg Age</span>
                            <span className="text-right font-medium">{sp.avgAge}</span>
                            <span className="text-muted-foreground">Top Destinations</span>
                            <span className="text-right font-medium text-xs">
                              {sp.topDestTypes.map((t: string) => t.replace(/_/g, " ")).join(", ")}
                            </span>
                            <span className="text-muted-foreground">Peak Months</span>
                            <span className="text-right font-medium text-xs">
                              {sp.peakMonths.join(", ")}
                            </span>
                            <span className="text-muted-foreground">Pure Premium</span>
                            <span className="text-right font-medium">{fmt(sp.purePremium)}</span>
                            <span className="text-muted-foreground">Frequency</span>
                            <span className="text-right font-medium">{pct(sp.frequency)}</span>
                          </div>
                          <div className="mt-3 flex gap-1">
                            {[
                              { label: "Hotel", pct: sp.coverageMix.hotel_only, color: "var(--product-hotel, #f59e0b)" },
                              { label: "Both", pct: sp.coverageMix.hotel_and_flight, color: "#8b5cf6" },
                              { label: "Flight", pct: sp.coverageMix.flight_only, color: "var(--product-flight, #3b82f6)" },
                            ].map((bar) => (
                              <div
                                key={bar.label}
                                className="h-2 rounded-full"
                                style={{
                                  width: `${bar.pct * 100}%`,
                                  backgroundColor: bar.color,
                                }}
                                title={`${bar.label}: ${(bar.pct * 100).toFixed(0)}%`}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                            <span>Hotel {(sp.coverageMix.hotel_only * 100).toFixed(0)}%</span>
                            <span>Both {(sp.coverageMix.hotel_and_flight * 100).toFixed(0)}%</span>
                            <span>Flight {(sp.coverageMix.flight_only * 100).toFixed(0)}%</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="mt-6">
                    <BookingsByMonthChart data={summaryData.bookingsByMonth} />
                  </div>
                </div>

                {/* Section 4: Portfolio Performance */}
                <div>
                  <h2 className="text-lg font-semibold mb-4">Portfolio Performance</h2>
                  {summaryData.monthlyPL && summaryData.monthlyPL.length > 0 && (
                    <MonthlyPLChart data={summaryData.monthlyPL} />
                  )}
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-6">
                    <PremiumBySegmentChart data={summaryData.premiumBySegment} />
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Premium Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Segment</TableHead>
                              <TableHead className="text-right">
                                <span className="inline-flex items-center gap-1">
                                  <Building2 className="h-3 w-3" style={{ color: "var(--product-hotel, #f59e0b)" }} />
                                  Hotel
                                </span>
                              </TableHead>
                              <TableHead className="text-right">
                                <span className="inline-flex items-center gap-1">
                                  <Plane className="h-3 w-3" style={{ color: "var(--product-flight, #3b82f6)" }} />
                                  Flight
                                </span>
                              </TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {summaryData.premiumBySegment.map((r: any) => (
                              <TableRow key={r.segment}>
                                <TableCell className="font-medium">
                                  {segmentLabel(r.segment)}
                                </TableCell>
                                <TableCell className="text-right">{fmt(r.hotel)}</TableCell>
                                <TableCell className="text-right">{fmt(r.flight)}</TableCell>
                                <TableCell className="text-right font-semibold">
                                  {fmt(r.hotel + r.flight)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            ) : null}
          </TabsContent>

          {/* ────────────────────────────────────────────────────────── */}
          {/* Tab 2: Pricing Models (NEW)                               */}
          {/* ────────────────────────────────────────────────────────── */}
          <TabsContent value="pricing">
            {loading.pricing ? (
              <LoadingSpinner />
            ) : (
              <div className="space-y-8">
                {/* How We Price */}
                <div>
                  <h2 className="text-lg font-semibold mb-1">How We Price</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Two GLM models drive pricing.{" "}
                    <strong>Frequency</strong> (Poisson, log-link) predicts how often claims occur.{" "}
                    <strong>Severity</strong> (Gamma, log-link) predicts how large claims are.{" "}
                    Pure premium = frequency &times; expected severity.
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <KpiCard
                      title="Base Frequency"
                      value={`${(Math.exp(-4.5) * 100).toFixed(2)}%`}
                      subtitle="exp(-4.5) intercept"
                    />
                    <KpiCard
                      title="Base Severity"
                      value={`$${Math.round(Math.exp(5.5))}`}
                      subtitle="exp(5.5) intercept"
                    />
                    {pricingData?.portfolioStats && (
                      <>
                        <KpiCard
                          title="Actual Avg Frequency"
                          value={pct(pricingData.portfolioStats.avgFrequency)}
                          subtitle="Observed in portfolio"
                        />
                        <KpiCard
                          title="Actual Avg Severity"
                          value={fmt(pricingData.portfolioStats.avgSeverity)}
                          subtitle="Observed in portfolio"
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* Frequency Model */}
                <div>
                  <h2 className="text-lg font-semibold mb-4">Frequency Model</h2>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <CoefficientTable
                      title="Frequency GLM Coefficients"
                      groups={FREQ_COEFFICIENT_GROUPS}
                      modelDescription="Poisson GLM with log link — coefficients on log-frequency scale"
                    />
                    <div className="space-y-6">
                      <CoefficientChart
                        title="State Effects on Frequency"
                        data={stateChartData}
                        referenceLabel="vs Pennsylvania (reference state, coeff = 0)"
                      />
                      <CoefficientChart
                        title="Seasonal Effects on Frequency"
                        data={seasonalityChartData}
                        referenceLabel="vs Dec-May (reference months, coeff = 0). Hurricane season drives higher frequency."
                      />
                    </div>
                  </div>
                </div>

                {/* Severity Model */}
                <div>
                  <h2 className="text-lg font-semibold mb-1">Severity Model</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Fewer factors than frequency — severity is primarily driven by trip cost and claim timing.
                  </p>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <CoefficientTable
                      title="Severity GLM Coefficients"
                      groups={SEV_COEFFICIENT_GROUPS}
                      modelDescription="Gamma GLM with log link — coefficients on log-severity scale"
                    />
                    {pricingData?.portfolioStats && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Severity by Product</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-5 w-5" style={{ color: "var(--product-hotel, #f59e0b)" }} />
                                <div>
                                  <p className="text-sm font-medium">Hotel</p>
                                  <p className="text-xs text-muted-foreground">
                                    Frequency: {pct(pricingData.portfolioStats.hotelFrequency)}
                                  </p>
                                </div>
                              </div>
                              <p className="text-lg font-bold">{fmt(pricingData.portfolioStats.hotelAvgSeverity)}</p>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2">
                                <Plane className="h-5 w-5" style={{ color: "var(--product-flight, #3b82f6)" }} />
                                <div>
                                  <p className="text-sm font-medium">Flight</p>
                                  <p className="text-xs text-muted-foreground">
                                    Frequency: {pct(pricingData.portfolioStats.flightFrequency)}
                                  </p>
                                </div>
                              </div>
                              <p className="text-lg font-bold">{fmt(pricingData.portfolioStats.flightAvgSeverity)}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Hotel has higher severity (longer stays, higher trip costs) but flight has a +0.25 frequency uplift and -0.20 severity offset.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>

                {/* Actual portfolio experience by segment */}
                {pricingData?.segmentScenarios && (
                  <ScenarioCalculator
                    scenarios={pricingData.segmentScenarios.map((s: any) => ({
                      label: segmentLabel(s.segment),
                      description: SEGMENT_DESCRIPTIONS[s.segment] || `Avg age ${s.avgAge}, avg trip cost ${fmt(s.avgTripCost)}`,
                      frequency: s.frequency,
                      severity: s.avgSeverity,
                      purePremium: s.avgPurePremium,
                    }))}
                  />
                )}
              </div>
            )}
          </TabsContent>

          {/* ────────────────────────────────────────────────────────── */}
          {/* Tab 3: Exposure Map                                       */}
          {/* ────────────────────────────────────────────────────────── */}
          <TabsContent value="exposure">
            {loading.exposure ? (
              <LoadingSpinner />
            ) : geoData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <KpiCard
                    title="Destinations"
                    value={geoData.markers.length}
                  />
                  <KpiCard
                    title="Policies in Range"
                    value={geoData.totalPoliciesInRange.toLocaleString()}
                  />
                  <KpiCard
                    title="Total Exposure"
                    value={fmt(geoData.totalExposure)}
                  />
                </div>

                <div className="flex items-center gap-4 mb-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showRoutes}
                      onChange={(e) => setShowRoutes(e.target.checked)}
                      className="rounded"
                    />
                    Show Flight Routes
                  </label>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> US Atlantic
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded-full bg-teal-500" /> Gulf Coast
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded-full bg-orange-500" /> Caribbean
                    </span>
                  </div>
                </div>

                <ExposureMap
                  markers={geoData.markers}
                  routes={geoData.routes}
                  showRoutes={showRoutes}
                />

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Top 15 Destinations by Exposure</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Policies</TableHead>
                          <TableHead className="text-right">Trip Cost</TableHead>
                          <TableHead className="text-right">Pure Premium</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {geoData.topDestinations.map((d: any, i: number) => (
                          <TableRow key={d.id}>
                            <TableCell>{i + 1}</TableCell>
                            <TableCell className="font-medium">{d.city}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {d.destinationType.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{d.policyCount.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{fmt(d.tripCostExposure)}</TableCell>
                            <TableCell className="text-right">{fmt(d.totalPremium)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          {/* ────────────────────────────────────────────────────────── */}
          {/* Tab 4: Claims & Losses                                    */}
          {/* ────────────────────────────────────────────────────────── */}
          <TabsContent value="claims">
            {loading.claims ? (
              <LoadingSpinner />
            ) : claimsData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiCard
                    title="Total Incurred"
                    value={fmt(claimsData.kpis.totalIncurred)}
                  />
                  <KpiCard
                    title="Average Severity"
                    value={fmt(claimsData.kpis.avgSeverity)}
                  />
                  <KpiCard
                    title="Pre-Departure Claims"
                    value={claimsData.kpis.preDeparture.toLocaleString()}
                    subtitle={`${pct(claimsData.kpis.preDeparture / claimsData.kpis.totalClaims)} of total`}
                  />
                  <KpiCard
                    title="Post-Departure Claims"
                    value={claimsData.kpis.postDeparture.toLocaleString()}
                    subtitle={`${pct(claimsData.kpis.postDeparture / claimsData.kpis.totalClaims)} of total`}
                  />
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <ClaimsBySubtypeChart data={claimsData.bySubtype} />
                  <ClaimsByMonthChart data={claimsData.claimsByMonth} />
                </div>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Loss Ratio by State of Residence</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>State</TableHead>
                            <TableHead className="text-right">Premium</TableHead>
                            <TableHead className="text-right">Incurred</TableHead>
                            <TableHead className="text-right">Loss Ratio</TableHead>
                            <TableHead className="text-right">Claims</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {claimsData.lossRatioByState.map((r: any) => (
                            <TableRow key={r.state}>
                              <TableCell className="font-medium">{r.state}</TableCell>
                              <TableCell className="text-right">{fmt(r.premium)}</TableCell>
                              <TableCell className="text-right">{fmt(r.incurred)}</TableCell>
                              <TableCell className="text-right">
                                <span
                                  className={
                                    r.lossRatio > 1
                                      ? "text-red-600 font-semibold"
                                      : r.lossRatio > 0.7
                                      ? "text-amber-600"
                                      : "text-green-600"
                                  }
                                >
                                  {pct(r.lossRatio)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">{r.claims}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          {/* ────────────────────────────────────────────────────────── */}
          {/* Tab 5: Flight & Hotel Detail                              */}
          {/* ────────────────────────────────────────────────────────── */}
          <TabsContent value="details">
            {loading.details ? (
              <LoadingSpinner />
            ) : detailsData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Hotel side */}
                  <Card className="border-t-4" style={{ borderTopColor: "var(--product-hotel, #f59e0b)" }}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-5 w-5" style={{ color: "var(--product-hotel, #f59e0b)" }} />
                        Hotel — Top Destinations by Exposure
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Destination</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Avg $/Night</TableHead>
                            <TableHead className="text-right">Exposure</TableHead>
                            <TableHead className="text-right">Policies</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailsData.hotel.byDestination.map((r: any) => (
                            <TableRow key={r.destination}>
                              <TableCell className="font-medium">{r.destination}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {r.destinationType.replace(/_/g, " ")}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">${r.avgPricePerNight}</TableCell>
                              <TableCell className="text-right">{fmt(r.totalExposure)}</TableCell>
                              <TableCell className="text-right">{r.policyCount.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Flight side */}
                  <div className="space-y-6">
                    <Card className="border-t-4" style={{ borderTopColor: "var(--product-flight, #3b82f6)" }}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Plane className="h-5 w-5" style={{ color: "var(--product-flight, #3b82f6)" }} />
                          Flight — Top Routes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Route</TableHead>
                              <TableHead className="text-right">Policies</TableHead>
                              <TableHead className="text-right">Avg Ticket</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detailsData.flight.topRoutes.map((r: any) => (
                              <TableRow key={r.route}>
                                <TableCell className="font-medium font-mono text-sm">{r.route}</TableCell>
                                <TableCell className="text-right">{r.count.toLocaleString()}</TableCell>
                                <TableCell className="text-right">${r.avgPrice}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Avg Ticket Price by Destination Type</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">Avg Price</TableHead>
                              <TableHead className="text-right">Policies</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detailsData.flight.byDestType.map((r: any) => (
                              <TableRow key={r.type}>
                                <TableCell className="font-medium">{r.type}</TableCell>
                                <TableCell className="text-right">${r.avgPrice}</TableCell>
                                <TableCell className="text-right">{r.count.toLocaleString()}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            ) : null}
          </TabsContent>

          {/* ────────────────────────────────────────────────────────── */}
          {/* Tab 6: Dislocation Analysis                               */}
          {/* ────────────────────────────────────────────────────────── */}
          <TabsContent value="dislocation">
            {loading.dislocation ? (
              <LoadingSpinner />
            ) : dislocationData ? (
              <DislocationTab
                data={dislocationData}
                onNavigateToMap={(destType) => {
                  setDestinationType(destType);
                  setActiveTab("exposure");
                }}
              />
            ) : null}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
