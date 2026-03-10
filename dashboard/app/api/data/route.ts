import { getData, filterBookings, getPoliciesForBookings, getClaimsForPolicies, parseFilters } from "@/lib/cache";
import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

/* eslint-disable @typescript-eslint/no-explicit-any */

function buildSummary(data: any, bookings: any[], policies: any[], claims: any[]) {
  const totalPurePremium = bookings.reduce((s: number, b: any) => s + b.pure_premium, 0);
  const claimRate = policies.length > 0 ? claims.length / policies.length : 0;

  const premiumBySegment: Record<string, { hotel: number; flight: number }> = {};
  for (const b of bookings) {
    if (!premiumBySegment[b.segment]) premiumBySegment[b.segment] = { hotel: 0, flight: 0 };
    if (b.coverage_type === "hotel_only") premiumBySegment[b.segment].hotel += b.pure_premium;
    else if (b.coverage_type === "flight_only") premiumBySegment[b.segment].flight += b.pure_premium;
    else { premiumBySegment[b.segment].hotel += b.pure_premium * 0.6; premiumBySegment[b.segment].flight += b.pure_premium * 0.4; }
  }

  const bookingsByMonth: Record<string, Record<string, number>> = {};
  for (const b of bookings) {
    const month = b.departure_date.substring(0, 7);
    if (!bookingsByMonth[month]) bookingsByMonth[month] = {};
    bookingsByMonth[month][b.segment] = (bookingsByMonth[month][b.segment] || 0) + 1;
  }

  const coverageSplit: Record<string, number> = {};
  for (const b of bookings) coverageSplit[b.coverage_type] = (coverageSplit[b.coverage_type] || 0) + 1;

  // Monthly P&L
  const policyBookingMonth = new Map<number, string>();
  for (const b of bookings) {
    const month = b.departure_date.substring(0, 7);
    const pols = data.policyByBookingId.get(b.id);
    if (pols) for (const p of pols) policyBookingMonth.set(p.id, month);
  }
  const monthlyPL: Record<string, { premium: number; incurred: number }> = {};
  for (const b of bookings) {
    const month = b.departure_date.substring(0, 7);
    if (!monthlyPL[month]) monthlyPL[month] = { premium: 0, incurred: 0 };
    monthlyPL[month].premium += b.pure_premium;
  }
  for (const c of claims) {
    const month = policyBookingMonth.get(c.policy_id);
    if (month) {
      if (!monthlyPL[month]) monthlyPL[month] = { premium: 0, incurred: 0 };
      monthlyPL[month].incurred += c.claim_amount;
    }
  }

  return {
    kpis: { totalBookings: bookings.length, totalPolicies: policies.length, totalPurePremium, claimRate },
    premiumBySegment: Object.entries(premiumBySegment).map(([segment, vals]) => ({ segment, hotel: Math.round(vals.hotel), flight: Math.round(vals.flight) })),
    bookingsByMonth: Object.entries(bookingsByMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, segs]) => ({ month, winter_birds: segs.winter_birds || 0, holiday_travelers: segs.holiday_travelers || 0, baseline: segs.baseline || 0 })),
    coverageSplit: Object.entries(coverageSplit).map(([type, count]) => ({ name: type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), value: count })),
    monthlyPL: Object.entries(monthlyPL).sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({ month, premium: Math.round(d.premium), incurred: Math.round(d.incurred), lossRatio: d.premium > 0 ? +(d.incurred / d.premium).toFixed(4) : 0 })),
  };
}

