import { describe, expect, it } from "vitest";
import { computeStats, formatPercent, weekRange } from "@/lib/stats";

describe("weekRange", () => {
  it.each([
    ["a Monday at midnight", "2026-10-05T00:00:00Z", "2026-10-05"],
    ["a Wednesday afternoon", "2026-10-07T15:30:00Z", "2026-10-05"],
    ["the last moment of Sunday", "2026-10-11T23:59:59Z", "2026-10-05"],
    ["the next Monday", "2026-10-12T00:00:00Z", "2026-10-12"],
    ["a week that starts in the previous year", "2027-01-01T12:00:00Z", "2026-12-28"],
  ])("starts on Monday for %s", (_, now, monday) => {
    const { start, end } = weekRange(new Date(now));
    expect(start.toISOString()).toBe(`${monday}T00:00:00.000Z`);
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("computeStats", () => {
  it("returns zeros and no response rate when there are no applications", () => {
    const stats = computeStats({}, 0);
    expect(stats).toMatchObject({ total: 0, thisWeek: 0, responses: 0, responseRate: null });
    expect(stats.byStage.map((s) => [s.status, s.count, s.share])).toEqual([
      ["Applied", 0, 0],
      ["Screening", 0, 0],
      ["Interview", 0, 0],
      ["Offer", 0, 0],
      ["Rejected", 0, 0],
    ]);
  });

  it("counts every status except Applied as a response, rejections included", () => {
    const stats = computeStats({ Applied: 2, Screening: 1, Rejected: 1 }, 3);
    expect(stats).toMatchObject({ total: 4, thisWeek: 3, responses: 2, responseRate: 0.5 });
  });

  it("has a 0% response rate when nothing has moved past Applied", () => {
    expect(computeStats({ Applied: 3 }, 0).responseRate).toBe(0);
  });

  it("lists every stage in pipeline order with its share of the total", () => {
    const stats = computeStats({ Rejected: 1, Interview: 3 }, 0);
    expect(stats.byStage).toEqual([
      { status: "Applied", count: 0, share: 0 },
      { status: "Screening", count: 0, share: 0 },
      { status: "Interview", count: 3, share: 0.75 },
      { status: "Offer", count: 0, share: 0 },
      { status: "Rejected", count: 1, share: 0.25 },
    ]);
  });
});

describe("formatPercent", () => {
  it("shows a dash when there is no rate", () => {
    expect(formatPercent(null)).toBe("—");
  });

  it("rounds to a whole percent", () => {
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(1 / 3)).toBe("33%");
    expect(formatPercent(1)).toBe("100%");
  });
});
