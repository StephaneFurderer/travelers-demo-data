"""A/E Diagnostics — verify 2025 and 2026 cohort metrics."""

import psycopg2
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "travel_portfolio_generator", ".env"))

conn = psycopg2.connect(
    host=os.environ["PG_HOST"], port=5432, dbname="postgres",
    user="postgres", password=os.environ["PG_PASS"]
)
cur = conn.cursor()

# ── 1. Overall A/E by cohort ─────────────────────────────────────────────
print("=" * 70)
print("1. OVERALL A/E BY COHORT")
print("=" * 70)
cur.execute("""
    SELECT
        CASE WHEN b.purchase_date < '2026-01-01' THEN '2025' ELSE '2026' END AS cohort,
        COUNT(DISTINCT p.id) AS policies,
        COUNT(c.id) AS claims,
        ROUND((COUNT(c.id)::numeric / COUNT(DISTINCT p.id)), 4) AS reported_freq,
        ROUND(SUM(p.pure_premium)::numeric, 2) AS total_pure_premium,
        ROUND(SUM(p.commercial_premium)::numeric, 2) AS total_commercial_premium,
        ROUND(COALESCE(SUM(c.claim_amount), 0)::numeric, 2) AS total_incurred,
        ROUND((COALESCE(SUM(c.claim_amount), 0) / NULLIF(SUM(p.pure_premium), 0))::numeric, 4) AS ae_ratio,
        ROUND((COALESCE(SUM(c.claim_amount), 0) / NULLIF(SUM(p.commercial_premium), 0) * 100)::numeric, 1) AS loss_ratio_pct
    FROM bookings b
    JOIN policies p ON p.booking_id = b.id
    LEFT JOIN claims c ON c.policy_id = p.id
    GROUP BY cohort
    ORDER BY cohort
""")
for row in cur.fetchall():
    cohort, policies, claims, freq, pp, cp, incurred, ae, lr = row
    print(f"\n  Cohort: {cohort}")
    print(f"    Policies:           {policies:>10,}")
    print(f"    Claims:             {claims:>10,}")
    print(f"    Reported frequency: {float(freq):>10.4f}")
    print(f"    Total pure premium: ${float(pp):>14,.2f}")
    print(f"    Total comm premium: ${float(cp):>14,.2f}")
    print(f"    Total incurred:     ${float(incurred):>14,.2f}")
    print(f"    A/E ratio:          {float(ae):>10.4f}")
    print(f"    Loss ratio (on CP): {float(lr):>9.1f}%")

# ── 2. How is pure_premium computed? ─────────────────────────────────────
print("\n" + "=" * 70)
print("2. PURE PREMIUM DECOMPOSITION (2025 cohort)")
print("   pure_premium = base_frequency × expected_loss")
print("=" * 70)
cur.execute("""
    SELECT
        ROUND(AVG(p.base_frequency)::numeric, 6) AS avg_freq,
        ROUND(AVG(p.expected_loss)::numeric, 2) AS avg_expected_loss,
        ROUND(AVG(p.pure_premium)::numeric, 2) AS avg_pure_premium,
        ROUND(AVG(p.commercial_premium)::numeric, 2) AS avg_commercial_premium,
        ROUND((AVG(p.commercial_premium) / NULLIF(AVG(p.pure_premium), 0))::numeric, 4) AS cp_pp_ratio
    FROM policies p
    JOIN bookings b ON b.id = p.booking_id
    WHERE b.purchase_date < '2026-01-01'
""")
row = cur.fetchone()
print(f"  Avg base_frequency:     {float(row[0]):.6f}")
print(f"  Avg expected_loss:      ${float(row[1]):,.2f}")
print(f"  Avg pure_premium:       ${float(row[2]):,.2f}")
print(f"  Avg commercial_premium: ${float(row[3]):,.2f}")
print(f"  CP/PP ratio:            {float(row[4]):.4f}")

