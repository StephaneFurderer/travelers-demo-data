"""Configuration constants for travel insurance portfolio generation."""

import numpy as np

# ── Segment Definitions ──────────────────────────────────────────────────────

SEGMENTS = ["winter_birds", "holiday_travelers", "baseline"]

SEGMENT_BOOKING_COUNTS = {
    "winter_birds": 12_000,
    "holiday_travelers": 18_000,
    "baseline": 20_000,
}

# Coverage type probabilities per segment
COVERAGE_WEIGHTS = {
    "winter_birds":       {"hotel_only": 0.20, "flight_only": 0.10, "hotel_and_flight": 0.70},
    "holiday_travelers":  {"hotel_only": 0.15, "flight_only": 0.25, "hotel_and_flight": 0.60},
    "baseline":           {"hotel_only": 0.70, "flight_only": 0.10, "hotel_and_flight": 0.20},
}

# ── Departure Month Weights ──────────────────────────────────────────────────

MONTH_WEIGHTS = {
    "winter_birds": [0.20, 0.18, 0.12, 0.02, 0.01, 0.01,
                     0.01, 0.01, 0.02, 0.08, 0.15, 0.19],
    "holiday_travelers": [0.03, 0.04, 0.10, 0.08, 0.05, 0.12,
                          0.14, 0.10, 0.03, 0.04, 0.12, 0.15],
    "baseline": [0.06, 0.06, 0.08, 0.08, 0.09, 0.10,
                 0.11, 0.10, 0.08, 0.08, 0.08, 0.08],
}

# ── Age Distributions ────────────────────────────────────────────────────────

AGE_PARAMS = {
    "winter_birds":      {"mean": 67, "std": 8, "low": 50, "high": 85},
    "holiday_travelers": {"mean": 42, "std": 10, "low": 25, "high": 65},
    "baseline":          {"low": 25, "high": 70},  # uniform
}

# ── Trip Duration (nights) ───────────────────────────────────────────────────

DURATION_PARAMS = {
    "winter_birds":      {"mean": 30, "sigma": 0.5, "low": 14, "high": 56},
    "holiday_travelers": {"mean": 6, "sigma": 0.4, "low": 3, "high": 10},
    "baseline":          {"mean": 3.5, "sigma": 0.3, "low": 2, "high": 7},
}

# ── Advance Purchase (days before departure) ─────────────────────────────────

ADVANCE_PARAMS = {
    "winter_birds":      {"mean": 90, "std": 30, "low": 14, "high": 180},
    "holiday_travelers": {"mean": 60, "std": 25, "low": 7, "high": 150},
    "baseline":          {"mean": 30, "std": 20, "low": 3, "high": 120},
}

# ── States of Residence ──────────────────────────────────────────────────────

STATES = [
    "NY", "NJ", "CT", "MA", "PA", "OH", "MI", "IL", "MN", "WI",
    "FL", "TX", "CA", "GA", "VA", "NC", "CO", "AZ", "WA", "MD",
]

STATE_WEIGHTS = {
    "winter_birds": {
        "NY": 0.18, "MA": 0.10, "NJ": 0.10, "PA": 0.10, "CT": 0.08,
        "OH": 0.08, "MI": 0.08, "IL": 0.08, "MN": 0.06, "WI": 0.05,
        "FL": 0.01, "TX": 0.01, "CA": 0.01, "GA": 0.01, "VA": 0.01,
        "NC": 0.01, "CO": 0.01, "AZ": 0.01, "WA": 0.005, "MD": 0.005,
    },
    "holiday_travelers": {
        "CA": 0.12, "NY": 0.10, "TX": 0.10, "FL": 0.08, "IL": 0.08,
        "PA": 0.06, "NJ": 0.06, "MA": 0.05, "OH": 0.05, "GA": 0.05,
        "VA": 0.04, "NC": 0.04, "MI": 0.03, "CT": 0.03, "MD": 0.03,
        "CO": 0.02, "AZ": 0.02, "WA": 0.02, "MN": 0.01, "WI": 0.01,
    },
    "baseline": {s: 1.0 / len(STATES) for s in STATES},
}

# ── Origin Airports ──────────────────────────────────────────────────────────

STATE_AIRPORTS = {
    "NY": "JFK", "NJ": "EWR", "CT": "BDL", "MA": "BOS", "PA": "PHL",
    "OH": "CLE", "MI": "DTW", "IL": "ORD", "MN": "MSP", "WI": "MKE",
    "FL": "MIA", "TX": "DFW", "CA": "LAX", "GA": "ATL", "VA": "IAD",
    "NC": "CLT", "CO": "DEN", "AZ": "PHX", "WA": "SEA", "MD": "BWI",
}

# ── Destination Weights by Segment ───────────────────────────────────────────

DESTINATION_TYPE_WEIGHTS = {
    "winter_birds":      {"us_atlantic": 0.45, "gulf_coast": 0.30, "caribbean": 0.25},
    "holiday_travelers": {"us_atlantic": 0.25, "gulf_coast": 0.15, "caribbean": 0.60},
    "baseline":          {"us_atlantic": 0.40, "gulf_coast": 0.25, "caribbean": 0.35},
}

# ── Peak Season Definition ───────────────────────────────────────────────────

PEAK_MONTHS = {6, 7, 8, 11, 12, 1, 2, 3}  # summer + winter holidays

# ── Frequency GLM Coefficients ───────────────────────────────────────────────

FREQ_GLM = {
    "intercept": -4.5,
    "age": 0.02,              # per unit of (age - 40) / 10
    "log_trip_cost": 0.15,
    "product_flight": 0.25,
    "segment_holiday": 0.55,
    "segment_baseline": 0.90,
    # State effects (reference = PA)
    "state_NY": 0.18, "state_NJ": 0.18, "state_FL": 0.14,
    "state_CA": 0.10, "state_TX": 0.05, "state_CT": 0.10,
    "state_MA": 0.05, "state_MD": 0.0,
    "state_OH": -0.10, "state_MN": -0.16, "state_WI": -0.16,
    "state_MI": -0.10, "state_AZ": -0.10,
    "state_GA": -0.05, "state_VA": -0.05, "state_NC": -0.05,
    "state_CO": 0.0, "state_WA": -0.05, "state_IL": 0.0,
    # Month effects (reference = months not listed → 0)
    "month_6": 0.10, "month_7": 0.15, "month_8": 0.25,
    "month_9": 0.35, "month_10": 0.20, "month_11": 0.10,
}

# ── Severity GLM Coefficients ────────────────────────────────────────────────

SEV_GLM = {
    "intercept": 3.0,          # ~$20 base severity
    "age": 0.01,               # per unit of (age - 40) / 10
    "log_trip_cost": 0.40,
    "product_flight": -0.20,
    "post_departure": -0.30,
}

# ── Claim Parameters ─────────────────────────────────────────────────────────

SEVERITY_NOISE_STD = 0.30
MAX_FREQUENCY = 0.15        # cap claim probability at 15%

# ── Commercial Premium ──────────────────────────────────────────────────────

EXPENSE_LOAD_FACTOR = 1.11  # 11% expense load on top of pure premium

# ── Batch Insert Size ────────────────────────────────────────────────────────

BATCH_SIZE = 500