function buildGeographic(data: any, bookings: any[], policies: any[]) {
  const destAgg: Record<number, { totalPremium: number; bookingCount: number }> = {};
  for (const b of bookings) {
    if (!destAgg[b.destination_id]) destAgg[b.destination_id] = { totalPremium: 0, bookingCount: 0 };
    destAgg[b.destination_id].totalPremium += b.pure_premium;
    destAgg[b.destination_id].bookingCount += 1;
  }

  const bookingDestMap = new Map(bookings.map((b: any) => [b.id, b.destination_id]));
  const policyAgg: Record<number, { tripCost: number; policyCount: number }> = {};
  const routeAgg: Record<string, { count: number; origin: string; dest: string; destLat?: number; destLon?: number }> = {};

  for (const p of policies) {
    const destId = bookingDestMap.get(p.booking_id);
    if (destId !== undefined) {
      if (!policyAgg[destId]) policyAgg[destId] = { tripCost: 0, policyCount: 0 };
      policyAgg[destId].tripCost += p.trip_cost;
      policyAgg[destId].policyCount += 1;
    }
    if (p.product_id === 2 && p.origin_airport && p.destination_airport) {
      const key = `${p.origin_airport}-${p.destination_airport}`;
      if (!routeAgg[key]) {
        const dest = data.destinations.find((d: any) => d.airport_code === p.destination_airport);
        routeAgg[key] = { count: 0, origin: p.origin_airport, dest: p.destination_airport, destLat: dest?.latitude, destLon: dest?.longitude };
      }
      routeAgg[key].count += 1;
    }
  }

  const markers = data.destinations.map((d: any) => {
    const agg = destAgg[d.id]; const polAgg = policyAgg[d.id];
    return { id: d.id, city: d.city, stateOrCountry: d.state_or_country, lat: d.latitude, lon: d.longitude, airportCode: d.airport_code, destinationType: d.destination_type, totalPremium: agg?.totalPremium || 0, bookingCount: agg?.bookingCount || 0, policyCount: polAgg?.policyCount || 0, tripCostExposure: polAgg?.tripCost || 0, claimCount: 0 };
  }).filter((m: any) => m.bookingCount > 0);

  return {
    markers,
    routes: Object.values(routeAgg).filter(r => r.count > 5),
    topDestinations: [...markers].sort((a: any, b: any) => b.totalPremium - a.totalPremium).slice(0, 15),
    totalExposure: markers.reduce((sum: number, m: any) => sum + m.totalPremium, 0),
    totalPoliciesInRange: markers.reduce((sum: number, m: any) => sum + m.policyCount, 0),
  };
}

function buildClaims(bookings: any[], policies: any[], claims: any[]) {
  const totalIncurred = claims.reduce((s: number, c: any) => s + c.claim_amount, 0);
  const avgSeverity = claims.length > 0 ? totalIncurred / claims.length : 0;
  const preDeparture = claims.filter((c: any) => c.claim_type === "pre_departure").length;
  const postDeparture = claims.filter((c: any) => c.claim_type === "post_departure").length;

  const bySubtype: Record<string, { count: number; amount: number }> = {};
  for (const c of claims) {
    if (!bySubtype[c.claim_subtype]) bySubtype[c.claim_subtype] = { count: 0, amount: 0 };
    bySubtype[c.claim_subtype].count += 1;
    bySubtype[c.claim_subtype].amount += c.claim_amount;
  }

  const policyToBooking = new Map(policies.map((p: any) => [p.id, p.booking_id]));
  const bookingMap = new Map(bookings.map((b: any) => [b.id, b]));
  const stateData: Record<string, { premium: number; incurred: number; claims: number }> = {};
  for (const b of bookings) {
    if (!stateData[b.state_of_residence]) stateData[b.state_of_residence] = { premium: 0, incurred: 0, claims: 0 };
    stateData[b.state_of_residence].premium += b.pure_premium;
  }
  for (const c of claims) {
    const bookingId = policyToBooking.get(c.policy_id);
    if (bookingId === undefined) continue;
    const bk = bookingMap.get(bookingId);
    if (bk) {
      if (!stateData[bk.state_of_residence]) stateData[bk.state_of_residence] = { premium: 0, incurred: 0, claims: 0 };
      stateData[bk.state_of_residence].incurred += c.claim_amount;
      stateData[bk.state_of_residence].claims += 1;
    }
  }

  const claimsByMonth: Record<string, number> = {};
  for (const c of claims) { const month = c.claim_date.substring(0, 7); claimsByMonth[month] = (claimsByMonth[month] || 0) + 1; }

  return {
    kpis: { totalIncurred, avgSeverity, preDeparture, postDeparture, totalClaims: claims.length },
    bySubtype: Object.entries(bySubtype).map(([subtype, d]) => ({ subtype: subtype.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), count: d.count, amount: Math.round(d.amount) })),
    lossRatioByState: Object.entries(stateData).map(([state, d]) => ({ state, premium: Math.round(d.premium), incurred: Math.round(d.incurred), lossRatio: d.premium > 0 ? d.incurred / d.premium : 0, claims: d.claims })).sort((a, b) => b.lossRatio - a.lossRatio),
    claimsByMonth: Object.entries(claimsByMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
  };
}

