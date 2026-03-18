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

  // Product-level breakdown
  const productAgg: Record<number, { policyCount: number; totalPremium: number; totalTripCost: number; claimCount: number }> = {};
  for (const p of policies) {
    if (!productAgg[p.product_id]) productAgg[p.product_id] = { policyCount: 0, totalPremium: 0, totalTripCost: 0, claimCount: 0 };
    productAgg[p.product_id].policyCount += 1;
    productAgg[p.product_id].totalTripCost += p.trip_cost;
  }
  for (const b of bookings) {
    // Attribute pure_premium to products based on coverage
    if (b.coverage_type === "hotel_only") {
      if (!productAgg[1]) productAgg[1] = { policyCount: 0, totalPremium: 0, totalTripCost: 0, claimCount: 0 };
      productAgg[1].totalPremium += b.pure_premium;
    } else if (b.coverage_type === "flight_only") {
      if (!productAgg[2]) productAgg[2] = { policyCount: 0, totalPremium: 0, totalTripCost: 0, claimCount: 0 };
      productAgg[2].totalPremium += b.pure_premium;
    } else {
      if (!productAgg[1]) productAgg[1] = { policyCount: 0, totalPremium: 0, totalTripCost: 0, claimCount: 0 };
      if (!productAgg[2]) productAgg[2] = { policyCount: 0, totalPremium: 0, totalTripCost: 0, claimCount: 0 };
      productAgg[1].totalPremium += b.pure_premium * 0.6;
      productAgg[2].totalPremium += b.pure_premium * 0.4;
    }
  }
  // Count claims per product
  const policyProductMap = new Map(policies.map((p: any) => [p.id, p.product_id]));
  for (const c of claims) {
    const prodId = policyProductMap.get(c.policy_id);
    if (prodId !== undefined && productAgg[prodId]) {
      productAgg[prodId].claimCount += 1;
    }
  }
  const makeProduct = (id: number) => {
    const agg = productAgg[id] || { policyCount: 0, totalPremium: 0, totalTripCost: 0, claimCount: 0 };
    return {
      policyCount: agg.policyCount,
      totalPremium: Math.round(agg.totalPremium),
      avgTripCost: agg.policyCount > 0 ? Math.round(agg.totalTripCost / agg.policyCount) : 0,
      frequency: agg.policyCount > 0 ? agg.claimCount / agg.policyCount : 0,
    };
  };
  const products = { hotel: makeProduct(1), flight: makeProduct(2) };

  // Segment profiles
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const segmentBookings: Record<string, any[]> = {};
  for (const b of bookings) {
    if (!segmentBookings[b.segment]) segmentBookings[b.segment] = [];
    segmentBookings[b.segment].push(b);
  }

  const segmentProfiles = Object.entries(segmentBookings).map(([segment, segBookings]) => {
    const avgAge = segBookings.reduce((s: number, b: any) => s + (b.age || 0), 0) / segBookings.length;

    // Top destination types
    const destTypeCounts: Record<string, number> = {};
    for (const b of segBookings) {
      const dest = data.destinationById.get(b.destination_id);
      const dtype = dest?.destination_type || "unknown";
      destTypeCounts[dtype] = (destTypeCounts[dtype] || 0) + 1;
    }
    const topDestTypes = Object.entries(destTypeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([t]) => t);

    // Peak months
    const monthCounts: Record<number, number> = {};
    for (const b of segBookings) {
      const m = new Date(b.departure_date).getMonth();
      monthCounts[m] = (monthCounts[m] || 0) + 1;
    }
    const peakMonths = Object.entries(monthCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([m]) => monthNames[Number(m)]);

    // Coverage mix
    const coverageCounts: Record<string, number> = { hotel_only: 0, flight_only: 0, hotel_and_flight: 0 };
    for (const b of segBookings) {
      if (coverageCounts[b.coverage_type] !== undefined) coverageCounts[b.coverage_type] += 1;
    }
    const total = segBookings.length;
    const coverageMix = {
      hotel_only: total > 0 ? coverageCounts.hotel_only / total : 0,
      flight_only: total > 0 ? coverageCounts.flight_only / total : 0,
      hotel_and_flight: total > 0 ? coverageCounts.hotel_and_flight / total : 0,
    };

    // Pure premium
    const purePremium = segBookings.reduce((s: number, b: any) => s + b.pure_premium, 0);

    // Frequency: get policies for segment's bookings, then claims for those policies
    const segBookingIds = new Set(segBookings.map((b: any) => b.id));
    const segPolicies = policies.filter((p: any) => segBookingIds.has(p.booking_id));
    const segPolicyIds = new Set(segPolicies.map((p: any) => p.id));
    const segClaims = claims.filter((c: any) => segPolicyIds.has(c.policy_id));
    const frequency = segPolicies.length > 0 ? segClaims.length / segPolicies.length : 0;

    return {
      segment,
      bookings: segBookings.length,
      policies: segPolicies.length,
      avgAge: Math.round(avgAge),
      topDestTypes,
      peakMonths,
      coverageMix,
      purePremium: Math.round(purePremium),
      frequency,
    };
  });

  return {
    kpis: { totalBookings: bookings.length, totalPolicies: policies.length, totalPurePremium, claimRate },
    premiumBySegment: Object.entries(premiumBySegment).map(([segment, vals]) => ({ segment, hotel: Math.round(vals.hotel), flight: Math.round(vals.flight) })),
    bookingsByMonth: Object.entries(bookingsByMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, segs]) => ({ month, winter_birds: segs.winter_birds || 0, holiday_travelers: segs.holiday_travelers || 0, baseline: segs.baseline || 0 })),
    coverageSplit: Object.entries(coverageSplit).map(([type, count]) => ({ name: type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), value: count })),
    monthlyPL: Object.entries(monthlyPL).sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({ month, premium: Math.round(d.premium), incurred: Math.round(d.incurred), lossRatio: d.premium > 0 ? +(d.incurred / d.premium).toFixed(4) : 0 })),
    products,
    segmentProfiles,
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
    return { kpis: { has2026Data: false, portfolioAE: 0, worstSegment: "N/A", worstSegmentAE: 0, worstMonth: "N/A", worstMonthAE: 0, modelAccuracy: 0 }, aeBySegment: [], aeByDestType: [], heatmap: [], yoy: [], rateAdequacy: [], validation2025: { portfolioAE: 0, bySegment: [] } };
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

  // 2025 validation: extract baseline metrics from segment rows' JSONB
  //   segmentRows[].metrics contains: frequency_2025, avg_severity_2025, loss_per_policy_2025,
  //   policies_2025, claims_2025, total_loss_2025 — pre-computed by Python generator
  const validation2025BySegment = segmentRows.map((r: any) => {
    const m = r.metrics;
    const expected = m.total_loss_2025_expected || (m.loss_per_policy_2025 * (m.policies_2025 || 0));
    const actual = m.total_loss_2025 || 0;
    return {
      segment: (m.dimension || "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
      ae: expected > 0 ? actual / expected : 1.0,
      expected: Math.round(expected),
      actual: Math.round(actual),
      frequency: m.frequency_2025 || 0,
      avgSeverity: Math.round(m.avg_severity_2025 || 0),
    };
  });
  const totalExpected2025 = validation2025BySegment.reduce((s: number, v: any) => s + v.expected, 0);
  const totalActual2025 = validation2025BySegment.reduce((s: number, v: any) => s + v.actual, 0);
  const validation2025 = {
    portfolioAE: totalExpected2025 > 0 ? totalActual2025 / totalExpected2025 : 1.0,
    bySegment: validation2025BySegment,
  };

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
    validation2025,
  };
}