# ── 3. What does a claim amount look like vs expected_loss? ──────────────
print("\n" + "=" * 70)
print("3. CLAIM AMOUNT vs EXPECTED LOSS (2025 cohort)")
print("   claim_amount should equal expected_loss for 2025")
print("=" * 70)
cur.execute("""
    SELECT
        COUNT(*) AS n_claims,
        ROUND(AVG(c.claim_amount)::numeric, 2) AS avg_claim,
        ROUND(AVG(p.expected_loss)::numeric, 2) AS avg_expected_loss_for_claimed,
        ROUND(AVG(c.claim_amount / NULLIF(p.expected_loss, 0))::numeric, 4) AS claim_to_expected_ratio,
        ROUND(MIN(c.claim_amount / NULLIF(p.expected_loss, 0))::numeric, 4) AS min_ratio,
        ROUND(MAX(c.claim_amount / NULLIF(p.expected_loss, 0))::numeric, 4) AS max_ratio
    FROM claims c
    JOIN policies p ON p.id = c.policy_id
    JOIN bookings b ON b.id = p.booking_id
    WHERE b.purchase_date < '2026-01-01'
""")
row = cur.fetchone()
print(f"  Claims: {row[0]:,}")
print(f"  Avg claim_amount:              ${float(row[1]):,.2f}")
print(f"  Avg expected_loss (claimants): ${float(row[2]):,.2f}")
print(f"  claim/expected ratio:          {float(row[3]):.4f}  (should be 1.0)")
print(f"  Min ratio: {float(row[4]):.4f}, Max ratio: {float(row[5]):.4f}")

# ── 4. A/E decomposition: frequency A/E × severity A/E ──────────────────
print("\n" + "=" * 70)
print("4. A/E DECOMPOSITION BY COHORT")
print("   A/E ≈ Frequency_A/E × Severity_A/E")
print("=" * 70)
cur.execute("""
    WITH cohort_stats AS (
        SELECT
            CASE WHEN b.purchase_date < '2026-01-01' THEN '2025' ELSE '2026' END AS cohort,
            COUNT(DISTINCT p.id) AS policies,
            COUNT(c.id) AS claims,
            SUM(p.base_frequency) AS expected_claims,
            COALESCE(AVG(c.claim_amount), 0) AS avg_actual_severity,
            AVG(p.expected_loss) AS avg_expected_severity
        FROM bookings b
        JOIN policies p ON p.booking_id = b.id
        LEFT JOIN claims c ON c.policy_id = p.id
        GROUP BY cohort
    )
    SELECT
        cohort,
        policies, claims,
        ROUND(expected_claims::numeric, 1) AS expected_claims,
        ROUND((claims / NULLIF(expected_claims, 0))::numeric, 4) AS freq_ae,
        ROUND(avg_actual_severity::numeric, 2) AS avg_actual_sev,
        ROUND(avg_expected_severity::numeric, 2) AS avg_expected_sev,
        ROUND((avg_actual_severity / NULLIF(avg_expected_severity, 0))::numeric, 4) AS sev_ae
    FROM cohort_stats
    ORDER BY cohort
""")
for row in cur.fetchall():
    cohort, policies, claims, exp_claims, freq_ae, avg_sev, avg_exp_sev, sev_ae = row
    print(f"\n  Cohort: {cohort}")
    print(f"    Actual claims:     {claims:>8,}")
    print(f"    Expected claims:   {float(exp_claims):>8,.1f}  (SUM of base_frequency)")
    print(f"    Frequency A/E:     {float(freq_ae):>8.4f}")
    print(f"    Avg actual sev:    ${float(avg_sev):>10,.2f}")
    print(f"    Avg expected sev:  ${float(avg_exp_sev):>10,.2f}")
    print(f"    Severity A/E:      {float(sev_ae):>8.4f}")
    print(f"    Combined:          {float(freq_ae) * float(sev_ae):>8.4f}")

