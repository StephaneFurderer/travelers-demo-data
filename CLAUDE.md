# Travelers Demo Data — Analytics Transformation Project

## Project Overview

Travel insurance portfolio demo system: Python synthetic data generator (50K bookings, 73K policies) + Next.js dashboard with 5 tabs. Built on Supabase. Used to demonstrate analytics transformation capabilities for C-level pitch (VC-style narrative, 8-10 slides).

## Planning Convention

**When the user says "let's plan", "we need to plan", or anything that implies planning work:**

1. Create a plan file under `.claude/planning/` named descriptively (e.g., `dashboard-visual-polish.md`, `gstack-integration.md`)
2. Each plan file should include:
   - **Goal** — one sentence on what we're trying to achieve
   - **Context** — why this matters (link to pitch narrative, business goal, etc.)
   - **Steps** — numbered, concrete, actionable steps
   - **Success criteria** — how we know it's done
   - **Dependencies** — what needs to happen first
   - **Status** — `draft | active | completed | parked`
3. Keep plans updated as work progresses — mark steps done, add notes, adjust scope
4. When starting implementation from a plan, reference the plan file in commits/PRs

Plans live in `.claude/planning/` — this is separate from `.claude/plan/` (which holds legacy context docs).

## Tech Stack

- **Data generator**: Python, NumPy, Pandas, Supabase SDK
- **Dashboard**: Next.js 16, React 19, TypeScript, shadcn/ui, Tailwind CSS 4, Recharts, Leaflet
- **Database**: Supabase (PostgreSQL)
- **Dev tools**: Claude Code + gstack (when installed)

## Key Files

- `travel_portfolio_generator/` — Python backend (generate.py, config.py, generators.py)
- `travel_portfolio_generator/dislocation/` — 2026 shifted GLM + A/E analysis
- `dashboard/` — Next.js frontend
- `dashboard/app/page.tsx` — Main dashboard page (all 5 tabs)
- `dashboard/lib/cache.ts` — Data caching + filtering logic

## Deployment

The dashboard is deployed to Vercel from a **separate standalone repo**:
- **This repo**: `StephaneFurderer/travelers-demo-data` — monorepo with Python generator + dashboard in `dashboard/` subdirectory
- **Vercel repo**: `StephaneFurderer/travel-insurance-dashboard` — dashboard files only (root level, no `dashboard/` prefix), branch `master`

**After making dashboard changes, you must sync to the Vercel repo:**
```bash
# From this repo's root:
rsync -av --delete \
  --exclude '.git' --exclude 'node_modules' --exclude '.next' --exclude '.env*' \
  dashboard/ /Users/sf/Applications/travel-insurance-dashboard/

# Then commit and push:
cd /Users/sf/Applications/travel-insurance-dashboard
git add -A && git commit -m "Sync from travelers-demo-data" && git push
```

## Conventions

- GLM coefficients are hardcoded in config files, not fitted from data
- Pure premium = frequency × E[severity]
- Three segments: winter_birds, holiday_travelers, baseline
- Dashboard fetches all data once, caches 10 min, filters client-side via API routes
