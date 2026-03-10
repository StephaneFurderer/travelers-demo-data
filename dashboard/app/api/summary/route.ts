import { getData, filterBookings, getPoliciesForBookings, getClaimsForPolicies, parseFilters } from "@/lib/cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const data = await getData();
  const filters = parseFilters(req.nextUrl.searchParams);
  const bookings = filterBookings(data, filters);
  const policies = getPoliciesForBookings(data, bookings);
  const claims = getClaimsForPolicies(data, policies);

  const totalPurePremium = bookings.reduce((s, b) => s + b.pure_premium, 0);
  const claimRate = policies.length > 0 ? claims.length / policies.length : 0;

  // Premium by segment (stacked hotel/flight)
  const premiumBySegment: Record<string, { hotel: number; flight: number }> = {};
  for (const b of bookings) {
    if (!premiumBySegment[b.segment]) premiumBySegment[b.segment] = { hotel: 0, flight: 0 };
    if (b.coverage_type === "hotel_only") {
      premiumBySegment[b.segment].hotel += b.pure_premium;
    } else if (b.coverage_type === "flight_only") {
      premiumBySegment[b.segment].flight += b.pure_premium;
    } else {
      premiumBySegment[b.segment].hotel += b.pure_premium * 0.6;
      premiumBySegment[b.segment].flight += b.pure_premium * 0.4;
    }
  }

  // Bookings by departure month
  const bookingsByMonth: Record<string, Record<string, number>> = {};
  for (const b of bookings) {
    const month = b.departure_date.substring(0, 7);
    if (!bookingsByMonth[month]) bookingsByMonth[month] = {};
    bookingsByMonth[month][b.segment] = (bookingsByMonth[month][b.segment] || 0) + 1;
  }

  // Coverage type split
  const coverageSplit: Record<string, number> = {};
  for (const b of bookings) {
    coverageSplit[b.coverage_type] = (coverageSplit[b.coverage_type] || 0) + 1;
  }

  // --- Monthly P&L: premium, incurred, loss ratio by departure month ---
  // Map policy → booking for departure month lookup
  const policyBookingMap = new Map<number, string>(); // policy_id → departure month
  for (const b of bookings) {
    const month = b.departure_date.substring(0, 7);
    const pols = data.policyByBookingId.get(b.id);
    if (pols) for (const p of pols) policyBookingMap.set(p.id, month);
  }

  const monthlyPL: Record<string, { premium: number; incurred: number }> = {};
  for (const b of bookings) {
    const month = b.departure_date.substring(0, 7);
    if (!monthlyPL[month]) monthlyPL[month] = { premium: 0, incurred: 0 };
    monthlyPL[month].premium += b.pure_premium;
  }
  for (const c of claims) {
    const month = policyBookingMap.get(c.policy_id);
    if (month) {
      if (!monthlyPL[month]) monthlyPL[month] = { premium: 0, incurred: 0 };
      monthlyPL[month].incurred += c.claim_amount;
    }
  }

  return NextResponse.json({
    kpis: {
      totalBookings: bookings.length,
      totalPolicies: policies.length,
      totalPurePremium,
      claimRate,
    },
    premiumBySegment: Object.entries(premiumBySegment).map(([segment, vals]) => ({
      segment,
      hotel: Math.round(vals.hotel),
      flight: Math.round(vals.flight),
    })),
    bookingsByMonth: Object.entries(bookingsByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, segs]) => ({
        month,
        winter_birds: segs.winter_birds || 0,
        holiday_travelers: segs.holiday_travelers || 0,
        baseline: segs.baseline || 0,
      })),
    coverageSplit: Object.entries(coverageSplit).map(([type, count]) => ({
      name: type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      value: count,
    })),
    monthlyPL: Object.entries(monthlyPL)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month,
        premium: Math.round(d.premium),
        incurred: Math.round(d.incurred),
        lossRatio: d.premium > 0 ? +(d.incurred / d.premium).toFixed(4) : 0,
      })),
  });
}
