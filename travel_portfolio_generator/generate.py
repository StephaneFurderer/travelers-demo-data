"""Main orchestrator for travel insurance portfolio generation."""

import sys
import time
import numpy as np
from config import SEGMENT_BOOKING_COUNTS, SEGMENTS
from destinations import get_destinations_for_db
from generators import PortfolioGenerator
from db import get_client, insert_products, insert_destinations, batch_insert


def main():
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 42
    rng = np.random.default_rng(seed)

    print("Connecting to Supabase...")
    client = get_client()

    # ── Step 1: Reference data ───────────────────────────────────────────────
    print("\n── Inserting reference data ──")
    insert_products(client)
    dest_rows = insert_destinations(client, get_destinations_for_db())

    # Build lookup with DB-assigned IDs
    destinations = []
    for row in dest_rows:
        destinations.append({
            "id": row["id"],
            "city": row["city"],
            "state_or_country": row["state_or_country"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "airport_code": row["airport_code"],
            "destination_type": row["destination_type"],
            "avg_hotel_price_per_night": row["avg_hotel_price_per_night"],
        })

    gen = PortfolioGenerator(rng, destinations)

    # ── Step 2: Generate bookings, policies, claims ──────────────────────────
    all_bookings = []
    all_policies = []  # each entry: (policy_dict, claim_list)
    all_claims_pending = []  # (policy_local_idx_within_booking, claim_dict)

    total_bookings = sum(SEGMENT_BOOKING_COUNTS.values())
    print(f"\n── Generating {total_bookings:,} bookings ──")

    booking_buffer = []
    policy_buffer = []  # list of (booking_buffer_idx, policy_dict, [claim_dicts])
    t0 = time.time()

    global_booking_idx = 0
    for segment in SEGMENTS:
        count = SEGMENT_BOOKING_COUNTS[segment]
        for i in range(count):
            booking, policies, claims = gen.generate_booking(segment)
            booking_buffer.append(booking)
            for pol_idx, pol in enumerate(policies):
                # Find claims for this policy
                pol_claims = [c for c in claims if c.get("_policy_idx") == pol_idx]
                for c in pol_claims:
                    del c["_policy_idx"]
                policy_buffer.append((global_booking_idx, pol, pol_claims))
            global_booking_idx += 1

            if (global_booking_idx) % 10_000 == 0:
                elapsed = time.time() - t0
                print(f"  Generated {global_booking_idx:,} bookings ({elapsed:.1f}s)")

    elapsed = time.time() - t0
    print(f"  Generation complete: {global_booking_idx:,} bookings, "
          f"{len(policy_buffer):,} policies ({elapsed:.1f}s)")

    # ── Step 3: Insert bookings ──────────────────────────────────────────────
    print("\n── Inserting bookings ──")
    t1 = time.time()
    inserted_bookings = batch_insert(client, "bookings", booking_buffer)
    print(f"  ✓ {len(inserted_bookings):,} bookings inserted ({time.time()-t1:.1f}s)")

    # Map buffer index → DB booking ID
    booking_id_map = {i: row["id"] for i, row in enumerate(inserted_bookings)}

    # ── Step 4: Insert policies ──────────────────────────────────────────────
    print("\n── Inserting policies ──")
    t2 = time.time()
    policy_rows = []
    policy_claims_map = []  # parallel list: claims for each policy row

    for buf_idx, pol, pol_claims in policy_buffer:
        pol["booking_id"] = booking_id_map[buf_idx]
        policy_rows.append(pol)
        policy_claims_map.append(pol_claims)

    inserted_policies = batch_insert(client, "policies", policy_rows)
    print(f"  ✓ {len(inserted_policies):,} policies inserted ({time.time()-t2:.1f}s)")

    # ── Step 5: Insert claims ────────────────────────────────────────────────
    print("\n── Inserting claims ──")
    t3 = time.time()
    claim_rows = []
    for i, pol_row in enumerate(inserted_policies):
        for claim in policy_claims_map[i]:
            claim["policy_id"] = pol_row["id"]
            claim_rows.append(claim)

    if claim_rows:
        inserted_claims = batch_insert(client, "claims", claim_rows)
        print(f"  ✓ {len(inserted_claims):,} claims inserted ({time.time()-t3:.1f}s)")
    else:
        print("  No claims generated")
        inserted_claims = []

    # ── Summary ──────────────────────────────────────────────────────────────
    total_time = time.time() - t0
    print(f"\n{'='*60}")
    print(f"PORTFOLIO GENERATION COMPLETE")
    print(f"{'='*60}")
    print(f"  Bookings:    {len(inserted_bookings):>8,}")
    print(f"  Policies:    {len(inserted_policies):>8,}")
    print(f"  Claims:      {len(inserted_claims):>8,}")
    print(f"  Reported frequency: {len(inserted_claims)/len(inserted_policies)*100:>7.2f}%")
    print(f"  Total time:  {total_time:>7.1f}s")
    print(f"{'='*60}")

    # Segment breakdown
    print("\nBookings by segment:")
    from collections import Counter
    seg_counts = Counter(b["segment"] for b in booking_buffer)
    for seg in SEGMENTS:
        print(f"  {seg:25s}: {seg_counts[seg]:>8,}")

    # Product breakdown
    print("\nPolicies by product:")
    prod_counts = Counter(p["product_id"] for p in policy_rows)
    print(f"  Hotel (1):  {prod_counts.get(1, 0):>8,}")
    print(f"  Flight (2): {prod_counts.get(2, 0):>8,}")

    # Claim breakdown
    if claim_rows:
        print("\nClaims by type:")
        type_counts = Counter(c["claim_type"] for c in claim_rows)
        for ct, cnt in type_counts.items():
            print(f"  {ct:25s}: {cnt:>6,}")
        print("\nClaims by subtype:")
        sub_counts = Counter(c["claim_subtype"] for c in claim_rows)
        for st, cnt in sub_counts.items():
            print(f"  {st:25s}: {cnt:>6,}")


if __name__ == "__main__":
    main()
