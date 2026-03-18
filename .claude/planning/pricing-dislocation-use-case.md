# Plan: Pricing Dislocation Use Case — Dashboard + nao Agent Demo

## Context

**Problem:** We need a compelling demo showing how AI-augmented analytics (nao agent) finds pricing dislocation faster than a classic BI dashboard. The narrative: "Our GLM was accurate in 2025 → something shifted in 2026 → an analyst clicking through the dashboard struggles to pinpoint what → nao answers it in 5 questions."

**Why now:** This is the centerpiece use case for the C-level pitch. The dashboard (Phases 2-4, already built) establishes the foundation. This use case demonstrates the value of the nao context layer on top of it.

**Intended outcome:** A side-by-side demo where the presenter first shows the dashboard (classic BI), then switches to nao chat (localhost:5005) and in 5 targeted questions identifies: baseline segment deterioration, frequency as primary driver, hurricane season concentration, and Caribbean as the missing risk factor.

---

## What Needs to Change

### Dashboard Side (travelers-demo-data)

The dashboard currently shows the 2026 dislocation but is missing two things:
1. **No 2025 validation** — nothing proves the model was accurate *before* the shift
2. **No destination-type A/E** — the Caribbean smoking gun is computed (`aeByDestType`) but never rendered

### nao Agent Side (travelers-nao-agent)

The nao agent can already query the database, but:
1. **RULES.md** may need dislocation-specific guidance for the 5-question flow
2. **Test cases** should cover the 5 demo questions to ensure reliable answers
3. The **5 questions** need to be designed and validated

---

## Step 1: Add 2025 Model Validation to API

**File:** `dashboard/app/api/data/route.ts`

Modify `buildDislocation` to accept `data` (CachedData) parameter and compute 2025 validation:

- Filter 2025 policies (booking `departure_date < '2026-01-01'`)
- `expectedClaims = SUM(policy.base_frequency)` across 2025 policies
- `actualClaims = COUNT(2025 claims)`
- `portfolioAE_2025 = actualClaims / expectedClaims` (should be ~1.0)
- Same breakdown by segment (3 rows)

Add to return object:
```typescript
validation2025: {
  portfolioAE: number,
  expectedClaims: number,
  actualClaims: number,
  bySegment: { segment: string, expectedClaims: number, actualClaims: number, ae: number }[]
}
```

Update call site to pass `data` parameter.

## Step 2: Add Destination-Type A/E Chart

**New file:** `dashboard/components/charts/ae-by-dest-type.tsx`

Horizontal bar chart (same pattern as `ae-by-segment.tsx`) showing A/E by destination type. The `aeByDestType` data is already returned by `buildDislocation` but never rendered. Caribbean should show the highest A/E — this is the "missing risk factor" reveal.

## Step 3: Add 2025 Validation Display

**New file:** `dashboard/components/charts/validation-2025.tsx`

A card showing 2025 A/E by segment as a compact bar chart centered on 1.0. All bars near green (A/E ~1.0). Header: "2025 Model Validation" with annotation: "Actual experience matched GLM predictions — the model was sound."

## Step 4: Restructure Dislocation Tab

**File:** `dashboard/app/page.tsx` (dislocation TabsContent)

Reorganize the Dislocation tab into a clear narrative flow:

**Section 1: "The Model Was Sound" (2025)**
- Validation2025 component showing 2025 A/E ~1.0 by segment
- Brief text: "In 2025, our GLM accurately predicted claims across all three segments."

**Section 2: "Something Shifted" (2026)**
- Existing KPIs (Portfolio A/E, Worst Segment, Worst Month, Model Accuracy)
- AEBySegmentChart (existing) — shows which segments broke

**Section 3: "Frequency & Severity Decomposition"**
- YoYComparisonChart (existing) — freq and severity side-by-side

**Section 4: "When and Where"**
- AEHeatmap (existing) — segment × month
- AEByDestType chart (new) — reveals Caribbean

**Section 5: "Rate Adequacy"**
- RateAdequacyTable (existing) — actionable recommendations

