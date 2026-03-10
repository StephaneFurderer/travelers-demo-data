"""Generate 2026 dislocated portfolio — append to existing Supabase data.

Usage:
    cd travel_portfolio_generator
    python -m dislocation.generate_2026 [seed]
"""

import sys
import os
import time
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import SEGMENT_BOOKING_COUNTS, SEGMENTS, BATCH_SIZE
from db import get_client, batch_insert
from dislocation.generator_2026 import DislocatedPortfolioGenerator


def main():
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    rng = np.random.default_rng(seed)

    print("Connecting to Supabase...")
    client = get_client()

    # ── Read existing destinations (do NOT re-insert) ──────────────────────
    print("\n── Reading existing destinations ──")
    result = client.table("destinations").select("*").execute()
    destinations = result.data
    print(f"  Found {len(destinations)} destinations")

    if not destinations:
        print("ERROR: No destinations found. Run the 2025 generator first.")
        sys.exit(1)

    gen = DislocatedPortfolioGenerator(rng, destinations)

    # ── Generate bookings, policies, claims ────────────────────────────────
    total_bookings = sum(SEGMENT_BOOKING_COUNTS.values())
    print(f"\n── Generating {total_bookings:,} 2026 bookings ──")

    booking_buffer = []
    policy_buffer = []
    t0 = time.time()

    global_booking_idx = 0
    for segment in SEGMENTS:
        count = SEGMENT_BOOKING_COUNTS[segment]
        for i in range(count):
            booking, policies, claims = gen.generate_booking(segment)
            booking_buffer.append(booking)
            for pol_idx, pol in enumerate(policies):
                pol_claims = [c for c in claims if c.get("_policy_idx") == pol_idx]
                for c in pol_claims:
                    del c["_policy_idx"]
                policy_buffer.append((global_booking_idx, pol, pol_claims))
            global_booking_idx += 1

            if global_booking_idx % 10_000 == 0:
                elapsed = time.time() - t0
                print(f"  Generated {global_booking_idx:,} bookings ({elapsed:.1f}s)")

    elapsed = time.time() - t0
    print(f"  Generation complete: {global_booking_idx:,} bookings, "
          f"{len(policy_buffer):,} policies ({elapsed:.1f}s)")

    # ── Insert bookings (APPEND — no DROP TABLE) ───────────────────────────
    print("\n── Inserting 2026 bookings ──")
    t1 = time.time()
    inserted_bookings = batch_insert(client, "bookings", booking_buffer)
    print(f"  ✓ {len(inserted_bookings):,} bookings inserted ({time.time()-t1:.1f}s)")

    booking_id_map = {i: row["id"] for i, row in enumerate(inserted_bookings)}

    # ── Insert policies ────────────────────────────────────────────────────
    print("\n── Inserting 2026 policies ──")
    t2 = time.time()
    policy_rows = []
    policy_claims_map = []

    for buf_idx, pol, pol_claims in policy_buffer:
        pol["booking_id"] = booking_id_map[buf_idx]
        policy_rows.append(pol)
        policy_claims_map.append(pol_claims)

    inserted_policies = batch_insert(client, "policies", policy_rows)
    print(f"  ✓ {len(inserted_policies):,} policies inserted ({time.time()-t2:.1f}s)")

    # ── Insert claims ──────────────────────────────────────────────────────
    print("\n── Inserting 2026 claims ──")
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

    # ── Summary ────────────────────────────────────────────────────────────
    total_time = time.time() - t0
    reported_freq = len(inserted_claims) / len(inserted_policies) * 100 if inserted_policies else 0

    print(f"\n{'='*60}")
    print(f"2026 DISLOCATED PORTFOLIO GENERATION COMPLETE")
    print(f"{'='*60}")
    print(f"  Bookings:            {len(inserted_bookings):>8,}")
    print(f"  Policies:            {len(inserted_policies):>8,}")
    print(f"  Claims:              {len(inserted_claims):>8,}")
    print(f"  Reported frequency:  {reported_freq:>7.2f}%")
    print(f"  Total time:          {total_time:>7.1f}s")
    print(f"{'='*60}")

    # Segment breakdown
    print("\nBookings by segment:")
    from collections import Counter
    seg_counts = Counter(b["segment"] for b in booking_buffer)
    for seg in SEGMENTS:
        print(f"  {seg:25s}: {seg_counts[seg]:>8,}")

    # Claims by segment
    if claim_rows:
        print("\nClaims by segment (via policy → booking):")
        policy_to_seg = {}
        for buf_idx, pol, _ in policy_buffer:
            booking = booking_buffer[buf_idx]
            policy_to_seg[booking_id_map[buf_idx]] = booking["segment"]

        seg_claims = Counter()
        seg_policies = Counter()
        for buf_idx, pol, pol_claims in policy_buffer:
            seg = booking_buffer[buf_idx]["segment"]
            seg_policies[seg] += 1
            seg_claims[seg] += len(pol_claims)

        for seg in SEGMENTS:
            freq = seg_claims[seg] / seg_policies[seg] * 100 if seg_policies[seg] else 0
            print(f"  {seg:25s}: {seg_claims[seg]:>6,} claims / "
                  f"{seg_policies[seg]:>8,} policies = {freq:.2f}%")


if __name__ == "__main__":
    main()
