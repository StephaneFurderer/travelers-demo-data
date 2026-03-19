"""2026 shifted GLM coefficients — the 'actual' reality that diverges from the 2025 model."""

# ── Frequency GLM — 2026 Actual ─────────────────────────────────────────────
# Changes vs 2025:
#   segment_baseline: 0.90 → 1.20 (baseline deteriorates)
#   segment_holiday:  0.55 → 0.60 (slight uptick)
#   month_8:          0.25 → 0.35 (extended hurricane season)
#   month_9:          0.35 → 0.65 (September worsens significantly)
#   month_10:         0.20 → 0.35 (October extends the pattern)
#   NEW: destination_caribbean: +0.25 (geographic risk the 2025 model misses)

FREQ_GLM_2026 = {
    "intercept": -4.5,
    "age": 0.02,
    "log_trip_cost": 0.15,
    "product_flight": 0.25,
    "segment_holiday": 0.60,
    "segment_baseline": 1.20,
    # State effects (unchanged)
    "state_NY": 0.18, "state_NJ": 0.18, "state_FL": 0.14,
    "state_CA": 0.10, "state_TX": 0.05, "state_CT": 0.10,
    "state_MA": 0.05, "state_MD": 0.0,
    "state_OH": -0.10, "state_MN": -0.16, "state_WI": -0.16,
    "state_MI": -0.10, "state_AZ": -0.10,
    "state_GA": -0.05, "state_VA": -0.05, "state_NC": -0.05,
    "state_CO": 0.0, "state_WA": -0.05, "state_IL": 0.0,
    # Month effects (shifted)
    "month_6": 0.10, "month_7": 0.15, "month_8": 0.35,
    "month_9": 0.65, "month_10": 0.35, "month_11": 0.10,
    # NEW: destination effect not in 2025 model
    "destination_caribbean": 0.25,
}

# ── Severity GLM — 2026 Actual ──────────────────────────────────────────────
# Changes vs 2025:
#   intercept:     3.0 → 3.05 (~5% base severity inflation)
#   log_trip_cost: 0.40 → 0.42 (mild trip-cost sensitivity increase)

SEV_GLM_2026 = {
    "intercept": 3.05,
    "age": 0.01,
    "log_trip_cost": 0.41,
    "product_flight": -0.20,
    "post_departure": -0.30,
}
