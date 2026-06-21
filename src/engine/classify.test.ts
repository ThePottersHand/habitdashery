import { describe, expect, it } from "vitest";
import { classifyDay, computeStreak, longestStreak, type DayOutcome } from "./classify";

describe("classifyDay", () => {
  it("treats an empty day as a rest day", () => {
    expect(classifyDay([], true)).toEqual({ status: "rest", star: false });
  });

  it("earns a star when every habit is a genuine success", () => {
    expect(classifyDay(["done", "avoided"], false)).toEqual({ status: "complete", star: true });
  });

  it("completes without a star when a skip is used", () => {
    expect(classifyDay(["done", "skipped"], false)).toEqual({ status: "complete", star: false });
  });

  it("treats a fully skip-covered day as complete (streak protected, no star)", () => {
    expect(classifyDay(["skipped", "skipped"], true)).toEqual({ status: "complete", star: false });
  });

  it("stays pending while a habit is unresolved during the day", () => {
    expect(classifyDay(["done", "pending"], false)).toEqual({ status: "pending", star: false });
  });

  it("fails on finalize when a habit is left unresolved", () => {
    expect(classifyDay(["done", "pending"], true)).toEqual({ status: "failed", star: false });
  });

  it("fails when a don't-habit was slipped and not covered", () => {
    expect(classifyDay(["done", "slipped"], true)).toEqual({ status: "failed", star: false });
  });

  it("a slipped don't-habit covered by a skip still completes", () => {
    expect(classifyDay(["done", "skipped"], true)).toEqual({ status: "complete", star: false });
  });
});

function mapOf(pairs: [string, DayOutcome][]): Map<string, DayOutcome> {
  return new Map(pairs);
}

describe("computeStreak", () => {
  it("is zero with no history", () => {
    expect(computeStreak(mapOf([]), "2026-01-10")).toBe(0);
  });

  it("counts consecutive complete days up to today", () => {
    const m = mapOf([
      ["2026-01-08", "complete"],
      ["2026-01-09", "complete"],
      ["2026-01-10", "complete"]
    ]);
    expect(computeStreak(m, "2026-01-10")).toBe(3);
  });

  it("does not zero the streak when today is still pending", () => {
    const m = mapOf([
      ["2026-01-08", "complete"],
      ["2026-01-09", "complete"],
      ["2026-01-10", "pending"]
    ]);
    expect(computeStreak(m, "2026-01-10")).toBe(2);
  });

  it("treats rest days as transparent", () => {
    const m = mapOf([
      ["2026-01-08", "complete"],
      ["2026-01-09", "rest"],
      ["2026-01-10", "complete"]
    ]);
    expect(computeStreak(m, "2026-01-10")).toBe(2);
  });

  it("breaks on a failed day", () => {
    const m = mapOf([
      ["2026-01-08", "complete"],
      ["2026-01-09", "failed"],
      ["2026-01-10", "complete"]
    ]);
    expect(computeStreak(m, "2026-01-10")).toBe(1);
  });
});

describe("longestStreak", () => {
  it("finds the longest complete run, ignoring rest, resetting on failure", () => {
    const m = mapOf([
      ["2026-01-01", "complete"],
      ["2026-01-02", "complete"],
      ["2026-01-03", "failed"],
      ["2026-01-04", "complete"],
      ["2026-01-05", "rest"],
      ["2026-01-06", "complete"],
      ["2026-01-07", "complete"]
    ]);
    expect(longestStreak(m, "2026-01-01", "2026-01-07")).toBe(3);
  });
});
