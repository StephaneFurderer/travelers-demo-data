"""Compute dislocation analysis metrics and store in Supabase.

Computes A/E ratios, heatmaps, YoY comparisons, and rate adequacy
using segment-specific 2025 baselines. Results are stored in a
`dislocation_analysis` table for dashboard and Nao agent consumption.

Usage:
    cd travel_portfolio_generator
    python -m dislocation.analysis
"""

import sys
import os
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dislocation.pg import get_pg_conn


def get_conn():
    return get_pg_conn()


def compute_baselines(cur):
    """Compute 2025 baselines: loss per policy by segment and overall."""
    cur.execute("""
        SELECT b.segment,
            COUNT(p.id) AS policies,
            COUNT(c.id) AS claims,
            SUM(COALESCE(c.claim_amount, 0)) AS total_loss,
            SUM(p.pure_premium) AS total_pure_premium,
            CASE WHEN COUNT(c.id) > 0 THEN SUM(c.claim_amount) / COUNT(c.id) ELSE 0 END AS avg_severity
        FROM bookings b
        JOIN policies p ON p.booking_id = b.id
        LEFT JOIN claims c ON c.policy_id = p.id
        WHERE b.purchase_date < '2026-01-01'
        GROUP BY b.segment
    """)
    baselines = {}
    total_loss_all = 0
    total_pp_all = 0
    total_policies_all = 0
    for seg, policies, claims, total_loss, total_pp, avg_sev in cur.fetchall():
        baselines[seg] = {
            "policies": policies,
            "claims": claims,
            "total_loss": float(total_loss),
            "total_pure_premium": float(total_pp),
            "loss_per_policy": float(total_loss) / policies if policies else 0,
            "frequency": claims / policies if policies else 0,
            "avg_severity": float(avg_sev),
        }
        total_loss_all += float(total_loss)
        total_pp_all += float(total_pp)
        total_policies_all += policies

    baselines["_overall"] = {
        "policies": total_policies_all,
        "total_loss": total_loss_all,
        "total_pure_premium": total_pp_all,
        "loss_per_policy": total_loss_all / total_policies_all if total_policies_all else 0,
    }
    return baselines


def compute_segment_ae(cur, baselines):
    """A/E by segment for 2026, using segment-specific 2025 baselines."""
    cur.execute("""
        SELECT b.segment,
            COUNT(p.id) AS policies,
            COUNT(c.id) AS claims,
            SUM(COALESCE(c.claim_amount, 0)) AS total_loss,
            SUM(p.base_frequency) AS freq_expected,
            CASE WHEN COUNT(c.id) > 0 THEN SUM(c.claim_amount) / COUNT(c.id) ELSE 0 END AS avg_severity
        FROM bookings b
        JOIN policies p ON p.booking_id = b.id
        LEFT JOIN claims c ON c.policy_id = p.id
        WHERE b.purchase_date >= '2026-01-01'
        GROUP BY b.segment
        ORDER BY b.segment
    """)
    results = []
    for seg, policies, claims, total_loss, freq_exp, avg_sev in cur.fetchall():
        lpp_2026 = float(total_loss) / policies if policies else 0
        lpp_2025 = baselines[seg]["loss_per_policy"]
        ae = lpp_2026 / lpp_2025 if lpp_2025 > 0 else 0
        freq_ae = claims / float(freq_exp) if freq_exp else 0
        sev_ae = float(avg_sev) / baselines[seg]["avg_severity"] if baselines[seg]["avg_severity"] > 0 else 0

        bl = baselines[seg]
        results.append({
            "dimension": seg,
            "dimension_type": "segment",
            "policies_2025": bl["policies"],
            "claims_2025": bl["claims"],
            "total_loss_2025": round(bl["total_loss"], 2),
            "total_loss_2025_expected": round(bl["total_pure_premium"], 2),
            "policies_2026": policies,
            "claims_2026": claims,
            "total_loss_2026": round(float(total_loss), 2),
            "loss_per_policy_2026": round(lpp_2026, 2),
            "loss_per_policy_2025": round(lpp_2025, 2),
            "ae_ratio": round(ae, 4),
            "freq_ae": round(freq_ae, 4),
            "sev_ae": round(sev_ae, 4),
            "frequency_2025": round(bl["frequency"], 4),
            "frequency_2026": round(claims / policies, 4) if policies else 0,
            "avg_severity_2025": round(bl["avg_severity"], 2),
            "avg_severity_2026": round(float(avg_sev), 2),
        })
    return results


