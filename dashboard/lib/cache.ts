import { supabase, fetchAll } from "./supabase";

export interface Booking {
  id: number;
  segment: string;
  destination_id: number;
  age: number;
  state_of_residence: string;
  purchase_date: string;
  departure_date: string;
  return_date: string;
  num_nights: number;
  coverage_type: string;
  pure_premium: number;
  commercial_premium: number;
}

export interface Destination {
  id: number;
  city: string;
  state_or_country: string;
  latitude: number;
  longitude: number;
  airport_code: string;
  destination_type: string;
  avg_hotel_price_per_night: number;
}

export interface Policy {
  id: number;
  booking_id: number;
  product_id: number;
  trip_cost: number;
  price_per_night: number | null;
  flight_price: number | null;
  origin_airport: string | null;
  destination_airport: string | null;
  base_frequency: number;
  expected_loss: number;
  pure_premium: number;
  commercial_premium: number;
}

export interface Claim {
  id: number;
  policy_id: number;
  claim_date: string;
  claim_amount: number;
}

export interface CachedData {
  bookings: Booking[];
  destinations: Destination[];
  policies: Policy[];
  claims: Claim[];
  // Lookup maps for fast joins
  policyByBookingId: Map<number, Policy[]>;
  claimByPolicyId: Map<number, Claim[]>;
  bookingById: Map<number, Booking>;
  destinationById: Map<number, Destination>;
  loadedAt: number;
}

let cached: CachedData | null = null;
let loading: Promise<CachedData> | null = null;
const TTL_MS = 10 * 60 * 1000; // 10 minutes

async function loadAll(): Promise<CachedData> {
  console.time("cache:load");

  const [destinations, bookings, policies, claims] = await Promise.all([
    supabase.from("destinations").select("*").then(r => r.data as Destination[]),
    fetchAll(() => supabase.from("bookings").select("id, segment, destination_id, age, state_of_residence, purchase_date, departure_date, return_date, num_nights, coverage_type, pure_premium, commercial_premium")),
    fetchAll(() => supabase.from("policies").select("id, booking_id, product_id, trip_cost, price_per_night, flight_price, origin_airport, destination_airport, base_frequency, expected_loss, pure_premium, commercial_premium")),
    fetchAll(() => supabase.from("claims").select("id, policy_id, claim_date, claim_amount")),
  ]);

  // Build lookup maps
  const policyByBookingId = new Map<number, Policy[]>();
  for (const p of policies) {
    const arr = policyByBookingId.get(p.booking_id);
    if (arr) arr.push(p);
    else policyByBookingId.set(p.booking_id, [p]);
  }

  const claimByPolicyId = new Map<number, Claim[]>();
  for (const c of claims) {
    const arr = claimByPolicyId.get(c.policy_id);
    if (arr) arr.push(c);
    else claimByPolicyId.set(c.policy_id, [c]);
  }

  const bookingById = new Map<number, Booking>();
  for (const b of bookings) bookingById.set(b.id, b);

  const destinationById = new Map<number, Destination>();
  for (const d of destinations) destinationById.set(d.id, d);

  console.timeEnd("cache:load");
  console.log(`Cached: ${bookings.length} bookings, ${policies.length} policies, ${claims.length} claims, ${destinations.length} destinations`);

  return {
    bookings,
    destinations,
    policies,
    claims,
    policyByBookingId,
    claimByPolicyId,
    bookingById,
    destinationById,
    loadedAt: Date.now(),
  };
}

export async function getData(): Promise<CachedData> {
  if (cached && Date.now() - cached.loadedAt < TTL_MS) {
    return cached;
  }

  // Prevent thundering herd: only one load at a time
  if (!loading) {
    loading = loadAll().then(data => {
      cached = data;
      loading = null;
      return data;
    }).catch(err => {
      loading = null;
      throw err;
    });
  }

  return loading;
}

/** Apply global filters to bookings, returning filtered subset */
export function filterBookings(
  data: CachedData,
  filters: { segment?: string; destinationType?: string; dateFrom?: string; dateTo?: string }
): Booking[] {
  let result = data.bookings;

  if (filters.segment) {
    result = result.filter(b => b.segment === filters.segment);
  }
  if (filters.destinationType) {
    const destIds = new Set(
      data.destinations.filter(d => d.destination_type === filters.destinationType).map(d => d.id)
    );
    result = result.filter(b => destIds.has(b.destination_id));
  }
  if (filters.dateFrom) {
    result = result.filter(b => b.departure_date >= filters.dateFrom!);
  }
  if (filters.dateTo) {
    result = result.filter(b => b.departure_date <= filters.dateTo!);
  }

  return result;
}

/** Get all policies for a set of bookings */
export function getPoliciesForBookings(data: CachedData, bookings: Booking[]): Policy[] {
  const result: Policy[] = [];
  for (const b of bookings) {
    const pols = data.policyByBookingId.get(b.id);
    if (pols) result.push(...pols);
  }
  return result;
}

/** Get all claims for a set of policies */
export function getClaimsForPolicies(data: CachedData, policies: Policy[]): Claim[] {
  const result: Claim[] = [];
  for (const p of policies) {
    const cls = data.claimByPolicyId.get(p.id);
    if (cls) result.push(...cls);
  }
  return result;
}

export function parseFilters(params: URLSearchParams) {
  return {
    segment: params.get("segment") || undefined,
    destinationType: params.get("destination_type") || undefined,
    dateFrom: params.get("date_from") || undefined,
    dateTo: params.get("date_to") || undefined,
  };
}
