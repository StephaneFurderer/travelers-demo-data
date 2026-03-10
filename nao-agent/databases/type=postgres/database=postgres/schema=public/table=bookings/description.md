# bookings

**Dataset:** `public`

## Table Metadata

| Property | Value |
|----------|-------|
| **Row Count** | 50,000 |
| **Column Count** | 11 |

## Description

Central fact table — one row per customer trip. Each booking belongs to one of three customer segments (winter_birds, holiday_travelers, baseline) and links to a destination. Contains trip dates (departure_date, return_date, num_nights), customer demographics (age, state_of_residence), coverage type, and the actuarial pure_premium (expected loss = sum of its policies' pure premiums). Use departure_date/return_date to determine if a traveler is "on the ground" during a given date range.