def compute_destination_ae(cur, baselines):
    """A/E by destination type for 2026."""
    # First get 2025 baselines by dest type
    cur.execute("""
        SELECT d.destination_type,
            COUNT(p.id) AS policies, COUNT(c.id) AS claims,
            SUM(COALESCE(c.claim_amount, 0)) AS total_loss,
            CASE WHEN COUNT(c.id) > 0 THEN SUM(c.claim_amount) / COUNT(c.id) ELSE 0 END AS avg_sev
        FROM bookings b
        JOIN destinations d ON b.destination_id = d.id
        JOIN policies p ON p.booking_id = b.id
        LEFT JOIN claims c ON c.policy_id = p.id
        WHERE b.purchase_date < '2026-01-01'
        GROUP BY d.destination_type
    """)
    dest_baselines = {}
    for dt, pol, cl, loss, sev in cur.fetchall():
        dest_baselines[dt] = {
            "loss_per_policy": float(loss) / pol if pol else 0,
            "frequency": cl / pol if pol else 0,
            "avg_severity": float(sev),
        }

    # 2026
    cur.execute("""
        SELECT d.destination_type,
            COUNT(p.id) AS policies, COUNT(c.id) AS claims,
            SUM(COALESCE(c.claim_amount, 0)) AS total_loss,
            SUM(p.base_frequency) AS freq_expected,
            CASE WHEN COUNT(c.id) > 0 THEN SUM(c.claim_amount) / COUNT(c.id) ELSE 0 END AS avg_sev
        FROM bookings b
        JOIN destinations d ON b.destination_id = d.id
        JOIN policies p ON p.booking_id = b.id
        LEFT JOIN claims c ON c.policy_id = p.id
        WHERE b.purchase_date >= '2026-01-01'
        GROUP BY d.destination_type
        ORDER BY d.destination_type
    """)
    results = []
    for dt, policies, claims, total_loss, freq_exp, avg_sev in cur.fetchall():
        bl = dest_baselines.get(dt, {"loss_per_policy": 0, "frequency": 0, "avg_severity": 0})
        lpp_2026 = float(total_loss) / policies if policies else 0
        ae = lpp_2026 / bl["loss_per_policy"] if bl["loss_per_policy"] > 0 else 0
        freq_ae = claims / float(freq_exp) if freq_exp else 0
        sev_ae = float(avg_sev) / bl["avg_severity"] if bl["avg_severity"] > 0 else 0

        results.append({
            "dimension": dt,
            "dimension_type": "destination_type",
            "policies_2026": policies,
            "claims_2026": claims,
            "total_loss_2026": round(float(total_loss), 2),
            "loss_per_policy_2026": round(lpp_2026, 2),
            "loss_per_policy_2025": round(bl["loss_per_policy"], 2),
            "ae_ratio": round(ae, 4),
            "freq_ae": round(freq_ae, 4),
            "sev_ae": round(sev_ae, 4),
            "frequency_2025": round(bl["frequency"], 4),
            "frequency_2026": round(claims / policies, 4) if policies else 0,
            "avg_severity_2025": round(bl["avg_severity"], 2),
            "avg_severity_2026": round(float(avg_sev), 2),
        })
    return results


