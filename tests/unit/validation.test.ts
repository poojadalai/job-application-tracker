import { describe, expect, it } from "vitest";
import { capitalizeFirst, type ApplicationInput } from "@/lib/applications";
import { parseDate, parseInput, parseStatus } from "@/lib/validation";

const valid: ApplicationInput = {
  company: "Acme",
  role: "Frontend Developer",
  status: "Applied",
  appliedDate: "2026-10-01",
  jobDescription: "",
  nextStep: "",
  link: "",
  notes: "",
};

describe("parseInput", () => {
  it("trims text fields and converts the date", () => {
    const result = parseInput({
      ...valid,
      company: "  Acme  ",
      role: " Dev ",
      nextStep: " Call back ",
    });
    expect(result).toMatchObject({ company: "Acme", role: "Dev", nextStep: "Call back" });
    expect(result.appliedDate).toEqual(new Date("2026-10-01T00:00:00Z"));
  });

  it("capitalizes the first letter of company and role", () => {
    const result = parseInput({ ...valid, company: " cat ", role: "frontend-engineer" });
    expect(result).toMatchObject({ company: "Cat", role: "Frontend-engineer" });
  });

  it.each([
    ["company", { company: "" }],
    ["role", { role: "" }],
    ["whitespace-only company", { company: "   " }],
  ])("requires company and role (%s)", (_, override) => {
    expect(() => parseInput({ ...valid, ...override })).toThrow(
      "Company and role are required",
    );
  });

  it("truncates fields to their maximum length", () => {
    const result = parseInput({
      ...valid,
      company: "a".repeat(500),
      nextStep: "b".repeat(500),
      notes: "c".repeat(20000),
    });
    expect(result.company).toHaveLength(200);
    expect(result.nextStep).toHaveLength(200);
    expect(result.notes).toHaveLength(10000);
  });

  it("turns non-string fields from a forged request into empty strings", () => {
    const forged = { ...valid, notes: { $gt: "" }, link: 42 } as unknown as ApplicationInput;
    expect(parseInput(forged)).toMatchObject({ notes: "", link: "" });
  });

  it("drops fields that are not part of an application, such as userId", () => {
    const withOwner = { ...valid, userId: "someone-else" } as ApplicationInput;
    expect(parseInput(withOwner)).not.toHaveProperty("userId");
  });
});

describe("parseStatus", () => {
  it("accepts every known status", () => {
    for (const status of ["Applied", "Screening", "Interview", "Offer", "Rejected"]) {
      expect(parseStatus(status)).toBe(status);
    }
  });

  it.each(["Hired", "applied", "", null, 1])("rejects %j", (value) => {
    expect(() => parseStatus(value)).toThrow("Invalid status");
  });
});

describe("parseDate", () => {
  it("treats an empty or missing date as no date", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });

  it.each(["01/10/2026", "2026-1-1", "2026-10-01T00:00", "yesterday"])(
    "rejects %j",
    (value) => {
      expect(() => parseDate(value)).toThrow("Invalid date");
    },
  );
});

describe("capitalizeFirst", () => {
  it.each([
    ["cat", "Cat"],
    ["full stack", "Full stack"],
    ["McKinsey", "McKinsey"],
    ["React Developer", "React Developer"],
    ["", ""],
    ["42 labs", "42 labs"],
  ])("%j -> %j", (input, expected) => {
    expect(capitalizeFirst(input)).toBe(expected);
  });
});