# ── 5. A/E by segment ───────────────────────────────────────────────────
print("\n" + "=" * 70)
print("5. A/E BY SEGMENT (both cohorts)")
print("=" * 70)
cur.execute("""
    SELECT
        CASE WHEN b.purchase_date < '2026-01-01' THEN '2025' ELSE '2026' END AS cohort,
        b.segment,
        COUNT(DISTINCT p.id) AS policies,
        COUNT(c.id) AS claims,
        ROUND(SUM(p.pure_premium)::numeric, 2) AS pure_premium,
        ROUND(COALESCE(SUM(c.claim_amount), 0)::numeric, 2) AS incurred,
        ROUND((COALESCE(SUM(c.claim_amount), 0) / NULLIF(SUM(p.pure_premium), 0))::numeric, 4) AS ae_ratio
    FROM bookings b
    JOIN policies p ON p.booking_id = b.id
    LEFT JOIN claims c ON c.policy_id = p.id
    GROUP BY cohort, b.segment
    ORDER BY cohort, b.segment
""")
print(f"\n  {'Cohort':<8} {'Segment':<22} {'Policies':>10} {'Claims':>8} {'Pure Prem':>14} {'Incurred':>14} {'A/E':>8}")
print(f"  {'-'*8} {'-'*22} {'-'*10} {'-'*8} {'-'*14} {'-'*14} {'-'*8}")
for row in cur.fetchall():
    cohort, seg, pol, cl, pp, inc, ae = row
    print(f"  {cohort:<8} {seg:<22} {pol:>10,} {cl:>8,} ${float(pp):>13,.2f} ${float(inc):>13,.2f} {float(ae):>8.4f}")

# ── 6. Why is 2025 A/E close to 1.0? The math ───────────────────────────
print("\n" + "=" * 70)
print("6. WHY 2025 A/E ≈ 1.0 — THE MATH")
print("=" * 70)
print("""
  For 2025:
    - Each policy has base_frequency (GLM probability) and expected_loss (GLM severity)
    - pure_premium = base_frequency × expected_loss
    - A claim is generated with probability = base_frequency (Bernoulli draw)
    - If claim occurs, claim_amount = expected_loss (deterministic)

  So expected total incurred:
    E[incurred] = Σ base_frequency_i × expected_loss_i = Σ pure_premium_i

  And A/E = actual_incurred / Σ pure_premium

  By the law of large numbers with 73K policies, actual ≈ expected.
  A/E should be ~1.0 with small random variation (±2-3%).

  For 2026:
    - Policies still carry 2025 pure_premium (same GLM)
    - But claims use SHIFTED frequency (higher) and claim_amount = expected_loss × 1.127
    - So A/E > 1.0, driven by both frequency and severity inflation
""")

# ── 7. Sanity check: is there variance in the claim amounts? ─────────────
print("=" * 70)
print("7. CLAIM AMOUNT DISTRIBUTION (2025 cohort)")
print("=" * 70)
cur.execute("""
    SELECT
        ROUND(MIN(c.claim_amount)::numeric, 2) AS min_claim,
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY c.claim_amount)::numeric, 2) AS p25,
        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY c.claim_amount)::numeric, 2) AS median,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY c.claim_amount)::numeric, 2) AS p75,
        ROUND(MAX(c.claim_amount)::numeric, 2) AS max_claim,
        ROUND(STDDEV(c.claim_amount)::numeric, 2) AS std_dev
    FROM claims c
    JOIN policies p ON p.id = c.policy_id
    JOIN bookings b ON b.id = p.booking_id
    WHERE b.purchase_date < '2026-01-01'
""")
row = cur.fetchone()
print(f"  Min:    ${float(row[0]):>10,.2f}")
print(f"  P25:    ${float(row[1]):>10,.2f}")
print(f"  Median: ${float(row[2]):>10,.2f}")
print(f"  P75:    ${float(row[3]):>10,.2f}")
print(f"  Max:    ${float(row[4]):>10,.2f}")
print(f"  StdDev: ${float(row[5]):>10,.2f}")

cur.close()
conn.close()