def compute_heatmap(cur, baselines):
    """A/E heatmap: segment × departure month for 2026."""
    # 2025 baselines by segment × month
    cur.execute("""
        SELECT b.segment, EXTRACT(MONTH FROM b.departure_date)::int AS dep_month,
            COUNT(p.id) AS policies, COUNT(c.id) AS claims,
            SUM(COALESCE(c.claim_amount, 0)) AS total_loss
        FROM bookings b
        JOIN policies p ON p.booking_id = b.id
        LEFT JOIN claims c ON c.policy_id = p.id
        WHERE b.purchase_date < '2026-01-01'
        GROUP BY b.segment, dep_month
    """)
    cell_baselines = {}
    for seg, month, pol, cl, loss in cur.fetchall():
        lpp = float(loss) / pol if pol else 0
        cell_baselines[(seg, int(month))] = lpp

    # 2026
    cur.execute("""
        SELECT b.segment, EXTRACT(MONTH FROM b.departure_date)::int AS dep_month,
            COUNT(p.id) AS policies, COUNT(c.id) AS claims,
            SUM(COALESCE(c.claim_amount, 0)) AS total_loss,
            SUM(p.base_frequency) AS freq_expected
        FROM bookings b
        JOIN policies p ON p.booking_id = b.id
        LEFT JOIN claims c ON c.policy_id = p.id
        WHERE b.purchase_date >= '2026-01-01'
        GROUP BY b.segment, dep_month
        ORDER BY b.segment, dep_month
    """)
    results = []
    for seg, month, policies, claims, total_loss, freq_exp in cur.fetchall():
        month = int(month)
        lpp_2026 = float(total_loss) / policies if policies else 0
        lpp_2025 = cell_baselines.get((seg, month), 0)
        ae = lpp_2026 / lpp_2025 if lpp_2025 > 0 else 0
        freq_ae = claims / float(freq_exp) if freq_exp else 0

        results.append({
            "segment": seg,
            "month": month,
            "policies": policies,
            "claims": claims,
            "total_loss": round(float(total_loss), 2),
            "ae_ratio": round(ae, 4),
            "freq_ae": round(freq_ae, 4),
            "frequency_2026": round(claims / policies, 4) if policies else 0,
        })
    return results


def compute_overall(cur, baselines):
    """Overall portfolio A/E for 2026."""
    cur.execute("""
        SELECT COUNT(p.id), COUNT(c.id), SUM(COALESCE(c.claim_amount, 0)),
            SUM(p.base_frequency),
            CASE WHEN COUNT(c.id) > 0 THEN SUM(c.claim_amount) / COUNT(c.id) ELSE 0 END
        FROM bookings b
        JOIN policies p ON p.booking_id = b.id
        LEFT JOIN claims c ON c.policy_id = p.id
        WHERE b.purchase_date >= '2026-01-01'
    """)
    policies, claims, total_loss, freq_exp, avg_sev = cur.fetchone()
    lpp_2026 = float(total_loss) / policies if policies else 0
    lpp_2025 = baselines["_overall"]["loss_per_policy"]
    ae = lpp_2026 / lpp_2025 if lpp_2025 > 0 else 0
    freq_ae = claims / float(freq_exp) if freq_exp else 0

    return {
        "policies_2026": policies,
        "claims_2026": claims,
        "total_loss_2026": round(float(total_loss), 2),
        "ae_ratio": round(ae, 4),
        "freq_ae": round(freq_ae, 4),
        "frequency_2026": round(claims / policies, 4) if policies else 0,
        "avg_severity_2026": round(float(avg_sev), 2),
    }


def store_results(cur, overall, segment_ae, dest_ae, heatmap):
    """Store all results in dislocation_analysis table."""
    cur.execute("""
        CREATE TABLE IF NOT EXISTS dislocation_analysis (
            id serial PRIMARY KEY,
            analysis_type text NOT NULL,
            dimension text,
            dimension_type text,
            month int,
            metrics jsonb NOT NULL,
            computed_at timestamp DEFAULT now()
        );
    """)
    cur.execute("DELETE FROM dislocation_analysis;")

    # Overall
    cur.execute(
        "INSERT INTO dislocation_analysis (analysis_type, metrics) VALUES (%s, %s)",
        ("overall", json.dumps(overall))
    )

    # Segment A/E
    for row in segment_ae:
        cur.execute(
            "INSERT INTO dislocation_analysis (analysis_type, dimension, dimension_type, metrics) VALUES (%s, %s, %s, %s)",
            ("ae_by_dimension", row["dimension"], row["dimension_type"], json.dumps(row))
        )

    # Destination A/E
    for row in dest_ae:
        cur.execute(
            "INSERT INTO dislocation_analysis (analysis_type, dimension, dimension_type, metrics) VALUES (%s, %s, %s, %s)",
            ("ae_by_dimension", row["dimension"], row["dimension_type"], json.dumps(row))
        )

    # Heatmap
    for row in heatmap:
        cur.execute(
            "INSERT INTO dislocation_analysis (analysis_type, dimension, dimension_type, month, metrics) VALUES (%s, %s, %s, %s, %s)",
            ("heatmap", row["segment"], "segment", row["month"], json.dumps(row))
        )

    # Notify PostgREST
    cur.execute("NOTIFY pgrst, 'reload schema';")