This is NOT a stepped wizard — it's the same flat layout but with section headers and narrative annotations that tell the story top-to-bottom. The presenter scrolls through it naturally.

## Step 5: Design the 5 nao Questions

These are the questions the presenter types into nao chat (localhost:5005) during the demo:

| # | Question | What It Reveals |
|---|----------|-----------------|
| 1 | "What is the overall A/E ratio for the 2026 portfolio compared to 2025?" | Portfolio is underpriced — A/E > 1.0 |
| 2 | "Break down the A/E ratio by customer segment. Which segment has the worst deterioration?" | Baseline segment is worst, then holiday |
| 3 | "For the baseline segment, is the 2026 deterioration driven more by frequency or severity? Compare both metrics to 2025." | Frequency is the primary driver |
| 4 | "Which departure months show the highest A/E ratios? Is there a seasonal pattern?" | Aug-Oct (hurricane season) are worst, especially September |
| 5 | "Compare A/E ratios by destination type. Are Caribbean destinations performing differently than domestic ones?" | Caribbean has the highest A/E — a risk factor the 2025 model didn't include |

**Conclusion the presenter draws:** "In 5 questions and ~3 minutes, the AI identified that our baseline segment deteriorated primarily through higher frequency concentrated in hurricane season, with Caribbean destinations as a new risk factor our model didn't capture. A classic analyst path through the dashboard requires navigating multiple tabs and mentally cross-referencing charts."

## Step 6: Add nao Test Cases for Demo Questions

**File:** `travelers-nao-agent/tests/dislocation-demo.yml`

Add test cases for the 5 questions to validate nao returns accurate, well-formatted answers. Each test case should have the question and expected answer patterns (A/E values, segment names, etc.).

## Step 7: Update nao RULES.md (if needed)

**File:** `travelers-nao-agent/RULES.md`

Review and add any missing context about:
- How to compute A/E ratios from `dislocation_analysis` table
- How to compare 2025 vs 2026 frequency/severity from `dislocation_analysis.metrics` JSONB
- How to interpret `glm_models` table for coefficient comparison

---

## Files Changed

| File | Change |
|------|--------|
| `dashboard/app/api/data/route.ts` | Add 2025 validation to `buildDislocation`, pass `data` param |
| `dashboard/app/page.tsx` | Restructure dislocation tab with section headers + new components |
| `dashboard/components/charts/ae-by-dest-type.tsx` | **New** — destination-type A/E chart |
| `dashboard/components/charts/validation-2025.tsx` | **New** — 2025 model validation display |
| `travelers-nao-agent/tests/dislocation-demo.yml` | **New** — 5 demo question test cases |
| `travelers-nao-agent/RULES.md` | Update if dislocation guidance is missing |

## Verification

1. Run `npx next build` — no type errors
2. Load dashboard at localhost:3000, go to Dislocation tab:
   - 2025 validation shows A/E ~1.0 (green) for all segments
   - 2026 A/E shows elevated ratios
   - Destination-type chart shows Caribbean as worst
3. Run `nao chat` in travelers-nao-agent, open localhost:5005
4. Ask the 5 questions — verify answers are accurate with correct A/E values
5. Run `nao test tests/dislocation-demo.yml` — all pass

## Status: active

## CEO Review Notes (2026-03-17)

**Mode:** SELECTIVE EXPANSION — 5 cherry-picks accepted.

**Scope changes:**
- Steps 5-7 REMOVED (nao agent work belongs in `travelers-nao-agent` repo)
- Step 1 approach changed: use existing JSONB metrics, not raw data computation
- ADDED: Auto-generated diagnosis card at top of tab
- ADDED: Green/red color coding for 2025 vs 2026 sections
- ADDED: Presenter stepper mode (progressive disclosure)
- ADDED: Cross-tab "Investigate on Map" link from dest-type chart
- ADDED: "Worst" callout badges on highest-A/E elements

**Design doc:** `docs/designs/pricing-dislocation-use-case.md`
**Eng review:** NOT YET DONE — run `/plan-eng-review` before implementation
