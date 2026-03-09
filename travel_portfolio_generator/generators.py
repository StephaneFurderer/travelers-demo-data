"""Core generation logic for bookings, policies, and claims."""

import numpy as np
from datetime import date, timedelta
from config import (
    COVERAGE_WEIGHTS, MONTH_WEIGHTS, AGE_PARAMS, DURATION_PARAMS,
    ADVANCE_PARAMS, STATE_WEIGHTS, STATE_AIRPORTS,
    DESTINATION_TYPE_WEIGHTS, PEAK_MONTHS,
    FREQ_GLM, SEV_GLM, PRE_DEPARTURE_PROB, MAX_FREQUENCY,
    SEVERITY_NOISE_STD, CANCELLATION_COST_FACTOR, CANCELLATION_NOISE_STD,
    DELAY_LAMBDA, DELAY_MAX_DAYS, DELAY_COST_PER_DAY,
    INTERRUPTION_REMAINING_LOW, INTERRUPTION_REMAINING_HIGH,
    INTERRUPTION_COST_FACTOR,
)


class PortfolioGenerator:
    """Generates bookings, policies, and claims for a given segment."""

    def __init__(self, rng: np.random.Generator, destinations: list[dict]):
        self.rng = rng
        self.destinations = destinations
        # Group destinations by type
        self.dest_by_type: dict[str, list[dict]] = {}
        for d in destinations:
            self.dest_by_type.setdefault(d["destination_type"], []).append(d)

    # ── Age ──────────────────────────────────────────────────────────────────

    def _gen_age(self, segment: str) -> int:
        p = AGE_PARAMS[segment]
        if "mean" in p:
            age = self.rng.normal(p["mean"], p["std"])
            return int(np.clip(age, p["low"], p["high"]))
        return int(self.rng.integers(p["low"], p["high"] + 1))

    # ── Departure month ──────────────────────────────────────────────────────

    def _gen_departure_month(self, segment: str) -> int:
        weights = MONTH_WEIGHTS[segment]
        return self.rng.choice(range(1, 13), p=weights)

    # ── State of residence ───────────────────────────────────────────────────

    def _gen_state(self, segment: str) -> str:
        sw = STATE_WEIGHTS[segment]
        states = list(sw.keys())
        probs = np.array([sw[s] for s in states], dtype=float)
        probs /= probs.sum()
        return self.rng.choice(states, p=probs)

    # ── Destination ──────────────────────────────────────────────────────────

    def _gen_destination(self, segment: str) -> dict:
        type_weights = DESTINATION_TYPE_WEIGHTS[segment]
        types = list(type_weights.keys())
        probs = [type_weights[t] for t in types]
        chosen_type = self.rng.choice(types, p=probs)
        candidates = self.dest_by_type[chosen_type]
        return candidates[self.rng.integers(len(candidates))]

    # ── Coverage type ────────────────────────────────────────────────────────

    def _gen_coverage(self, segment: str) -> str:
        cw = COVERAGE_WEIGHTS[segment]
        types = list(cw.keys())
        probs = [cw[t] for t in types]
        return self.rng.choice(types, p=probs)

    # ── Trip duration ────────────────────────────────────────────────────────

    def _gen_duration(self, segment: str) -> int:
        p = DURATION_PARAMS[segment]
        # lognormal parameterized by target mean
        log_mean = np.log(p["mean"])
        raw = self.rng.lognormal(log_mean, p["sigma"])
        return int(np.clip(round(raw), p["low"], p["high"]))

    # ── Dates ────────────────────────────────────────────────────────────────

    def _gen_dates(self, segment: str, departure_month: int):
        """Generate purchase_date, departure_date, return_date, num_nights."""
        year = 2025

        # Pick a departure day within the month
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

        # Advance purchase
        ap = ADVANCE_PARAMS[segment]
        advance = self.rng.normal(ap["mean"], ap["std"])
        advance = int(np.clip(advance, ap["low"], ap["high"]))
        purchase_date = departure_date - timedelta(days=advance)
        # Ensure purchase is in 2025
        if purchase_date < date(2025, 1, 1):
            purchase_date = date(2025, 1, 1)

        return purchase_date, departure_date, return_date, num_nights

    # ── Hotel cost ───────────────────────────────────────────────────────────

    def _gen_hotel_cost(self, dest: dict, departure_month: int, num_nights: int):
        base_rate = dest["avg_hotel_price_per_night"]
        seasonal = 1.0 + 0.3 * (1 if departure_month in PEAK_MONTHS else 0)
        noise = self.rng.uniform(0.85, 1.15)
        price_per_night = round(base_rate * seasonal * noise, 2)
        hotel_cost = round(price_per_night * num_nights, 2)
        return price_per_night, hotel_cost

    # ── Flight cost ──────────────────────────────────────────────────────────

    def _gen_flight_cost(self, dest: dict, departure_month: int, advance_days: int):
        is_caribbean = dest["destination_type"] == "caribbean"
        if is_caribbean:
            base_fare = self.rng.uniform(400, 900)
        else:
            base_fare = self.rng.uniform(200, 600)

        seasonal = 1.0 + 0.25 * (1 if departure_month in PEAK_MONTHS else 0)
        advance_discount = 1.0 - 0.15 * (min(advance_days, 180) / 180)
        flight_cost = round(base_fare * seasonal * advance_discount, 2)
        return flight_cost

    # ── GLM claim probability ────────────────────────────────────────────────

    def _compute_frequency(self, age: int, trip_cost: float, is_flight: bool,
                           segment: str, state: str, departure_month: int) -> float:
        log_lambda = FREQ_GLM["intercept"]
        log_lambda += FREQ_GLM["age"] * (age - 40) / 10
        log_lambda += FREQ_GLM["log_trip_cost"] * np.log(max(trip_cost, 1))
        if is_flight:
            log_lambda += FREQ_GLM["product_flight"]
        if segment == "holiday_travelers":
            log_lambda += FREQ_GLM["segment_holiday"]
        elif segment == "baseline":
            log_lambda += FREQ_GLM["segment_baseline"]

        state_key = f"state_{state}"
        log_lambda += FREQ_GLM.get(state_key, 0.0)

        month_key = f"month_{departure_month}"
        log_lambda += FREQ_GLM.get(month_key, 0.0)

        return min(np.exp(log_lambda), MAX_FREQUENCY)

    # ── GLM severity ─────────────────────────────────────────────────────────

    def _compute_severity(self, age: int, trip_cost: float,
                          is_flight: bool, is_post_departure: bool) -> float:
        log_sev = SEV_GLM["intercept"]
        log_sev += SEV_GLM["age"] * (age - 40) / 10
        log_sev += SEV_GLM["log_trip_cost"] * np.log(max(trip_cost, 1))
        if is_flight:
            log_sev += SEV_GLM["product_flight"]
        if is_post_departure:
            log_sev += SEV_GLM["post_departure"]
        noise = self.rng.normal(0, SEVERITY_NOISE_STD)
        return np.exp(log_sev + noise)

    def _compute_expected_severity(self, age: int, trip_cost: float,
                                   is_flight: bool) -> float:
        """E[severity] from the severity GLM — no noise, blended across
        claim types (30% pre-departure, 70% post-departure)."""
        log_sev_base = SEV_GLM["intercept"]
        log_sev_base += SEV_GLM["age"] * (age - 40) / 10
        log_sev_base += SEV_GLM["log_trip_cost"] * np.log(max(trip_cost, 1))
        if is_flight:
            log_sev_base += SEV_GLM["product_flight"]
        # For log-normal E[X] = exp(mu + sigma^2/2)
        half_var = (SEVERITY_NOISE_STD ** 2) / 2
        e_sev_pre = np.exp(log_sev_base + half_var)
        e_sev_post = np.exp(log_sev_base + SEV_GLM["post_departure"] + half_var)
        return PRE_DEPARTURE_PROB * e_sev_pre + (1 - PRE_DEPARTURE_PROB) * e_sev_post

    # ── Claim generation ─────────────────────────────────────────────────────

    def _gen_claim(self, policy: dict, booking: dict,
                   purchase_date: date, departure_date: date,
                   return_date: date) -> dict | None:
        freq = policy["base_frequency"]
        if self.rng.random() >= freq:
            return None

        is_pre = self.rng.random() < PRE_DEPARTURE_PROB
        trip_cost = policy["trip_cost"]
        is_flight = policy["product_id"] == 2

        if is_pre:
            # Pre-departure cancellation
            claim_type = "pre_departure"
            claim_subtype = "cancellation"
            noise = 1 + self.rng.normal(0, CANCELLATION_NOISE_STD)
            amount = round(trip_cost * CANCELLATION_COST_FACTOR * max(noise, 0.5), 2)
            # Claim date between purchase and departure
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
            # Post-departure: 50/50 delay vs interruption
            claim_type = "post_departure"
            days_range = (return_date - departure_date).days
            if days_range <= 0:
                days_range = 1
            offset = int(self.rng.integers(0, days_range))
            claim_date = departure_date + timedelta(days=offset)

            if self.rng.random() < 0.5:
                # Trip delay
                claim_subtype = "trip_delay"
                days_delayed = min(int(self.rng.poisson(DELAY_LAMBDA) + 1), DELAY_MAX_DAYS)
                amount = round(DELAY_COST_PER_DAY * days_delayed, 2)
                return {
                    "claim_type": claim_type,
                    "claim_subtype": claim_subtype,
                    "claim_date": claim_date.isoformat(),
                    "claim_amount": amount,
                    "days_delayed": days_delayed,
                    "hurricane_event_id": None,
                }
            else:
                # Trip interruption
                claim_subtype = "trip_interruption"
                remaining_pct = self.rng.uniform(
                    INTERRUPTION_REMAINING_LOW, INTERRUPTION_REMAINING_HIGH
                )
                amount = round(trip_cost * remaining_pct * INTERRUPTION_COST_FACTOR, 2)
                return {
                    "claim_type": claim_type,
                    "claim_subtype": claim_subtype,
                    "claim_date": claim_date.isoformat(),
                    "claim_amount": amount,
                    "days_delayed": None,
                    "hurricane_event_id": None,
                }

    # ── Generate one booking + its policies + claims ─────────────────────────

    def generate_booking(self, segment: str) -> tuple[dict, list[dict], list[dict]]:
        """Returns (booking_dict, list_of_policy_dicts, list_of_claim_dicts).

        IDs are not set here — they are assigned after DB insert.
        """
        age = self._gen_age(segment)
        state = self._gen_state(segment)
        dest = self._gen_destination(segment)
        coverage = self._gen_coverage(segment)
        dep_month = self._gen_departure_month(segment)
        purchase_date, departure_date, return_date, num_nights = self._gen_dates(
            segment, dep_month
        )
        advance_days = (departure_date - purchase_date).days

        booking = {
            "segment": segment,
            "destination_id": dest["id"],
            "age": age,
            "state_of_residence": state,
            "purchase_date": purchase_date.isoformat(),
            "departure_date": departure_date.isoformat(),
            "return_date": return_date.isoformat(),
            "num_nights": num_nights,
            "coverage_type": coverage,
        }

        policies = []
        claims = []

        # Determine which products to create
        has_hotel = coverage in ("hotel_only", "hotel_and_flight")
        has_flight = coverage in ("flight_only", "hotel_and_flight")

        if has_hotel:
            ppn, hotel_cost = self._gen_hotel_cost(dest, dep_month, num_nights)
            freq = self._compute_frequency(
                age, hotel_cost, False, segment, state, dep_month
            )
            e_sev = self._compute_expected_severity(age, hotel_cost, False)
            pp = round(freq * e_sev, 2)
            hotel_policy = {
                "product_id": 1,
                "trip_cost": hotel_cost,
                "price_per_night": ppn,
                "flight_price": None,
                "origin_airport": None,
                "destination_airport": None,
                "outbound_flight_date": None,
                "return_flight_date": None,
                "base_frequency": round(freq, 6),
                "pure_premium": pp,
            }
            policies.append(hotel_policy)

            claim = self._gen_claim(hotel_policy, booking,
                                    purchase_date, departure_date, return_date)
            if claim:
                claim["_policy_idx"] = len(policies) - 1
                claims.append(claim)

        if has_flight:
            flight_cost = self._gen_flight_cost(dest, dep_month, advance_days)
            origin = STATE_AIRPORTS.get(state, "JFK")
            dest_airport = dest["airport_code"]
            freq = self._compute_frequency(
                age, flight_cost, True, segment, state, dep_month
            )
            e_sev = self._compute_expected_severity(age, flight_cost, True)
            pp = round(freq * e_sev, 2)
            flight_policy = {
                "product_id": 2,
                "trip_cost": flight_cost,
                "price_per_night": None,
                "flight_price": flight_cost,
                "origin_airport": origin,
                "destination_airport": dest_airport,
                "outbound_flight_date": departure_date.isoformat(),
                "return_flight_date": return_date.isoformat(),
                "base_frequency": round(freq, 6),
                "pure_premium": pp,
            }
            policies.append(flight_policy)

            claim = self._gen_claim(flight_policy, booking,
                                    purchase_date, departure_date, return_date)
            if claim:
                claim["_policy_idx"] = len(policies) - 1
                claims.append(claim)

        booking["pure_premium"] = round(sum(p["pure_premium"] for p in policies), 2)

        return booking, policies, claims
