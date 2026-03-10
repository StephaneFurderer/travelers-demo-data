import { getData, filterBookings, getPoliciesForBookings, parseFilters } from "@/lib/cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const data = await getData();
  const filters = parseFilters(req.nextUrl.searchParams);
  const bookings = filterBookings(data, filters);
  const policies = getPoliciesForBookings(data, bookings);
  const bookingDestMap = new Map(bookings.map(b => [b.id, b.destination_id]));

  // Hotel data
  const hotelByDest: Record<number, { totalPrice: number; count: number; totalTripCost: number }> = {};
  for (const p of policies) {
    if (p.product_id !== 1) continue;
    const destId = bookingDestMap.get(p.booking_id);
    if (destId === undefined) continue;
    if (!hotelByDest[destId]) hotelByDest[destId] = { totalPrice: 0, count: 0, totalTripCost: 0 };
    hotelByDest[destId].totalPrice += p.price_per_night || 0;
    hotelByDest[destId].count += 1;
    hotelByDest[destId].totalTripCost += p.trip_cost;
  }

  const hotelData = Object.entries(hotelByDest)
    .map(([destId, d]) => {
      const dest = data.destinationById.get(Number(destId));
      return {
        destination: dest?.city || "Unknown",
        destinationType: dest?.destination_type || "",
        avgPricePerNight: Math.round(d.totalPrice / d.count),
        totalExposure: Math.round(d.totalTripCost),
        policyCount: d.count,
      };
    })
    .sort((a, b) => b.totalExposure - a.totalExposure);

  // Flight data
  const routeAgg: Record<string, { count: number; totalPrice: number; origin: string; dest: string }> = {};
  const flightByDestType: Record<string, { totalPrice: number; count: number }> = {};

  for (const p of policies) {
    if (p.product_id !== 2) continue;

    if (p.origin_airport && p.destination_airport) {
      const key = `${p.origin_airport}→${p.destination_airport}`;
      if (!routeAgg[key]) routeAgg[key] = { count: 0, totalPrice: 0, origin: p.origin_airport, dest: p.destination_airport };
      routeAgg[key].count += 1;
      routeAgg[key].totalPrice += p.flight_price || 0;
    }

    const destId = bookingDestMap.get(p.booking_id);
    if (destId !== undefined) {
      const dest = data.destinationById.get(destId);
      const dtype = dest?.destination_type || "unknown";
      if (!flightByDestType[dtype]) flightByDestType[dtype] = { totalPrice: 0, count: 0 };
      flightByDestType[dtype].totalPrice += p.flight_price || 0;
      flightByDestType[dtype].count += 1;
    }
  }

  const flightRoutes = Object.values(routeAgg)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map(r => ({
      route: `${r.origin} → ${r.dest}`,
      count: r.count,
      avgPrice: Math.round(r.totalPrice / r.count),
    }));

  const flightByType = Object.entries(flightByDestType).map(([type, d]) => ({
    type: type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    avgPrice: Math.round(d.totalPrice / d.count),
    count: d.count,
  }));

  return NextResponse.json({
    hotel: { byDestination: hotelData.slice(0, 20) },
    flight: { topRoutes: flightRoutes, byDestType: flightByType },
  });
}
