-- ============================================================
-- Premium Diagnostics — run each query separately in Supabase SQL Editor
-- ============================================================

-- 1. DISTRIBUTION STATS — booking-level pure_premium
-- Expected range: $2–$50 typical, outliers possible for extreme risk profiles
SELECT
  count(*)                                    AS n_bookings,
  round(min(pure_premium)::numeric, 2)        AS min_pp,
  round(avg(pure_premium)::numeric, 2)        AS avg_pp,
  round(percentile_cont(0.50) WITHIN GROUP (ORDER BY pure_premium)::numeric, 2) AS median_pp,
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY pure_premium)::numeric, 2) AS p95_pp,
  round(percentile_cont(0.99) WITHIN GROUP (ORDER BY pure_premium)::numeric, 2) AS p99_pp,
  round(max(pure_premium)::numeric, 2)        AS max_pp
FROM bookings;

-- 1b. DISTRIBUTION STATS — policy-level pure_premium
SELECT
  count(*)                                    AS n_policies,
  round(min(pure_premium)::numeric, 2)        AS min_pp,
  round(avg(pure_premium)::numeric, 2)        AS avg_pp,
  round(percentile_cont(0.50) WITHIN GROUP (ORDER BY pure_premium)::numeric, 2) AS median_pp,
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY pure_premium)::numeric, 2) AS p95_pp,
  round(percentile_cont(0.99) WITHIN GROUP (ORDER BY pure_premium)::numeric, 2) AS p99_pp,
  round(max(pure_premium)::numeric, 2)        AS max_pp
FROM policies;


-- 2. TOP 10 HIGHEST PURE PREMIUM BOOKINGS — with trip details
SELECT
  b.id            AS booking_id,
  b.segment,
  b.age,
  b.state_of_residence,
  b.coverage_type,
  b.num_nights,
  b.departure_date,
  d.city || ', ' || d.state_or_country AS destination,
  d.destination_type,
  round(b.pure_premium::numeric, 2)    AS booking_pp,
  (SELECT count(*) FROM policies p WHERE p.booking_id = b.id) AS n_policies
FROM bookings b
JOIN destinations d ON d.id = b.destination_id
ORDER BY b.pure_premium DESC
LIMIT 10;


-- 3. PURE PREMIUM BY SEGMENT — avg, min, max, count
SELECT
  segment,
  count(*)                                AS n_bookings,
  round(avg(pure_premium)::numeric, 2)    AS avg_pp,
  round(min(pure_premium)::numeric, 2)    AS min_pp,
  round(max(pure_premium)::numeric, 2)    AS max_pp,
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY pure_premium)::numeric, 2) AS p95_pp
FROM bookings
GROUP BY segment
ORDER BY avg_pp DESC;


-- 4. PURE PREMIUM vs TRIP COST — ratio analysis
-- pure_premium should be a small fraction of total trip cost
SELECT
  b.id            AS booking_id,
  b.segment,
  b.age,
  b.coverage_type,
  round(b.pure_premium::numeric, 2)                         AS booking_pp,
  round(sum(p.trip_cost)::numeric, 2)                        AS total_trip_cost,
  round((b.pure_premium / NULLIF(sum(p.trip_cost), 0) * 100)::numeric, 2) AS pp_pct_of_trip_cost
FROM bookings b
JOIN policies p ON p.booking_id = b.id
GROUP BY b.id, b.segment, b.age, b.coverage_type, b.pure_premium
ORDER BY pp_pct_of_trip_cost DESC
LIMIT 20;


-- 5. OUTLIER DETECTION — bookings where pure_premium > $100
SELECT
  b.id            AS booking_id,
  b.segment,
  b.age,
  b.state_of_residence,
  b.coverage_type,
  b.num_nights,
  b.departure_date,
  d.city || ', ' || d.state_or_country AS destination,
  d.destination_type,
  round(b.pure_premium::numeric, 2) AS booking_pp
FROM bookings b
JOIN destinations d ON d.id = b.destination_id
WHERE b.pure_premium > 100
ORDER BY b.pure_premium DESC;


-- 6. COMPONENT BREAKDOWN — for the single worst outlier
-- Shows each policy's frequency, trip_cost, and pure_premium
SELECT
  p.id            AS policy_id,
  p.booking_id,
  pr.name         AS product,
  round(p.trip_cost::numeric, 2)       AS trip_cost,
  round(p.base_frequency::numeric, 6)  AS frequency,
  round(p.pure_premium::numeric, 2)    AS policy_pp,
  -- implied severity = pure_premium / frequency (when frequency > 0)
  CASE WHEN p.base_frequency > 0
       THEN round((p.pure_premium / p.base_frequency)::numeric, 2)
       ELSE NULL
  END AS implied_severity
FROM policies p
JOIN products pr ON pr.id = p.product_id
WHERE p.booking_id = (
  SELECT id FROM bookings ORDER BY pure_premium DESC LIMIT 1
)
ORDER BY p.pure_premium DESC;
