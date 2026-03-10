import { getData, filterBookings, getPoliciesForBookings, parseFilters } from "@/lib/cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const data = await getData();
  const filters = parseFilters(req.nextUrl.searchParams);
  const bookings = filterBookings(data, filters);
  const policies = getPoliciesForBookings(data, bookings);

  // Aggregate by destination
  const destAgg: Record<number, { totalPremium: number; bookingCount: number }> = {};
  for (const b of bookings) {
    if (!destAgg[b.destination_id]) destAgg[b.destination_id] = { totalPremium: 0, bookingCount: 0 };
    destAgg[b.destination_id].totalPremium += b.pure_premium;
    destAgg[b.destination_id].bookingCount += 1;
  }

  // Policy aggregates by destination
  const bookingDestMap = new Map(bookings.map(b => [b.id, b.destination_id]));
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
        const dest = data.destinations.find(d => d.airport_code === p.destination_airport);
        routeAgg[key] = {
          count: 0,
          origin: p.origin_airport,
          dest: p.destination_airport,
          destLat: dest?.latitude,
          destLon: dest?.longitude,
        };
      }
      routeAgg[key].count += 1;
    }
  }

  const markers = data.destinations
    .map(d => {
      const agg = destAgg[d.id];
      const polAgg = policyAgg[d.id];
      return {
        id: d.id,
        city: d.city,
        stateOrCountry: d.state_or_country,
        lat: d.latitude,
        lon: d.longitude,
        airportCode: d.airport_code,
        destinationType: d.destination_type,
        totalPremium: agg?.totalPremium || 0,
        bookingCount: agg?.bookingCount || 0,
        policyCount: polAgg?.policyCount || 0,
        tripCostExposure: polAgg?.tripCost || 0,
        claimCount: 0,
      };
    })
    .filter(m => m.bookingCount > 0);

  const topDestinations = [...markers]
    .sort((a, b) => b.totalPremium - a.totalPremium)
    .slice(0, 15);

  return NextResponse.json({
    markers,
    routes: Object.values(routeAgg).filter(r => r.count > 5),
    topDestinations,
    totalExposure: markers.reduce((sum, m) => sum + m.totalPremium, 0),
    totalPoliciesInRange: markers.reduce((sum, m) => sum + m.policyCount, 0),
  });
}
