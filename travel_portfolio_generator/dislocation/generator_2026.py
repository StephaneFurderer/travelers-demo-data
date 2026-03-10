"""2026 dislocated portfolio generator.

Policies carry 2025 model predictions (base_frequency, pure_premium),
but actual claims are generated from shifted 2026 GLM coefficients.
"""

import numpy as np
from datetime import date, timedelta

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from generators import PortfolioGenerator
from config import (
    FREQ_GLM, SEV_GLM, PRE_DEPARTURE_PROB, MAX_FREQUENCY,
    SEVERITY_NOISE_STD, CANCELLATION_COST_FACTOR, CANCELLATION_NOISE_STD,
    DELAY_LAMBDA, DELAY_MAX_DAYS, DELAY_COST_PER_DAY,
    INTERRUPTION_REMAINING_LOW, INTERRUPTION_REMAINING_HIGH,
    INTERRUPTION_COST_FACTOR, ADVANCE_PARAMS,
)
from dislocation.config_2026 import FREQ_GLM_2026, SEV_GLM_2026


class DislocatedPortfolioGenerator(PortfolioGenerator):
    """Generates 2026 bookings with 2025 model predictions but 2026 actual claims."""

    def __init__(self, rng: np.random.Generator, destinations: list[dict]):
        super().__init__(rng, destinations)
        # Build destination_id → destination_type lookup
        self._dest_type_by_id = {d["id"]: d["destination_type"] for d in destinations}

    # ── Override dates to use 2026 ──────────────────────────────────────────

    def _gen_dates(self, segment: str, departure_month: int):
        """Generate dates with purchase_date in 2026."""
        year = 2026

        if departure_month == 12:
            max_day = 31
        elif departure_month in (4, 6, 9, 11):
            max_day = 30
        elif departure_month == 2:
            max_day = 28
        else:
            max_day = 31
        dep_day = int(self.rng.integers(1, max_day + 1))
        departure_date = date(year, departure_month, dep_day)

        num_nights = self._gen_duration(segment)
        return_date = departure_date + timedelta(days=num_nights)

        ap = ADVANCE_PARAMS[segment]
        advance = self.rng.normal(ap["mean"], ap["std"])
        advance = int(np.clip(advance, ap["low"], ap["high"]))
        purchase_date = departure_date - timedelta(days=advance)
        if purchase_date < date(2026, 1, 1):
            purchase_date = date(2026, 1, 1)

        return purchase_date, departure_date, return_date, num_nights

    # ── 2026 actual frequency (shifted GLM) ─────────────────────────────────

    def _compute_frequency_2026(self, age: int, trip_cost: float, is_flight: bool,
                                 segment: str, state: str, departure_month: int,
                                 destination_type: str) -> float:
        """Compute claim probability using 2026 shifted coefficients."""
        log_lambda = FREQ_GLM_2026["intercept"]
        log_lambda += FREQ_GLM_2026["age"] * (age - 40) / 10
        log_lambda += FREQ_GLM_2026["log_trip_cost"] * np.log(max(trip_cost, 1))
        if is_flight:
            log_lambda += FREQ_GLM_2026["product_flight"]
        if segment == "holiday_travelers":
            log_lambda += FREQ_GLM_2026["segment_holiday"]
        elif segment == "baseline":
            log_lambda += FREQ_GLM_2026["segment_baseline"]

        state_key = f"state_{state}"
        log_lambda += FREQ_GLM_2026.get(state_key, 0.0)

        month_key = f"month_{departure_month}"
        log_lambda += FREQ_GLM_2026.get(month_key, 0.0)

        # New 2026 factor: destination type
        if destination_type == "caribbean":
            log_lambda += FREQ_GLM_2026["destination_caribbean"]

        return min(np.exp(log_lambda), MAX_FREQUENCY)

    # ── 2026 actual severity (shifted GLM) ──────────────────────────────────

    def _compute_severity_2026(self, age: int, trip_cost: float,
                                is_flight: bool, is_post_departure: bool) -> float:
        """Compute severity using 2026 shifted coefficients."""
        log_sev = SEV_GLM_2026["intercept"]
        log_sev += SEV_GLM_2026["age"] * (age - 40) / 10
        log_sev += SEV_GLM_2026["log_trip_cost"] * np.log(max(trip_cost, 1))
        if is_flight:
            log_sev += SEV_GLM_2026["product_flight"]
        if is_post_departure:
            log_sev += SEV_GLM_2026["post_departure"]
        noise = self.rng.normal(0, SEVERITY_NOISE_STD)
        return np.exp(log_sev + noise)

    # ── Generate claim using 2026 reality ───────────────────────────────────
    # Severity inflation factor: exp(5.62)/exp(5.5) ≈ 1.127 (12.7%)
    SEVERITY_INFLATION = np.exp(SEV_GLM_2026["intercept"]) / np.exp(5.5)

    def _gen_claim_2026(self, freq_2026: float, policy: dict, booking: dict,
                        purchase_date: date, departure_date: date,
                        return_date: date) -> dict | None:
        """Generate a claim using 2026 actual frequency + inflated severity."""
        if self.rng.random() >= freq_2026:
            return None

        is_pre = self.rng.random() < PRE_DEPARTURE_PROB
        trip_cost = policy["trip_cost"]

        if is_pre:
            claim_type = "pre_departure"
            claim_subtype = "cancellation"
            noise = 1 + self.rng.normal(0, CANCELLATION_NOISE_STD)
            amount = round(trip_cost * CANCELLATION_COST_FACTOR * max(noise, 0.5) * self.SEVERITY_INFLATION, 2)
            days_range = (departure_date - purchase_date).days
            if days_range <= 0:
                days_range = 1
            offset = int(self.rng.integers(0, days_range))
            claim_date = purchase_date + timedelta(days=offset)
            return {
                "claim_type": claim_type,
                "claim_subtype": claim_subtype,
                "claim_date": claim_date.isoformat(),
                "claim_amount": amount,
                "days_delayed": None,
                "hurricane_event_id": None,
            }
        else:
            claim_type = "post_departure"
            days_range = (return_date - departure_date).days
            if days_range <= 0:
                days_range = 1
            offset = int(self.rng.integers(0, days_range))
            claim_date = departure_date + timedelta(days=offset)

            if self.rng.random() < 0.5:
                claim_subtype = "trip_delay"
                days_delayed = min(int(self.rng.poisson(DELAY_LAMBDA) + 1), DELAY_MAX_DAYS)
                amount = round(DELAY_COST_PER_DAY * days_delayed * self.SEVERITY_INFLATION, 2)
                return {
                    "claim_type": claim_type,
                    "claim_subtype": claim_subtype,
                    "claim_date": claim_date.isoformat(),
                    "claim_amount": amount,
                    "days_delayed": days_delayed,
                    "hurricane_event_id": None,
                }
            else:
                claim_subtype = "trip_interruption"
                remaining_pct = self.rng.uniform(
                    INTERRUPTION_REMAINING_LOW, INTERRUPTION_REMAINING_HIGH
                )
                amount = round(trip_cost * remaining_pct * INTERRUPTION_COST_FACTOR * self.SEVERITY_INFLATION, 2)
                return {
                    "claim_type": claim_type,
                    "claim_subtype": claim_subtype,
                    "claim_date": claim_date.isoformat(),
                    "claim_amount": amount,
                    "days_delayed": None,
                    "hurricane_event_id": None,
                }

    # ── Override generate_booking ───────────────────────────────────────────

    def generate_booking(self, segment: str) -> tuple[dict, list[dict], list[dict]]:
        """Generate booking with 2025 model predictions but 2026 actual claims."""
        # Step 1: Generate booking + policies with 2025 predictions (via super)
        booking, policies, _claims_2025 = super().generate_booking(segment)

        # Step 2: Discard 2025 claims, regenerate with 2026 shifted reality
        dest_type = self._dest_type_by_id.get(booking["destination_id"], "us_atlantic")
        dep_month = int(booking["departure_date"].split("-")[1])
        purchase_date = date.fromisoformat(booking["purchase_date"])
        departure_date = date.fromisoformat(booking["departure_date"])
        return_date = date.fromisoformat(booking["return_date"])

        claims_2026 = []
        for pol_idx, pol in enumerate(policies):
            is_flight = pol["product_id"] == 2
            freq_2026 = self._compute_frequency_2026(
                booking["age"], pol["trip_cost"], is_flight,
                segment, booking["state_of_residence"], dep_month,
                dest_type
            )
            claim = self._gen_claim_2026(
                freq_2026, pol, booking,
                purchase_date, departure_date, return_date
            )
            if claim:
                claim["_policy_idx"] = pol_idx
                claims_2026.append(claim)

        return booking, policies, claims_2026
