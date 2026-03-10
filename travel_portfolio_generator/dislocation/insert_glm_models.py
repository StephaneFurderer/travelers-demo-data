"""Create and populate the glm_models table in Supabase.

Usage:
    cd travel_portfolio_generator
    python -m dislocation.insert_glm_models
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import FREQ_GLM, SEV_GLM
from dislocation.config_2026 import FREQ_GLM_2026, SEV_GLM_2026
from dislocation.pg import get_pg_conn

FREQ_DESCRIPTIONS = {
    "intercept": "Poisson GLM intercept (log scale)",
    "age": "Age effect per unit of (age-40)/10 — older travelers claim more",
    "log_trip_cost": "Trip cost effect (log scale) — pricier trips claim more",
    "product_flight": "Flight product indicator — flight policies claim more than hotel",
    "segment_holiday": "Holiday travelers segment indicator vs winter_birds reference",
    "segment_baseline": "Baseline segment indicator vs winter_birds reference",
    "state_NY": "New York state effect vs PA reference",
    "state_NJ": "New Jersey state effect vs PA reference",
    "state_FL": "Florida state effect vs PA reference",
    "state_CA": "California state effect vs PA reference",
    "state_TX": "Texas state effect vs PA reference",
    "state_CT": "Connecticut state effect vs PA reference",
    "state_MA": "Massachusetts state effect vs PA reference",
    "state_MD": "Maryland state effect vs PA reference",
    "state_OH": "Ohio state effect vs PA reference",
    "state_MN": "Minnesota state effect vs PA reference",
    "state_WI": "Wisconsin state effect vs PA reference",
    "state_MI": "Michigan state effect vs PA reference",
    "state_AZ": "Arizona state effect vs PA reference",
    "state_GA": "Georgia state effect vs PA reference",
    "state_VA": "Virginia state effect vs PA reference",
    "state_NC": "North Carolina state effect vs PA reference",
    "state_CO": "Colorado state effect vs PA reference",
    "state_WA": "Washington state effect vs PA reference",
    "state_IL": "Illinois state effect vs PA reference",
    "month_6": "June departure month effect — early summer",
    "month_7": "July departure month effect — mid summer",
    "month_8": "August departure month effect — late summer / early hurricane",
    "month_9": "September departure month effect — peak hurricane season",
    "month_10": "October departure month effect — late hurricane season",
    "month_11": "November departure month effect — early winter",
    "destination_caribbean": "Caribbean destination effect — geographic risk factor (2026 only)",
}

SEV_DESCRIPTIONS = {
    "intercept": "Gamma GLM intercept (log scale) — base severity ~$245",
    "age": "Age effect per unit of (age-40)/10 — older claimants more severe",
    "log_trip_cost": "Trip cost effect (log scale) — most important severity driver",
    "product_flight": "Flight product indicator — flight claims less severe than hotel",
    "post_departure": "Post-departure indicator — post-departure claims less severe",
}


def main():
    print("── Connecting to Postgres directly ──")
    conn = get_pg_conn()
    conn.autocommit = True
    cur = conn.cursor()

    # Create table
    print("── Creating glm_models table ──")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS glm_models (
            id serial PRIMARY KEY,
            model_version text NOT NULL,
            model_type text NOT NULL,
            coefficient_name text NOT NULL,
            coefficient_value float NOT NULL,
            description text
        );
    """)
    cur.execute("DELETE FROM glm_models;")
    print("  ✓ Table ready")

    # Build and insert rows
    rows = []

    def add_rows(glm_dict, model_version, model_type, desc_dict):
        for name, value in glm_dict.items():
            rows.append((model_version, model_type, name, value, desc_dict.get(name, "")))

    add_rows(FREQ_GLM, "2025_v1", "frequency", FREQ_DESCRIPTIONS)
    add_rows(SEV_GLM, "2025_v1", "severity", SEV_DESCRIPTIONS)
    add_rows(FREQ_GLM_2026, "2026_actual", "frequency", FREQ_DESCRIPTIONS)
    add_rows(SEV_GLM_2026, "2026_actual", "severity", SEV_DESCRIPTIONS)

    print(f"\n── Inserting {len(rows)} coefficient rows ──")
    cur.executemany(
        "INSERT INTO glm_models (model_version, model_type, coefficient_name, coefficient_value, description) VALUES (%s, %s, %s, %s, %s)",
        rows
    )
    print(f"  ✓ {len(rows)} rows inserted")

    # Notify PostgREST to reload schema cache
    cur.execute("NOTIFY pgrst, 'reload schema';")
    print("  ✓ PostgREST schema cache reload requested")

    # Verify
    print("\n── Verification ──")
    cur.execute("SELECT model_version, model_type, COUNT(*) FROM glm_models GROUP BY 1, 2 ORDER BY 1, 2")
    for version, mtype, cnt in cur.fetchall():
        print(f"  {version} / {mtype}: {cnt} coefficients")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
