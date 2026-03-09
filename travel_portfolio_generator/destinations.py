"""Destination reference data with coordinates and baseline hotel rates."""

DESTINATIONS = [
    # ── US Atlantic Coast ────────────────────────────────────────────────────
    {"city": "Miami Beach",      "state_or_country": "FL",  "lat": 25.7907, "lon": -80.1300, "airport": "MIA", "type": "us_atlantic", "rate": 280},
    {"city": "Fort Lauderdale",  "state_or_country": "FL",  "lat": 26.1224, "lon": -80.1373, "airport": "FLL", "type": "us_atlantic", "rate": 250},
    {"city": "Key West",         "state_or_country": "FL",  "lat": 24.5551, "lon": -81.7800, "airport": "EYW", "type": "us_atlantic", "rate": 320},
    {"city": "Naples",           "state_or_country": "FL",  "lat": 26.1420, "lon": -81.7948, "airport": "RSW", "type": "us_atlantic", "rate": 270},
    {"city": "Tampa",            "state_or_country": "FL",  "lat": 27.9506, "lon": -82.4572, "airport": "TPA", "type": "us_atlantic", "rate": 200},
    {"city": "Jacksonville",     "state_or_country": "FL",  "lat": 30.3322, "lon": -81.6557, "airport": "JAX", "type": "us_atlantic", "rate": 170},
    {"city": "Savannah",         "state_or_country": "GA",  "lat": 32.0809, "lon": -81.0912, "airport": "SAV", "type": "us_atlantic", "rate": 190},
    {"city": "Charleston",       "state_or_country": "SC",  "lat": 32.7765, "lon": -79.9311, "airport": "CHS", "type": "us_atlantic", "rate": 220},
    {"city": "Myrtle Beach",     "state_or_country": "SC",  "lat": 33.6891, "lon": -78.8867, "airport": "MYR", "type": "us_atlantic", "rate": 180},
    {"city": "Outer Banks",      "state_or_country": "NC",  "lat": 35.5585, "lon": -75.4665, "airport": "OGX", "type": "us_atlantic", "rate": 200},
    {"city": "Virginia Beach",   "state_or_country": "VA",  "lat": 36.8529, "lon": -75.9780, "airport": "ORF", "type": "us_atlantic", "rate": 180},
    {"city": "Ocean City",       "state_or_country": "MD",  "lat": 38.3365, "lon": -75.0849, "airport": "SBY", "type": "us_atlantic", "rate": 175},
    {"city": "Atlantic City",    "state_or_country": "NJ",  "lat": 39.3643, "lon": -74.4229, "airport": "ACY", "type": "us_atlantic", "rate": 190},
    {"city": "The Hamptons",     "state_or_country": "NY",  "lat": 40.9632, "lon": -72.1845, "airport": "ISP", "type": "us_atlantic", "rate": 350},

    # ── US Gulf Coast ────────────────────────────────────────────────────────
    {"city": "Galveston",          "state_or_country": "TX",  "lat": 29.3013, "lon": -94.7977, "airport": "IAH", "type": "gulf_coast", "rate": 170},
    {"city": "South Padre Island", "state_or_country": "TX",  "lat": 26.1118, "lon": -97.1681, "airport": "BRO", "type": "gulf_coast", "rate": 185},
    {"city": "Gulf Shores",        "state_or_country": "AL",  "lat": 30.2460, "lon": -87.7008, "airport": "PNS", "type": "gulf_coast", "rate": 175},
    {"city": "Pensacola",          "state_or_country": "FL",  "lat": 30.4213, "lon": -87.2169, "airport": "PNS", "type": "gulf_coast", "rate": 165},
    {"city": "Panama City Beach",  "state_or_country": "FL",  "lat": 30.1766, "lon": -85.8055, "airport": "ECP", "type": "gulf_coast", "rate": 180},
    {"city": "New Orleans",        "state_or_country": "LA",  "lat": 29.9511, "lon": -90.0715, "airport": "MSY", "type": "gulf_coast", "rate": 210},

    # ── Caribbean ────────────────────────────────────────────────────────────
    {"city": "San Juan",         "state_or_country": "PR",       "lat": 18.4655, "lon": -66.1057, "airport": "SJU", "type": "caribbean", "rate": 250},
    {"city": "Ponce",            "state_or_country": "PR",       "lat": 18.0111, "lon": -66.6141, "airport": "PSE", "type": "caribbean", "rate": 200},
    {"city": "St. Thomas",       "state_or_country": "USVI",     "lat": 18.3358, "lon": -64.9307, "airport": "STT", "type": "caribbean", "rate": 300},
    {"city": "St. Croix",        "state_or_country": "USVI",     "lat": 17.7290, "lon": -64.7345, "airport": "STX", "type": "caribbean", "rate": 275},
    {"city": "Nassau",           "state_or_country": "Bahamas",  "lat": 25.0480, "lon": -77.3554, "airport": "NAS", "type": "caribbean", "rate": 320},
    {"city": "Freeport",         "state_or_country": "Bahamas",  "lat": 26.5285, "lon": -78.6967, "airport": "FPO", "type": "caribbean", "rate": 260},
    {"city": "Punta Cana",       "state_or_country": "DR",       "lat": 18.5601, "lon": -68.3725, "airport": "PUJ", "type": "caribbean", "rate": 350},
    {"city": "Santo Domingo",    "state_or_country": "DR",       "lat": 18.4861, "lon": -69.9312, "airport": "SDQ", "type": "caribbean", "rate": 220},
    {"city": "Montego Bay",      "state_or_country": "Jamaica",  "lat": 18.4762, "lon": -77.8939, "airport": "MBJ", "type": "caribbean", "rate": 310},
    {"city": "Cancún",           "state_or_country": "Mexico",   "lat": 21.1619, "lon": -86.8515, "airport": "CUN", "type": "caribbean", "rate": 280},
    {"city": "Playa del Carmen", "state_or_country": "Mexico",   "lat": 20.6296, "lon": -87.0739, "airport": "CUN", "type": "caribbean", "rate": 250},
    {"city": "Cozumel",          "state_or_country": "Mexico",   "lat": 20.4318, "lon": -86.9223, "airport": "CZM", "type": "caribbean", "rate": 240},
    {"city": "Grand Cayman",     "state_or_country": "Cayman Islands", "lat": 19.3133, "lon": -81.2546, "airport": "GCM", "type": "caribbean", "rate": 380},
    {"city": "Turks & Caicos",   "state_or_country": "Turks and Caicos", "lat": 21.7940, "lon": -72.1719, "airport": "PLS", "type": "caribbean", "rate": 400},
    {"city": "St. Maarten",      "state_or_country": "St. Maarten", "lat": 18.0425, "lon": -63.0548, "airport": "SXM", "type": "caribbean", "rate": 330},
    {"city": "Aruba",            "state_or_country": "Aruba",    "lat": 12.5093, "lon": -69.9688, "airport": "AUA", "type": "caribbean", "rate": 350},
    {"city": "Barbados",         "state_or_country": "Barbados", "lat": 13.1939, "lon": -59.5432, "airport": "BGI", "type": "caribbean", "rate": 300},
    {"city": "Bermuda",          "state_or_country": "Bermuda",  "lat": 32.3078, "lon": -64.7505, "airport": "BDA", "type": "caribbean", "rate": 420},
]


def get_destinations_for_db():
    """Return list of dicts ready for Supabase insert."""
    return [
        {
            "city": d["city"],
            "state_or_country": d["state_or_country"],
            "latitude": d["lat"],
            "longitude": d["lon"],
            "airport_code": d["airport"],
            "destination_type": d["type"],
            "avg_hotel_price_per_night": d["rate"],
        }
        for d in DESTINATIONS
    ]
