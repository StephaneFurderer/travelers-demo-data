# dislocation_analysis

**Dataset:** `public`

## Columns

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| analysis_type | text | Type: 'overall', 'ae_by_dimension', or 'heatmap' |
| dimension | text | Dimension value (segment name, destination_type, or NULL for overall) |
| dimension_type | text | Dimension category: 'segment', 'destination_type', or NULL |
| month | int | Departure month (1-12) for heatmap rows, NULL otherwise |
| metrics | jsonb | Pre-computed metrics (ae_ratio, freq_ae, sev_ae, frequencies, severities, etc.) |
| computed_at | timestamp | When the analysis was run |
