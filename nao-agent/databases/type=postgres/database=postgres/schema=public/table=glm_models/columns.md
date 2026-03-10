# glm_models

**Dataset:** `public`

## Columns

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| model_version | text | Model version identifier: '2025_v1' or '2026_actual' |
| model_type | text | Model type: 'frequency' or 'severity' |
| coefficient_name | text | Coefficient name (e.g., 'intercept', 'segment_baseline', 'month_9') |
| coefficient_value | float | Numeric coefficient value |
| description | text | Human-readable description of the coefficient |
