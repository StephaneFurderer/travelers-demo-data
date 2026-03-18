import { describe, it, expect } from "vitest";

// The validation2025 extraction logic lives in route.ts (server-side).
// We test it by extracting the same logic as a pure function here.

function extractValidation2025(segmentRows: any[]) {
  const bySegment = segmentRows.map((r: any) => {
    const m = r.metrics;
    const expected = m.total_loss_2025_expected || (m.loss_per_policy_2025 * (m.policies_2025 || 0));
    const actual = m.total_loss_2025 || 0;
    return {
      segment: (m.dimension || "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
      ae: expected > 0 ? actual / expected : 1.0,
      expected: Math.round(expected),
      actual: Math.round(actual),
      frequency: m.frequency_2025 || 0,
      avgSeverity: Math.round(m.avg_severity_2025 || 0),
    };
  });
  const totalExpected = bySegment.reduce((s: number, v: any) => s + v.expected, 0);
  const totalActual = bySegment.reduce((s: number, v: any) => s + v.actual, 0);
  return {
    portfolioAE: totalExpected > 0 ? totalActual / totalExpected : 1.0,
    bySegment,
  };
}

describe("extractValidation2025", () => {
  it("computes A/E from segment rows with 2025 JSONB fields", () => {
    const rows = [
      {
        metrics: {
          dimension: "baseline",
          loss_per_policy_2025: 100,
          policies_2025: 1000,
          total_loss_2025: 102000,
          frequency_2025: 0.05,
          avg_severity_2025: 500,
        },
      },
      {
        metrics: {
          dimension: "winter_birds",
          loss_per_policy_2025: 200,
          policies_2025: 500,
          total_loss_2025: 98000,
          frequency_2025: 0.03,
          avg_severity_2025: 2500,
        },
      },
    ];

    const result = extractValidation2025(rows);
    expect(result.bySegment).toHaveLength(2);
    expect(result.bySegment[0].segment).toBe("Baseline");
    expect(result.bySegment[0].ae).toBeCloseTo(1.02, 2);
    expect(result.bySegment[1].segment).toBe("Winter Birds");
    expect(result.bySegment[1].ae).toBeCloseTo(0.98, 2);
    // Portfolio A/E = (102000 + 98000) / (100000 + 100000) = 200000 / 200000 = 1.0
    expect(result.portfolioAE).toBeCloseTo(1.0, 2);
  });

  it("defaults to A/E = 1.0 when expected is zero", () => {
    const rows = [
      {
        metrics: {
          dimension: "baseline",
          loss_per_policy_2025: 0,
          policies_2025: 0,
          total_loss_2025: 0,
        },
      },
    ];

    const result = extractValidation2025(rows);
    expect(result.bySegment[0].ae).toBe(1.0);
    expect(result.portfolioAE).toBe(1.0);
  });

  it("handles empty segment rows", () => {
    const result = extractValidation2025([]);
    expect(result.bySegment).toHaveLength(0);
    expect(result.portfolioAE).toBe(1.0);
  });

  it("handles missing JSONB fields gracefully", () => {
    const rows = [
      {
        metrics: {
          dimension: "baseline",
          // Missing: loss_per_policy_2025, policies_2025, total_loss_2025
          ae_ratio: 1.3,
          frequency_2026: 0.06,
        },
      },
    ];

    const result = extractValidation2025(rows);
    expect(result.bySegment[0].ae).toBe(1.0); // defaults when expected = 0
    expect(result.bySegment[0].frequency).toBe(0);
    expect(result.bySegment[0].avgSeverity).toBe(0);
    // Should not throw
    expect(result.portfolioAE).toBe(1.0);
  });

  it("uses total_loss_2025_expected when available", () => {
    const rows = [
      {
        metrics: {
          dimension: "holiday_travelers",
          total_loss_2025_expected: 50000,
          total_loss_2025: 51000,
          loss_per_policy_2025: 100,
          policies_2025: 400,
          frequency_2025: 0.04,
          avg_severity_2025: 600,
        },
      },
    ];

    const result = extractValidation2025(rows);
    // Should use total_loss_2025_expected (50000) not loss_per_policy * policies (40000)
    expect(result.bySegment[0].ae).toBeCloseTo(1.02, 2);
    expect(result.bySegment[0].expected).toBe(50000);
  });
});
