# Nao Analytics Agent — Implementation Plan

## Context

Dashboard is deployed. Now add a Nao analytics agent so leadership can ask ad-hoc questions in natural language against the Supabase travel insurance DB (50K bookings, 73K policies, 5.3K claims). Key demo: hurricane exposure analysis.

## TODO Checklist

- [ ] **Step 1**: Create Python venv and install `nao-core`
- [ ] **Step 2**: Write `nao_config.yaml` (Postgres connection to Supabase + Anthropic LLM)
- [ ] **Step 3**: Write `RULES.md` (full semantic model — tables, joins, metrics, hurricane methodology)
- [ ] **Step 4**: Run `nao debug` to verify DB + LLM connectivity
- [ ] **Step 5**: Run `nao sync` to generate table docs from Supabase schema
- [ ] **Step 6**: Enrich auto-generated `description.md` files with business context
- [ ] **Step 7**: Create test cases in `tests/` (3 YAML files)
- [ ] **Step 8**: Run `nao test` to validate agent accuracy
- [ ] **Step 9**: (Optional) Create `hurricane_tracks` table in Supabase, re-sync
- [ ] **Step 10**: Run `nao chat` — verify UI loads, test demo questions
- [ ] **Step 11**: Run full demo script (3 acts) end-to-end

## Guardrails

1. **Never modify the existing dashboard** — Nao is a separate project alongside it
2. **Never modify Supabase data** — agent has read-only access (anon key). Only exception: optional `hurricane_tracks` CREATE TABLE via SQL Editor
3. **Never expose credentials in committed files** — `nao_config.yaml` uses `${{ env('ANTHROPIC_API_KEY') }}` for the LLM key; Postgres password is local-only (this dir is not in the dashboard git repo)
4. **Verify each step before proceeding** — don't skip `nao debug` or `nao test`
5. **Don't install globally** — use a dedicated venv in `nao-agent/.venv`
6. **Don't touch the generator** — `travel_portfolio_generator/` is source of truth, read-only reference

## Step Details

### Step 1: Install

```bash
cd /Users/sf/Applications/travelers-demo-data/nao-agent
python3 -m venv .venv
source .venv/bin/activate
pip install nao-core
```

### Step 2: `nao_config.yaml`

```yaml
project_name: travelers-insurance
databases:
- name: supabase-travelers
  type: postgres
  host: $DB_HOST
  port: 5432
  database: postgres
  user: postgres
  password: $DB_PASSWORD
  schema_name: public
  accessors: [columns, description, preview]
llm:
  provider: anthropic
  api_key: ${{ env('ANTHROPIC_API_KEY') }}
```

- `schema_name: public` prevents introspecting Supabase internal schemas
- Port 5432 (direct), not 6543 (pooler) — Ibis needs real Postgres wire protocol

### Step 3: `RULES.md`

Encode the full semantic model:
- 5 tables with column descriptions and join paths
- 3 segment definitions (winter_birds, holiday_travelers, baseline)
- Metric formulas: pure_premium, loss_ratio, reported_frequency, exposure
- Common query patterns (loss ratio by X, exposure at location on date)
- Hurricane exposure methodology (filter by lat/lon + date range)
- SQL guardrails (explicit JOINs, qualified column names, rounding, NULL handling)

Source material:
- `/Users/sf/Applications/travelers-demo-data/travel_portfolio_generator/CLAUDE.md`
- `/Users/sf/Applications/travelers-demo-data/travel_portfolio_generator/config.py`
- `/Users/sf/Applications/travelers-demo-data/travel_portfolio_generator/destinations.py`
- `/Users/sf/Applications/travelers-demo-data/travel_portfolio_generator/schema.sql`

### Step 4: `nao debug`

Must confirm:
- [x] Postgres connection successful
- [x] LLM (Anthropic) API key valid
- [x] Tables discovered in public schema

### Step 5: `nao sync`

Generates per table: `columns.md`, `description.md`, `preview.md`

### Step 6: Enrich descriptions

Edit each `description.md` to add business context (the auto-generated ones will say "No description available" since we have no `COMMENT ON` in the DDL).

### Step 7: Test cases

3 YAML files:
- `tests/avg_claim_by_segment.yml` — validates 3-table join
- `tests/destination_loss_ratio.yml` — validates derived metric computation
- `tests/hurricane_exposure.yml` — validates temporal + geographic filtering

### Step 8: `nao test`

All 3 tests must pass before demoing.

### Step 9: (Optional) Hurricane tracks table

```sql
CREATE TABLE hurricane_tracks (
  id serial PRIMARY KEY,
  storm_name text NOT NULL,
  category int NOT NULL,
  track_date date NOT NULL,
  latitude float NOT NULL,
  longitude float NOT NULL,
  max_wind_mph int
);
```

Insert 5-6 waypoints for a hypothetical Gulf Coast storm (Sept 10-14, 2025). Re-run `nao sync`.

### Step 10: Launch and verify

```bash
nao chat  # opens http://localhost:5005
```

Test: "How many bookings by segment?" → expect 12K/18K/20K.

### Step 11: Demo script

**Act 1 — Instant answers (2 min)**
1. "How many bookings by segment?"
2. "Average claim amount by segment?"
3. "Which states have the highest loss ratio?"

**Act 2 — Questions the dashboard can't answer (3 min)**
4. "Average trip duration for claimants vs non-claimants?"
5. "Reported frequency by age bracket (under 30, 30-50, 50-65, 65+)?"
6. "Which origin→destination routes have highest claim frequency?"

**Act 3 — Hurricane scenario (3 min)**
7. "How many travelers are on the ground at Gulf Coast destinations Sept 10-16?"
8. "What's the total exposure by city?"
9. "Sept Gulf Coast reported frequency vs other regions?"

## File Structure

```
nao-agent/
├── PLAN.md              # this file
├── nao_config.yaml      # DB + LLM config
├── RULES.md             # semantic model for the agent
├── .venv/               # Python virtual environment
├── databases/           # auto-generated by nao sync
│   └── type=postgres/database=postgres/schema=public/
│       ├── table=bookings/
│       ├── table=policies/
│       ├── table=claims/
│       ├── table=destinations/
│       └── table=products/
└── tests/
    ├── avg_claim_by_segment.yml
    ├── destination_loss_ratio.yml
    └── hurricane_exposure.yml
```
