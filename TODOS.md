# TODOS

## P1: nao Agent Dislocation Demo Flow
**Repo:** travelers-nao-agent
**What:** Design 5 sequential demo questions, add test cases (dislocation-demo.yml), update RULES.md with dislocation-specific guidance for A/E computation from dislocation_analysis table.
**Why:** Completes the side-by-side demo (dashboard vs AI) for the C-level pitch. Dashboard side covered by pricing-dislocation-use-case plan.
**Effort:** M (human) / S (CC)
**Depends on:** Dashboard dislocation tab shipping first (this repo).

## P2: Vitest CI Integration
**What:** Add a GitHub Actions workflow or pre-commit hook that runs `vitest` on push/PR.
**Why:** Tests (validation2025 extraction, diagnosis text generation) were added without CI. Tests that don't run automatically eventually rot.
**Effort:** S (human) / S (CC)
**Depends on:** Vitest setup shipping with the dislocation tab plan.

## P3: Create DESIGN.md
**What:** Document the implicit design system: color tokens (product, segment, status), typography scale, spacing conventions, component patterns (KpiCard, section headers, chart cards). Run `/design-consultation` to generate from existing code.
**Why:** Design decisions are scattered across globals.css and component files. Without documentation, every new feature reinvents or creates inconsistency.
**Effort:** S (human) / S (CC)
**Depends on:** Nothing — can be done anytime.

## P3: Extract Reusable PresenterMode Component
**What:** After stepper mode ships for the dislocation tab, extract it as a generic `<PresenterMode>` wrapper that any tab could use for progressive disclosure.
**Why:** The pitch may want presenter mode on other tabs (e.g., walking through the pricing model step by step).
**Effort:** S (human) / S (CC)
**Depends on:** Stepper mode shipping in dislocation tab.
