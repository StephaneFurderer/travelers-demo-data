# Feature: Dislocation Analysis Module

## What Was Built

A complete 2026 "dislocated" portfolio layer on top of the existing 2025 travel insurance data. The 2026 cohort is priced using the same 2025 GLM model, but actual claims come from shifted 2026 reality — creating measurable dislocation between predicted and actual losses.

---

## Files Created

### Python — Data Generation & Analysis

| File | Purpose |
|------|---------|
| `travel_portfolio_generator/dislocation/__init__.py` | Module marker |
| `travel_portfolio_generator/dislocation/pg.py` | Direct Postgres connection helper (psycopg2) |
| `travel_portfolio_generator/dislocation/config_2026.py` | Shifted 2026 GLM coefficients (frequency + severity) |
| `travel_portfolio_generator/dislocation/generator_2026.py` | `DislocatedPortfolioGenerator` — generates bookings with 2025 predictions but 2026 actual claims |
| `travel_portfolio_generator/dislocation/generate_2026.py` | Entry point: generates 50K 2026 bookings, batch inserts to Supabase |
| `travel_portfolio_generator/dislocation/analysis.py` | Pre-computes A/E ratios, heatmaps, rate adequacy → stores in `dislocation_analysis` table |
| `travel_portfolio_generator/dislocation/insert_glm_models.py` | Creates `glm_models` table with 2025 + 2026 coefficients (73 rows) |

### Dashboard — UI Components

| File | Purpose |
|------|---------|
| `dashboard/app/page.tsx` | Added "Dislocation Analysis" tab (5th tab) with 4 KPI cards |
| `dashboard/app/api/data/route.ts` | Added `buildDislocation()` — reads pre-computed results from Supabase |
| `dashboard/lib/cache.ts` | Added `base_frequency` to Policy interface |
| `dashboard/components/charts/ae-by-segment.tsx` | Horizontal bar chart: A/E by segment, color-coded green/yellow/red |
| `dashboard/components/charts/ae-heatmap.tsx` | Segment x month grid, cells colored by A/E intensity |
| `dashboard/components/charts/yoy-comparison.tsx` | Side-by-side bars: 2025 vs 2026 frequency and severity |
| `dashboard/components/charts/rate-adequacy-table.tsx` | Table with A/E, adequacy badge, recommended rate change % |

### Nao Agent — Documentation

| File | Purpose |
|------|---------|
| `nao-agent/databases/.../table=dislocation_analysis/columns.md` | Column definitions |
| `nao-agent/databases/.../table=dislocation_analysis/description.md` | Business context + example queries |
| `nao-agent/databases/.../table=glm_models/columns.md` | Column definitions |
| `nao-agent/databases/.../table=glm_models/description.md` | Coefficient descriptions + comparison queries |
| `nao-agent/tests/dislocation_ae.yml` | Test case: A/E ratio by segment for 2026 |
| `nao-agent/RULES.md` | Updated with 2026 cohort definitions, A/E metrics, dislocation_analysis docs |

## Files Modified

| File | Change |
|------|--------|
| `dashboard/app/page.tsx` | "Claim Rate" KPI renamed to "Reported Frequency"; removed hardcoded "2025" from header |
| `dashboard/lib/cache.ts` | Added `base_frequency` field to policy select query |

---

## Database Tables Created

### `dislocation_analysis` (~43 rows)
Pre-computed A/E results. Three analysis types:
- `overall` — portfolio-level A/E (1 row)
- `ae_by_dimension` — A/E by segment (3) and destination_type (3) = 6 rows
- `heatmap` — segment x month grid = ~36 rows

Metrics stored as JSONB: `ae_ratio`, `freq_ae`, `sev_ae`, `frequency_2025/2026`, `avg_severity_2025/2026`, `loss_per_policy_2025/2026`.

### `glm_models` (73 rows)
Reference table with GLM coefficients:
- `2025_v1` / frequency (31 coefficients)
- `2025_v1` / severity (5 coefficients)
- `2026_actual` / frequency (32 coefficients — includes new `destination_caribbean`)
- `2026_actual` / severity (5 coefficients)

---

## Key GLM Shifts (2025 → 2026)

### Frequency
| Coefficient | 2025 | 2026 | Impact |
|------------|------|------|--------|
| `segment_baseline` | 0.90 | 1.20 | Baseline segment deteriorates most |
| `month_9` | 0.35 | 0.65 | September hurricane season worsens |
| `month_8` | 0.25 | 0.35 | Extended hurricane season |
| `month_10` | 0.20 | 0.35 | October extends the pattern |
| `destination_caribbean` | — | +0.25 | **New factor** the 2025 model can't see |

### Severity
| Coefficient | 2025 | 2026 | Impact |
|------------|------|------|--------|
| `intercept` | 5.50 | 5.62 | ~12.7% uniform inflation (exp(0.12) ≈ 1.127) |
| `log_trip_cost` | 0.60 | 0.65 | Expensive trips hit harder |

---

## Architecture Decision

**All actuarial computation lives in Python, not the dashboard.**

The Python `analysis.py` module computes baselines, A/E ratios, heatmaps, and rate adequacy, then stores results in the `dislocation_analysis` Supabase table. The dashboard API route (`buildDislocation()`) is a thin read layer — no computation, just formatting pre-computed results for the UI.

This means:
- The Nao agent can query the same pre-computed results
- No actuarial logic is duplicated between TypeScript and Python
- Re-running analysis is a single Python command: `python -m dislocation.analysis`

---

## Key Results

| Metric | Value |
|--------|-------|
| 2026 bookings | 50,000 |
| 2026 policies | 73,141 |
| 2026 claims | 6,843 |
| 2026 reported frequency | 9.36% (vs 7% in 2025) |
| Portfolio A/E | 1.43 |
| Worst segment A/E | Baseline: 1.56 |
| Worst destination A/E | Caribbean: 1.60 |

---

## How to Run

```bash
# Generate 2026 dislocated portfolio (appends to existing Supabase data)
cd travel_portfolio_generator
python -m dislocation.generate_2026

# Insert GLM coefficients into glm_models table
python -m dislocation.insert_glm_models

# Compute and store A/E analysis
python -m dislocation.analysis
```
