-- Travel Insurance Portfolio Generator Schema
-- Run this in the Supabase SQL Editor before running generate.py

DROP TABLE IF EXISTS claims CASCADE;
DROP TABLE IF EXISTS policies CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS destinations CASCADE;
DROP TABLE IF EXISTS products CASCADE;

CREATE TABLE products (
    id serial PRIMARY KEY,
    name text NOT NULL,
    description text
);

CREATE TABLE destinations (
    id serial PRIMARY KEY,
    city text NOT NULL,
    state_or_country text NOT NULL,
    latitude float NOT NULL,
    longitude float NOT NULL,
    airport_code text NOT NULL,
    destination_type text NOT NULL CHECK (destination_type IN ('us_atlantic', 'gulf_coast', 'caribbean')),
    avg_hotel_price_per_night float NOT NULL
);

CREATE TABLE bookings (
    id serial PRIMARY KEY,
    segment text NOT NULL CHECK (segment IN ('winter_birds', 'holiday_travelers', 'baseline')),
    destination_id int NOT NULL REFERENCES destinations(id),
    age int NOT NULL,
    state_of_residence text NOT NULL,
    purchase_date date NOT NULL,
    departure_date date NOT NULL,
    return_date date NOT NULL,
    num_nights int NOT NULL,
    coverage_type text NOT NULL CHECK (coverage_type IN ('hotel_only', 'flight_only', 'hotel_and_flight')),
    pure_premium float NOT NULL
);

CREATE TABLE policies (
    id serial PRIMARY KEY,
    booking_id int NOT NULL REFERENCES bookings(id),
    product_id int NOT NULL REFERENCES products(id),
    trip_cost float NOT NULL,
    price_per_night float,
    flight_price float,
    origin_airport text,
    destination_airport text,
    outbound_flight_date date,
    return_flight_date date,
    base_frequency float NOT NULL,
    pure_premium float NOT NULL
);

CREATE TABLE claims (
    id serial PRIMARY KEY,
    policy_id int NOT NULL REFERENCES policies(id),
    claim_type text NOT NULL CHECK (claim_type IN ('pre_departure', 'post_departure')),
    claim_subtype text NOT NULL CHECK (claim_subtype IN ('cancellation', 'trip_delay', 'trip_interruption')),
    claim_date date NOT NULL,
    claim_amount float NOT NULL,
    days_delayed int,
    hurricane_event_id text
);

-- Indexes for common queries
CREATE INDEX idx_bookings_segment ON bookings(segment);
CREATE INDEX idx_bookings_destination ON bookings(destination_id);
CREATE INDEX idx_bookings_state ON bookings(state_of_residence);
CREATE INDEX idx_policies_booking ON policies(booking_id);
CREATE INDEX idx_policies_product ON policies(product_id);
CREATE INDEX idx_claims_policy ON claims(policy_id);
CREATE INDEX idx_claims_type ON claims(claim_type);
