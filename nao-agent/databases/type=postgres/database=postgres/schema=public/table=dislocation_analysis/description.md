# dislocation_analysis

**Dataset:** `public`

## Table Metadata

| Property | Value |
|----------|-------|
| **Row Count** | ~43 |
| **Column Count** | 6 |

## Description

Pre-computed dislocation analysis results comparing 2026 actual experience to 2025 model predictions. Computed by the Python analysis module using segment-specific 2025 baselines.

### Analysis Types

- **overall**: Single row with portfolio-level A/E ratio, frequency A/E, and aggregate metrics
- **ae_by_dimension**: A/E breakdown by segment or destination_type, with frequency A/E, severity A/E, and YoY comparisons
- **heatmap**: Segment × departure month grid with cell-level A/E ratios

### Key Metrics in `metrics` JSONB

- `ae_ratio`: Combined A/E = (2026 loss per policy) / (2025 loss per policy), using dimension-specific baselines
- `freq_ae`: Frequency A/E = actual claims / SUM(base_frequency from 2025 model)
- `sev_ae`: Severity A/E = 2026 avg severity / 2025 avg severity (dimension-specific)
- `frequency_2025`, `frequency_2026`: Reported frequency comparison
- `avg_severity_2025`, `avg_severity_2026`: Average claim amount comparison
- `loss_per_policy_2025`, `loss_per_policy_2026`: Loss per policy comparison

### Querying

```sql
-- Overall portfolio A/E
SELECT metrics->>'ae_ratio' AS ae_ratio FROM dislocation_analysis WHERE analysis_type = 'overall';

-- A/E by segment
SELECT dimension, metrics->>'ae_ratio' AS ae, metrics->>'freq_ae' AS freq_ae
FROM dislocation_analysis WHERE analysis_type = 'ae_by_dimension' AND dimension_type = 'segment';

-- Hottest heatmap cells
SELECT dimension AS segment, month, metrics->>'ae_ratio' AS ae
FROM dislocation_analysis WHERE analysis_type = 'heatmap'
ORDER BY (metrics->>'ae_ratio')::float DESC LIMIT 5;
```
