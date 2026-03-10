import { getData, filterBookings, getPoliciesForBookings, getClaimsForPolicies, parseFilters } from "@/lib/cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const data = await getData();
  const filters = parseFilters(req.nextUrl.searchParams);
  const bookings = filterBookings(data, filters);
  const policies = getPoliciesForBookings(data, bookings);
  const claims = getClaimsForPolicies(data, policies);

  // KPIs
  const totalIncurred = claims.reduce((s, c) => s + c.claim_amount, 0);
  const avgSeverity = claims.length > 0 ? totalIncurred / claims.length : 0;
  const preDeparture = claims.filter(c => c.claim_type === "pre_departure").length;
  const postDeparture = claims.filter(c => c.claim_type === "post_departure").length;

  // Claims by subtype
  const bySubtype: Record<string, { count: number; amount: number }> = {};
  for (const c of claims) {
    if (!bySubtype[c.claim_subtype]) bySubtype[c.claim_subtype] = { count: 0, amount: 0 };
    bySubtype[c.claim_subtype].count += 1;
    bySubtype[c.claim_subtype].amount += c.claim_amount;
  }

  // Loss ratio by state
  const policyToBooking = new Map(policies.map(p => [p.id, p.booking_id]));
  const bookingMap = new Map(bookings.map(b => [b.id, b]));

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

  const lossRatioByState = Object.entries(stateData)
    .map(([state, d]) => ({
      state,
      premium: Math.round(d.premium),
      incurred: Math.round(d.incurred),
      lossRatio: d.premium > 0 ? d.incurred / d.premium : 0,
      claims: d.claims,
    }))
    .sort((a, b) => b.lossRatio - a.lossRatio);

  // Claims by month
  const claimsByMonth: Record<string, number> = {};
  for (const c of claims) {
    const month = c.claim_date.substring(0, 7);
    claimsByMonth[month] = (claimsByMonth[month] || 0) + 1;
  }

  return NextResponse.json({
    kpis: {
      totalIncurred,
      avgSeverity,
      preDeparture,
      postDeparture,
      totalClaims: claims.length,
    },
    bySubtype: Object.entries(bySubtype).map(([subtype, d]) => ({
      subtype: subtype.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      count: d.count,
      amount: Math.round(d.amount),
    })),
    lossRatioByState,
    claimsByMonth: Object.entries(claimsByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count })),
  });
}