function getClaimsForPoliciesDirect(data: any, policies: any[]): any[] {
  const result: any[] = [];
  for (const p of policies) {
    const cls = data.claimByPolicyId.get(p.id);
    if (cls) result.push(...cls);
  }
  return result;
}

function buildPricing(data: any, bookings: any[], policies: any[], claims: any[]) {
  const hotelPolicies = policies.filter((p: any) => p.product_id === 1);
  const flightPolicies = policies.filter((p: any) => p.product_id === 2);

  const hotelClaims = getClaimsForPoliciesDirect(data, hotelPolicies);
  const flightClaims = getClaimsForPoliciesDirect(data, flightPolicies);

  // Per-segment actual stats for scenario table
  const segmentBookings: Record<string, any[]> = {};
  for (const b of bookings) {
    if (!segmentBookings[b.segment]) segmentBookings[b.segment] = [];
    segmentBookings[b.segment].push(b);
  }

  const segmentScenarios = Object.entries(segmentBookings).map(([segment, segBk]) => {
    const segBookingIds = new Set(segBk.map((b: any) => b.id));
    const segPolicies = policies.filter((p: any) => segBookingIds.has(p.booking_id));
    const segClaims = getClaimsForPoliciesDirect(data, segPolicies);
    const frequency = segPolicies.length > 0 ? segClaims.length / segPolicies.length : 0;
    const avgSeverity = segClaims.length > 0
      ? segClaims.reduce((s: number, c: any) => s + c.claim_amount, 0) / segClaims.length
      : 0;
    const avgTripCost = segPolicies.length > 0
      ? segPolicies.reduce((s: number, p: any) => s + p.trip_cost, 0) / segPolicies.length
      : 0;
    const avgPurePremium = segBk.length > 0
      ? segBk.reduce((s: number, b: any) => s + b.pure_premium, 0) / segBk.length
      : 0;
    const avgAge = segBk.length > 0
      ? Math.round(segBk.reduce((s: number, b: any) => s + (b.age || 0), 0) / segBk.length)
      : 0;

    return {
      segment,
      frequency,
      avgSeverity: Math.round(avgSeverity),
      avgTripCost: Math.round(avgTripCost),
      avgPurePremium: Math.round(avgPurePremium),
      avgAge,
      policies: segPolicies.length,
      claims: segClaims.length,
    };
  });

  return {
    portfolioStats: {
      avgFrequency: policies.length > 0 ? claims.length / policies.length : 0,
      avgSeverity: claims.length > 0 ? claims.reduce((s: number, c: any) => s + c.claim_amount, 0) / claims.length : 0,
      hotelFrequency: hotelPolicies.length > 0 ? hotelClaims.length / hotelPolicies.length : 0,
      flightFrequency: flightPolicies.length > 0 ? flightClaims.length / flightPolicies.length : 0,
      hotelAvgSeverity: hotelClaims.length > 0 ? hotelClaims.reduce((s: number, c: any) => s + c.claim_amount, 0) / hotelClaims.length : 0,
      flightAvgSeverity: flightClaims.length > 0 ? flightClaims.reduce((s: number, c: any) => s + c.claim_amount, 0) / flightClaims.length : 0,
    },
    segmentScenarios,
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
    case "pricing": result = buildPricing(data, bookings, policies, claims); break;
    case "dislocation": result = await buildDislocation(); break;
    default: result = buildSummary(data, bookings, policies, claims);
  }

  return NextResponse.json(result);
}
