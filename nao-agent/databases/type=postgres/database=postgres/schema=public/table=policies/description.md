# policies

**Dataset:** `public`

## Table Metadata

| Property | Value |
|----------|-------|
| **Row Count** | 73,156 |
| **Column Count** | 12 |

## Description

One row per insured product — a booking with coverage_type='hotel_and_flight' creates two policy rows (Hotel product_id=1, Flight product_id=2). Contains trip_cost (insured dollar value), base_frequency (GLM-predicted claim probability), and pure_premium (expected loss). Hotel policies have price_per_night; Flight policies have flight_price, origin_airport, destination_airport. This is the primary table for exposure and loss ratio calculations.
