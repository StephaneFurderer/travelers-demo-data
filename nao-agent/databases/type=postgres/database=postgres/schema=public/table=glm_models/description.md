# glm_models

**Dataset:** `public`

## Table Metadata

| Property | Value |
|----------|-------|
| **Row Count** | 73 |
| **Column Count** | 6 |

## Description

Reference table storing GLM (Generalized Linear Model) coefficients used for travel insurance pricing. Contains two model versions:

- **2025_v1**: The production pricing model used to set base_frequency and pure_premium on policies. Poisson frequency model (31 coefficients) and Gamma severity model (5 coefficients).
- **2026_actual**: The shifted "reality" coefficients that generated actual 2026 claims. Differences from 2025_v1 represent model dislocation — factors the 2025 model didn't capture.

Key dislocation signals in 2026:
- `segment_baseline` increased from 0.90 → 1.20 (baseline segment deteriorated)
- `month_9` increased from 0.35 → 0.65 (September hurricane season worsened)
- `destination_caribbean` is a NEW factor (+0.25) not present in 2025 model
- Severity intercept increased from 5.5 → 5.62 (~12% severity inflation)

Use this table to compare model versions, identify which coefficients shifted most, and explain A/E ratio patterns observed in the portfolio.