function buildDetails(data: any, bookings: any[], policies: any[]) {
  const bookingDestMap = new Map(bookings.map((b: any) => [b.id, b.destination_id]));

  const hotelByDest: Record<number, { totalPrice: number; count: number; totalTripCost: number }> = {};
  const routeAgg: Record<string, { count: number; totalPrice: number; origin: string; dest: string }> = {};
  const flightByDestType: Record<string, { totalPrice: number; count: number }> = {};

  for (const p of policies) {
    const destId = bookingDestMap.get(p.booking_id);
    if (p.product_id === 1 && destId !== undefined) {
      if (!hotelByDest[destId]) hotelByDest[destId] = { totalPrice: 0, count: 0, totalTripCost: 0 };
      hotelByDest[destId].totalPrice += p.price_per_night || 0;
      hotelByDest[destId].count += 1;
      hotelByDest[destId].totalTripCost += p.trip_cost;
    }
    if (p.product_id === 2) {
      if (p.origin_airport && p.destination_airport) {
        const key = `${p.origin_airport}→${p.destination_airport}`;
        if (!routeAgg[key]) routeAgg[key] = { count: 0, totalPrice: 0, origin: p.origin_airport, dest: p.destination_airport };
        routeAgg[key].count += 1;
        routeAgg[key].totalPrice += p.flight_price || 0;
      }
      if (destId !== undefined) {
        const dest = data.destinationById.get(destId);
        const dtype = dest?.destination_type || "unknown";
        if (!flightByDestType[dtype]) flightByDestType[dtype] = { totalPrice: 0, count: 0 };
        flightByDestType[dtype].totalPrice += p.flight_price || 0;
        flightByDestType[dtype].count += 1;
      }
    }
  }

  return {
    hotel: {
      byDestination: Object.entries(hotelByDest).map(([destId, d]) => {
        const dest = data.destinationById.get(Number(destId));
        return { destination: dest?.city || "Unknown", destinationType: dest?.destination_type || "", avgPricePerNight: Math.round(d.totalPrice / d.count), totalExposure: Math.round(d.totalTripCost), policyCount: d.count };
      }).sort((a, b) => b.totalExposure - a.totalExposure).slice(0, 20),
    },
    flight: {
      topRoutes: Object.values(routeAgg).sort((a, b) => b.count - a.count).slice(0, 20).map(r => ({ route: `${r.origin} → ${r.dest}`, count: r.count, avgPrice: Math.round(r.totalPrice / r.count) })),
      byDestType: Object.entries(flightByDestType).map(([type, d]) => ({ type: type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), avgPrice: Math.round(d.totalPrice / d.count), count: d.count })),
    },
  };
}

