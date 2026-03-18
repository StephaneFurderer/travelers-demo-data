import { describe, it, expect } from "vitest";
import { generateDiagnosis } from "@/components/dislocation-tab";

describe("generateDiagnosis", () => {
  it("returns healthy message when portfolio A/E <= 1.05", () => {
    const data = {
      kpis: { portfolioAE: 1.02, worstSegment: "Baseline", worstSegmentAE: 1.02, worstMonth: "Jan" },
      yoy: [],
      aeByDestType: [],
      heatmap: [],
    };
    const result = generateDiagnosis(data);
    expect(result.isStressed).toBe(false);
    expect(result.title).toBe("Portfolio Performing as Expected");
  });

  it("returns stressed message when portfolio A/E > 1.05", () => {
    const data = {
      kpis: { portfolioAE: 1.23, worstSegment: "Baseline", worstSegmentAE: 1.34, worstMonth: "Sep" },
      yoy: [
        { freq2025: 0.01, freq2026: 0.015, sev2025: 500, sev2026: 520 },
      ],
      aeByDestType: [
        { destinationType: "caribbean", ae: 1.45 },
        { destinationType: "us_atlantic", ae: 1.10 },
      ],
      heatmap: [
        { month: 8, ae: 1.5 },
        { month: 9, ae: 1.8 },
        { month: 10, ae: 1.4 },
        { month: 3, ae: 1.1 },
      ],
    };
    const result = generateDiagnosis(data);
    expect(result.isStressed).toBe(true);
    expect(result.title).toBe("Portfolio Under Stress");
    expect(result.body).toContain("Baseline");
    expect(result.body).toContain("23%");
    expect(result.body).toContain("frequency");
    expect(result.body).toContain("Caribbean");
    expect(result.body).toContain("1.45");
  });

  it("mentions severity when severity is the primary driver", () => {
    const data = {
      kpis: { portfolioAE: 1.15, worstSegment: "Holiday", worstSegmentAE: 1.20, worstMonth: "Jul" },
      yoy: [
        { freq2025: 0.01, freq2026: 0.011, sev2025: 500, sev2026: 700 },
        { freq2025: 0.02, freq2026: 0.021, sev2025: 300, sev2026: 450 },
      ],
      aeByDestType: [],
      heatmap: [],
    };
    const result = generateDiagnosis(data);
    expect(result.body).toContain("severity");
  });

  it("mentions hurricane season when Aug-Oct A/E is concentrated", () => {
    const data = {
      kpis: { portfolioAE: 1.20, worstSegment: "Baseline", worstSegmentAE: 1.30, worstMonth: "Sep" },
      yoy: [{ freq2025: 0.01, freq2026: 0.015, sev2025: 500, sev2026: 520 }],
      aeByDestType: [],
      heatmap: [
        { month: 8, ae: 1.6 },
        { month: 9, ae: 1.9 },
        { month: 10, ae: 1.5 },
        { month: 1, ae: 1.0 },
        { month: 2, ae: 1.0 },
      ],
    };
    const result = generateDiagnosis(data);
    expect(result.body).toContain("hurricane season");
  });

  it("handles missing/empty data gracefully", () => {
    const data = {
      kpis: { portfolioAE: 1.10, worstSegment: "", worstSegmentAE: 0, worstMonth: "" },
      yoy: [],
      aeByDestType: [],
      heatmap: [],
    };
    const result = generateDiagnosis(data);
    expect(result.isStressed).toBe(true);
    expect(result.body).toBeDefined();
    // Should not throw or contain NaN/undefined
    expect(result.body).not.toContain("NaN");
    expect(result.body).not.toContain("undefined");
  });

  it("skips destination mention when all dest types have low A/E", () => {
    const data = {
      kpis: { portfolioAE: 1.10, worstSegment: "Baseline", worstSegmentAE: 1.15, worstMonth: "Jun" },
      yoy: [{ freq2025: 0.01, freq2026: 0.012, sev2025: 500, sev2026: 520 }],
      aeByDestType: [
        { destinationType: "us_atlantic", ae: 1.05 },
        { destinationType: "gulf_coast", ae: 1.08 },
      ],
      heatmap: [],
    };
    const result = generateDiagnosis(data);
    // Should not mention any destination since all are <= 1.1
    expect(result.body).not.toContain("Us Atlantic");
    expect(result.body).not.toContain("Gulf Coast");
  });
});
