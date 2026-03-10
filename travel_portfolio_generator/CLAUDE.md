# Travel Insurance Portfolio Generator

Synthetic portfolio of 50,000 travel insurance bookings (73K policies) for 2025, stored in Supabase. Built for pricing GLM analysis, hurricane catastrophe exposure modeling, and flight/hotel exposure tracking.

## Data Model

```
products (2 rows: Hotel, Flight)
destinations (38 locations: US Atlantic, Gulf Coast, Caribbean — each with lat/lon)
bookings (50K) → one per customer trip
  ├── policies (73K) → one per product purchased, linked by booking_id
  │     └── claims (5.3K) → linked by policy_id
```

A booking with `coverage_type = "hotel_and_flight"` produces **2 policy rows** (one Hotel, one Flight) sharing the same `booking_id`.

## Segments

| Segment | Bookings | Profile |
|---------|----------|---------|
| `winter_birds` | 12K | Snowbirds, age ~67, FL/TX destinations, Dec-Feb peak, long stays |
| `holiday_travelers` | 18K | Families, age ~42, Caribbean-heavy, holiday peaks, ~6 night stays |
| `baseline` | 20K | Year-round, uniform age 25-70, hotel-only dominant, short trips |

## Key Design Decisions

- **GLM coefficients are hardcoded in `config.py`** (`FREQ_GLM`, `SEV_GLM`). Claims are generated from these true Poisson/Gamma GLMs so fitting a GLM on the output recovers known coefficients.
- **Rating factors**: age, state_of_residence, trip_cost, product (hotel/flight), segment, departure month.
- **20 US states of residence**, weighted differently per segment.
- **Reported frequency ~7%**: 30% pre-departure (cancellation), 70% post-departure (50/50 delay vs interruption).
- `base_frequency` on each policy row stores the GLM-computed claim probability.
- `pure_premium` on each policy = `frequency × E[severity]` (blended across claim types, using the severity GLM with log-normal correction). On each booking = sum of its policies' pure premiums. This is the expected loss per record — use `SUM(pure_premium)` across bookings for portfolio-level top line.

## Files

| File | What it does |
|------|-------------|
| `generate.py` | Main entry point. Connects to Supabase, generates all data, batch inserts. |
| `config.py` | All constants: GLM coefficients, segment weights, distributions, thresholds. |
| `destinations.py` | 38 destinations with lat/lon, airport codes, hotel rates. |
| `generators.py` | `PortfolioGenerator` class — booking/policy/claim generation using the GLM. |
| `db.py` | Supabase client init + batch insert helpers. Reads `SUPABASE_URL` and `SUPABASE_API` from `.env`. |
| `schema.sql` | DDL for all 5 tables. Run in Supabase SQL Editor before `generate.py`. |

## Running

```
# 1. Set up .env with SUPABASE_URL and SUPABASE_API
# 2. Run schema.sql in Supabase SQL Editor
# 3. pip install -r requirements.txt
# 4. python generate.py [seed]  # default seed=42
```

## Supabase Env Vars

- `SUPABASE_URL` — project URL
- `SUPABASE_API` — publishable anon key