def main():
    conn = get_conn()
    conn.autocommit = True
    cur = conn.cursor()

    print("── Computing 2025 baselines ──")
    baselines = compute_baselines(cur)
    for seg, bl in baselines.items():
        if seg == "_overall":
            print(f"  OVERALL: lpp=${bl['loss_per_policy']:.2f}")
        else:
            print(f"  {seg:25s}: lpp=${bl['loss_per_policy']:.2f}, freq={bl['frequency']:.4f}, avg_sev=${bl['avg_severity']:.0f}")

    print("\n── Computing 2026 A/E by segment ──")
    segment_ae = compute_segment_ae(cur, baselines)
    for row in segment_ae:
        adequacy = "ADEQUATE" if row["ae_ratio"] <= 1.05 else "WATCH" if row["ae_ratio"] <= 1.20 else "INADEQUATE"
        print(f"  {row['dimension']:25s}: A/E={row['ae_ratio']:.3f} (freq={row['freq_ae']:.3f}, sev={row['sev_ae']:.3f}) [{adequacy}]")

    print("\n── Computing 2026 A/E by destination type ──")
    dest_ae = compute_destination_ae(cur, baselines)
    for row in dest_ae:
        adequacy = "ADEQUATE" if row["ae_ratio"] <= 1.05 else "WATCH" if row["ae_ratio"] <= 1.20 else "INADEQUATE"
        print(f"  {row['dimension']:25s}: A/E={row['ae_ratio']:.3f} (freq={row['freq_ae']:.3f}, sev={row['sev_ae']:.3f}) [{adequacy}]")

    print("\n── Computing heatmap ──")
    heatmap = compute_heatmap(cur, baselines)
    month_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    # Show worst cells
    worst = sorted(heatmap, key=lambda x: x["ae_ratio"], reverse=True)[:5]
    print("  Top 5 hottest cells:")
    for cell in worst:
        print(f"    {cell['segment']:20s} × {month_names[cell['month']]:3s}: A/E={cell['ae_ratio']:.3f}")

    print("\n── Computing overall ──")
    overall = compute_overall(cur, baselines)
    print(f"  Portfolio A/E: {overall['ae_ratio']:.3f}")
    print(f"  Frequency A/E: {overall['freq_ae']:.3f}")
    print(f"  2026 claims: {overall['claims_2026']:,}, policies: {overall['policies_2026']:,}")

    print("\n── Storing results ──")
    store_results(cur, overall, segment_ae, dest_ae, heatmap)
    count_result = cur.execute("SELECT COUNT(*) FROM dislocation_analysis")
    cur.execute("SELECT COUNT(*) FROM dislocation_analysis")
    count = cur.fetchone()[0]
    print(f"  ✓ {count} rows stored in dislocation_analysis")

    # Rate adequacy summary
    print("\n" + "=" * 60)
    print("RATE ADEQUACY SUMMARY")
    print("=" * 60)
    all_dims = segment_ae + dest_ae
    for row in sorted(all_dims, key=lambda x: x["ae_ratio"], reverse=True):
        label = row["dimension"].replace("_", " ").title()
        ae = row["ae_ratio"]
        rec = f"+{(ae - 1) * 100:.1f}%" if ae > 1.0 else "—"
        adequacy = "✓" if ae <= 1.05 else "⚠" if ae <= 1.20 else "✗"
        print(f"  {adequacy} {label:25s}: A/E={ae:.3f}  Rec: {rec}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
