"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
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
import { AEBySegmentChart } from "@/components/charts/ae-by-segment";
import { AEHeatmap } from "@/components/charts/ae-heatmap";
import { YoYComparisonChart } from "@/components/charts/yoy-comparison";
import { RateAdequacyTable } from "@/components/charts/rate-adequacy-table";
import { LoadingSpinner } from "@/components/loading";

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

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function DashboardPage() {
  const [segment, setSegment] = useState("all");
  const [destinationType, setDestinationType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTab, setActiveTab] = useState("summary");

  const [summaryData, setSummaryData] = useState<any>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [claimsData, setClaimsData] = useState<any>(null);
  const [detailsData, setDetailsData] = useState<any>(null);
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

  // Fetch active tab data when filters change
  useEffect(() => {
    fetchTab(activeTab);
  }, [activeTab, fetchTab]);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl font-bold tracking-tight">
              Travel Insurance Portfolio
            </h1>
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
            <TabsTrigger value="summary">Executive Summary</TabsTrigger>
            <TabsTrigger value="exposure">Exposure Map</TabsTrigger>
            <TabsTrigger value="claims">Claims & Losses</TabsTrigger>
            <TabsTrigger value="details">Flight & Hotel Detail</TabsTrigger>
            <TabsTrigger value="dislocation">Dislocation Analysis</TabsTrigger>
          </TabsList>

          {/* Tab 1: Executive Summary */}
          <TabsContent value="summary">
            {loading.summary ? (
              <LoadingSpinner />
            ) : summaryData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  <KpiCard
                    title="Reported Frequency"
                    value={pct(summaryData.kpis.claimRate)}
                  />
                </div>
                {summaryData.monthlyPL && summaryData.monthlyPL.length > 0 && (
                  <MonthlyPLChart data={summaryData.monthlyPL} />
                )}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <PremiumBySegmentChart data={summaryData.premiumBySegment} />
                  <BookingsByMonthChart data={summaryData.bookingsByMonth} />
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-1">
                    <CoverageDonutChart data={summaryData.coverageSplit} />
                  </div>
                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Premium Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Segment</TableHead>
                            <TableHead className="text-right">Hotel Premium</TableHead>
                            <TableHead className="text-right">Flight Premium</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summaryData.premiumBySegment.map((r: any) => (
                            <TableRow key={r.segment}>
                              <TableCell className="font-medium">
                                {r.segment.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
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
            ) : null}
          </TabsContent>

          {/* Tab 2: Exposure Map */}
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

                {/* Top destinations table */}
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

          {/* Tab 3: Claims & Losses */}
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

          {/* Tab 4: Flight & Hotel Detail */}
          <TabsContent value="details">
            {loading.details ? (
              <LoadingSpinner />
            ) : detailsData ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Hotel side */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Hotel — Top Destinations by Exposure</CardTitle>
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
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Flight — Top Routes</CardTitle>
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
            ) : null}
          </TabsContent>

          {/* Tab 5: Dislocation Analysis */}
          <TabsContent value="dislocation">
            {loading.dislocation ? (
              <LoadingSpinner />
            ) : dislocationData ? (
              <div className="space-y-6">
                {!dislocationData.kpis.has2026Data ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No 2026 data found. Run the 2026 generator to populate dislocated portfolio data.
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <KpiCard
                        title="Portfolio A/E"
                        value={dislocationData.kpis.portfolioAE.toFixed(2)}
                        subtitle="Actual / Expected loss"
                      />
                      <KpiCard
                        title="Worst Segment"
                        value={dislocationData.kpis.worstSegment}
                        subtitle={`A/E = ${dislocationData.kpis.worstSegmentAE.toFixed(2)}`}
                      />
                      <KpiCard
                        title="Worst Month"
                        value={dislocationData.kpis.worstMonth}
                        subtitle={`A/E = ${dislocationData.kpis.worstMonthAE.toFixed(2)}`}
                      />
                      <KpiCard
                        title="Model Accuracy"
                        value={`${dislocationData.kpis.modelAccuracy}%`}
                        subtitle="1/A/E as % (100% = perfect)"
                      />
                    </div>

                    <AEBySegmentChart data={dislocationData.aeBySegment} />

                    <AEHeatmap data={dislocationData.heatmap} />

                    <YoYComparisonChart data={dislocationData.yoy} />

                    <RateAdequacyTable data={dislocationData.rateAdequacy} />
                  </>
                )}
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
