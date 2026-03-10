# claims

**Dataset:** `public`

## Table Metadata

| Property | Value |
|----------|-------|
| **Row Count** | 5,289 |
| **Column Count** | 8 |

## Description

Insurance claim events linked to policies. ~7% of policies generate a claim. Claims are either pre_departure (cancellation) or post_departure (trip_delay or trip_interruption). The claim_amount is the dollar payout. For trip_delay claims, days_delayed indicates the delay duration. Join to policies via policy_id, then to bookings via booking_id for segment/destination analysis.