async function buildDislocation() {
  // Read pre-computed results from dislocation_analysis table (computed by Python)
  const { data: rows, error } = await supabase
    .from("dislocation_analysis")
    .select("analysis_type, dimension, dimension_type, month, metrics");

  if (error || !rows || rows.length === 0) {
    return { kpis: { has2026Data: false, portfolioAE: 0, worstSegment: "N/A", worstSegmentAE: 0, worstMonth: "N/A", worstMonthAE: 0, modelAccuracy: 0 }, aeBySegment: [], aeByDestType: [], heatmap: [], yoy: [], rateAdequacy: [] };
  }

  // Parse rows by type
  const overall = rows.find((r: any) => r.analysis_type === "overall")?.metrics || {};
  const dimRows = rows.filter((r: any) => r.analysis_type === "ae_by_dimension");
  const heatmapRows = rows.filter((r: any) => r.analysis_type === "heatmap");

  const segmentRows = dimRows.filter((r: any) => r.dimension_type === "segment");
  const destRows = dimRows.filter((r: any) => r.dimension_type === "destination_type");

  // A/E by segment
  const aeBySegment = segmentRows.map((r: any) => {
    const m = r.metrics;
    return {
      segment: m.dimension,
      ae: m.ae_ratio,
      freqAE: m.freq_ae,
      expected: Math.round(m.loss_per_policy_2025 * m.policies_2026),
      actual: Math.round(m.total_loss_2026),
      reportedFrequency: m.frequency_2026,
      avgSeverity: Math.round(m.avg_severity_2026),
      policyCount: m.policies_2026,
      claimCount: m.claims_2026,
    };
  });

  // A/E by destination type
  const aeByDestType = destRows.map((r: any) => {
    const m = r.metrics;
    return {
      destinationType: m.dimension,
      ae: m.ae_ratio,
      freqAE: m.freq_ae,
      expected: Math.round(m.loss_per_policy_2025 * m.policies_2026),
      actual: Math.round(m.total_loss_2026),
    };
  });

  // Heatmap
  const heatmap = heatmapRows.map((r: any) => {
    const m = r.metrics;
    return {
      segment: m.segment,
      month: m.month,
      ae: m.ae_ratio,
      freqAE: m.freq_ae,
      expected: Math.round(m.total_loss / (m.ae_ratio || 1)),
      actual: Math.round(m.total_loss),
      claims: m.claims,
      policies: m.policies,
    };
  });

  // YoY from segment data
  const yoy = segmentRows.map((r: any) => {
    const m = r.metrics;
    return {
      segment: m.dimension,
      freq2025: m.frequency_2025,
      freq2026: m.frequency_2026,
      sev2025: Math.round(m.avg_severity_2025),
      sev2026: Math.round(m.avg_severity_2026),
    };
  });

  // Rate adequacy table
  const rateAdequacy = [...segmentRows, ...destRows].map((r: any) => {
    const m = r.metrics;
    const ae = m.ae_ratio;
    return {
      dimension: m.dimension.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
      dimensionType: r.dimension_type === "segment" ? "segment" : "destination",
      expected: Math.round(m.loss_per_policy_2025 * m.policies_2026),
      actual: Math.round(m.total_loss_2026),
      ae,
      adequacy: ae <= 1.05 ? "adequate" : ae <= 1.20 ? "watch" : "inadequate",
      recommendedChange: ae > 1.0 ? +((ae - 1) * 100).toFixed(1) : 0,
    };
  });

  // Find worst segment and month
  const worstSegment = aeBySegment.length > 0
    ? aeBySegment.reduce((a: any, b: any) => a.ae > b.ae ? a : b)
    : { segment: "N/A", ae: 0 };

  const monthAEs: Record<number, { expected: number; actual: number }> = {};
  for (const cell of heatmap) {
    if (!monthAEs[cell.month]) monthAEs[cell.month] = { expected: 0, actual: 0 };
    monthAEs[cell.month].expected += cell.expected;
    monthAEs[cell.month].actual += cell.actual;
  }
  let worstMonth = { month: 0, ae: 0 };
  for (const [m, v] of Object.entries(monthAEs)) {
    const ae = v.expected > 0 ? v.actual / v.expected : 0;
    if (ae > worstMonth.ae) worstMonth = { month: Number(m), ae };
  }

  const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return {
    kpis: {
      portfolioAE: overall.ae_ratio || 0,
      worstSegment: (worstSegment.segment || "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
      worstSegmentAE: worstSegment.ae || 0,
      worstMonth: monthNames[worstMonth.month] || "N/A",
      worstMonthAE: +worstMonth.ae.toFixed(2),
      modelAccuracy: overall.ae_ratio > 0 ? +((1 / overall.ae_ratio) * 100).toFixed(1) : 100,
      has2026Data: true,
    },
    aeBySegment,
    aeByDestType,
    heatmap,
    yoy,
    rateAdequacy,
  };
}

export async function GET(req: NextRequest) {
  const tab = req.nextUrl.searchParams.get("tab") || "summary";
  const data = await getData();
  const filters = parseFilters(req.nextUrl.searchParams);
  const bookings = filterBookings(data, filters);
  const policies = getPoliciesForBookings(data, bookings);
  const claims = getClaimsForPolicies(data, policies);

  let result;
  switch (tab) {
    case "summary": result = buildSummary(data, bookings, policies, claims); break;
    case "exposure": result = buildGeographic(data, bookings, policies); break;
    case "claims": result = buildClaims(bookings, policies, claims); break;
    case "details": result = buildDetails(data, bookings, policies); break;
    case "dislocation": result = await buildDislocation(); break;
    default: result = buildSummary(data, bookings, policies, claims);
  }

  return NextResponse.json(result);
}
