# Travelers Insurance Portfolio — Semantic Model

## Overview

This is a synthetic travel insurance portfolio with 50,000 bookings generating ~73,000 policies for the 2025 calendar year. It models a US-based insurer covering trips to the US Atlantic coast, Gulf Coast, and Caribbean. The data supports pricing analysis, catastrophe exposure modeling, and segment profiling.

## Table Descriptions

### products
Two rows: "Hotel" (id=1) and "Flight" (id=2). Every policy links to one product.

### destinations
38 travel destinations with lat/lon coordinates, airport codes, and average hotel nightly rates. Three destination types: `us_atlantic` (14 locations, FL to NY), `gulf_coast` (6 locations, TX/AL/FL/LA), `caribbean` (18 locations, PR/USVI/Bahamas/DR/Jamaica/Mexico/Cayman/Turks & Caicos/Aruba/Barbados/Bermuda).

### bookings
50,000 rows — one per customer trip. Each booking belongs to exactly one segment and one destination. Key columns:
- `segment`: customer segment (`winter_birds`, `holiday_travelers`, `baseline`)
- `destination_id`: FK to destinations
- `age`: customer age at time of travel
- `state_of_residence`: 20 US states (NY, NJ, CT, MA, PA, OH, MI, IL, MN, WI, FL, TX, CA, GA, VA, NC, CO, AZ, WA, MD)
- `departure_date`, `return_date`, `num_nights`: trip window
- `coverage_type`: `hotel_only`, `flight_only`, or `hotel_and_flight`
- `pure_premium`: expected loss for this booking (sum of its policies' pure premiums)

### policies
~73,000 rows — one per product purchased. A booking with `coverage_type = 'hotel_and_flight'` creates TWO policy rows (one Hotel, one Flight) sharing the same `booking_id`.
- `booking_id`: FK to bookings
- `product_id`: FK to products (1=Hotel, 2=Flight)
- `trip_cost`: dollar value insured
- `base_frequency`: GLM-predicted claim probability
- `pure_premium`: frequency × expected severity
- Hotel policies have `price_per_night`; Flight policies have `flight_price`, `origin_airport`, `destination_airport`

### claims
~5,300 rows — one per claim event, linked to a policy.
- `claim_type`: `pre_departure` or `post_departure`
- `claim_subtype`: `cancellation`, `trip_delay`, or `trip_interruption`
- `claim_date`, `claim_amount`
- `days_delayed`: populated for trip_delay claims
- Overall reported frequency is ~7% at the policy level

## Segments

| Segment | Bookings | Profile |
|---------|----------|---------|
| `winter_birds` | ~12,000 | Snowbirds, avg age 67, FL/TX destinations, Dec-Feb peak, long stays (~30 nights) |
| `holiday_travelers` | ~18,000 | Families, avg age 42, Caribbean-heavy, holiday peaks, ~6 night stays |
| `baseline` | ~20,000 | Year-round, uniform age 25-70, hotel-only dominant, short trips (~3.5 nights) |

## Key Metrics & Formulas

- **Reported Frequency**: `COUNT(claims) / COUNT(policies)` — approximately 7%
- **Pure Premium**: `SUM(pure_premium)` from bookings or policies. This is the expected loss.
- **Loss Ratio**: `SUM(claim_amount) / SUM(trip_cost)` — actual losses divided by exposure
- **Average Severity**: `AVG(claim_amount)` where claims exist
- **Exposure (dollar)**: `SUM(trip_cost)` from policies
- **Travelers on the ground**: Bookings where `departure_date <= @date AND return_date >= @date` for a given destination set

## Common Join Paths

- bookings → destinations: `bookings.destination_id = destinations.id`
- bookings → policies: `policies.booking_id = bookings.id`
- policies → claims: `claims.policy_id = policies.id`
- policies → products: `policies.product_id = products.id`
- Full chain: bookings → policies → claims (3-table join via booking_id then policy_id)

## Hurricane / Catastrophe Exposure

Gulf Coast destinations (destination_type = 'gulf_coast'): Galveston TX, South Padre Island TX, Gulf Shores AL, Pensacola FL, Panama City Beach FL, New Orleans LA.

To find travelers exposed to a hurricane hitting the Gulf Coast during a date range (e.g., Sept 10-16):
```sql
SELECT d.city, COUNT(b.id) AS travelers_on_ground, SUM(p.trip_cost) AS dollar_exposure
FROM bookings b
JOIN destinations d ON b.destination_id = d.id
JOIN policies p ON p.booking_id = b.id
WHERE d.destination_type = 'gulf_coast'
  AND b.departure_date <= '2025-09-16'
  AND b.return_date >= '2025-09-10'
GROUP BY d.city
ORDER BY dollar_exposure DESC;
```

September has elevated claim frequency (month_9 GLM coefficient = +0.35, the highest).

## 2026 Cohort & Dislocation Analysis

The portfolio has two cohorts by `purchase_date`:
- **2025 cohort**: `purchase_date` between 2025-01-01 and 2025-12-31
- **2026 cohort**: `purchase_date` >= 2026-01-01

The 2026 cohort was priced using the same 2025 GLM model (stored in `base_frequency` and `pure_premium` on policies), but actual claims come from shifted 2026 reality. The gap between predicted and actual = **dislocation**.

### Key Dislocation Metrics

- **A/E Ratio (Actual/Expected)**: `SUM(claim_amount) / SUM(pure_premium)` — 1.0 = model is correct, >1.0 = model under-predicts
- **Rate Adequacy**: inverse of A/E — how adequate the rate is for covering actual losses
- **Reported Frequency**: `COUNT(claims) / COUNT(policies)` — compare 2025 (~7%) vs 2026 (~9-10%)
- **Frequency A/E**: actual claim count / SUM(base_frequency) — measures frequency dislocation

### glm_models Table

Reference table storing GLM coefficients for both model versions:
- `model_version`: '2025_v1' (pricing model) or '2026_actual' (shifted reality)
- `model_type`: 'frequency' or 'severity'
- `coefficient_name`: e.g., 'intercept', 'segment_baseline', 'month_9', 'destination_caribbean'
- `coefficient_value`: numeric coefficient value
- `description`: human-readable explanation

To compare coefficients between versions:
```sql
SELECT a.coefficient_name,
       a.coefficient_value AS "2025",
       b.coefficient_value AS "2026",
       b.coefficient_value - a.coefficient_value AS shift
FROM glm_models a
JOIN glm_models b ON a.coefficient_name = b.coefficient_name
  AND a.model_type = b.model_type
WHERE a.model_version = '2025_v1'
  AND b.model_version = '2026_actual'
  AND a.model_type = 'frequency'
ORDER BY ABS(b.coefficient_value - a.coefficient_value) DESC;
```

### dislocation_analysis Table

Pre-computed results table with A/E ratios, heatmap data, and rate adequacy metrics. Query this table for quick answers about model performance rather than recomputing from raw data:
```sql
-- Quick portfolio A/E
SELECT metrics->>'ae_ratio' AS portfolio_ae FROM dislocation_analysis WHERE analysis_type = 'overall';
-- A/E by segment
SELECT dimension, (metrics->>'ae_ratio')::float AS ae FROM dislocation_analysis WHERE analysis_type = 'ae_by_dimension' AND dimension_type = 'segment' ORDER BY ae DESC;
-- Worst heatmap cells
SELECT dimension AS segment, month, (metrics->>'ae_ratio')::float AS ae FROM dislocation_analysis WHERE analysis_type = 'heatmap' ORDER BY ae DESC LIMIT 5;
```

## Query Guardrails

1. Always use explicit JOINs (never implicit comma joins)
2. Round monetary values to 2 decimal places
3. Round percentages to 1 decimal place
4. Handle NULLs: use COALESCE where needed, especially for LEFT JOINs on claims
5. When computing reported frequency, count distinct policies with claims vs total policies
6. When asked about "bookings by segment", query the bookings table directly
7. When asked about loss ratio, join policies to claims — not bookings to claims
8. Age brackets: under 30, 30-49, 50-64, 65+ (unless user specifies otherwise)
9. The `pure_premium` column exists on BOTH bookings and policies — use the appropriate one based on context
