import dayjs from "dayjs";
import type { EntryStatus } from "../types";

export type DayOutcome = "rest" | "complete" | "failed" | "pending";

const FMT = "YYYY-MM-DD";

export function isSuccess(s: EntryStatus): boolean {
  return s === "done" || s === "avoided";
}

/**
 * Classify a single day from its entry statuses.
 *
 * - No entries (nothing scheduled) → `rest` (streak-neutral, no star).
 * - Every entry succeeded or was skip-covered → `complete`.
 *   - …and every entry is a *genuine* success (no skips) → star.
 * - Otherwise: `finalize` (a past day) → `failed`; a live day → `pending`.
 *
 * A skip protects the day, so a fully-skipped day still counts as complete
 * (just without a star). Scarcity of skips is what keeps this honest.
 */
export function classifyDay(
  statuses: EntryStatus[],
  finalize: boolean
): { status: DayOutcome; star: boolean } {
  if (statuses.length === 0) return { status: "rest", star: false };
  const allSuccess = statuses.every(isSuccess);
  const coveredOrSuccess = statuses.every((s) => isSuccess(s) || s === "skipped");
  if (coveredOrSuccess) return { status: "complete", star: allSuccess };
  return { status: finalize ? "failed" : "pending", star: false };
}

/**
 * Current streak as of a date: count of consecutive `complete` days walking
 * backward, with `rest` days transparent (neither break nor count). A
 * not-yet-finalized today (`pending`/missing) is skipped so an in-progress day
 * doesn't zero an existing streak. A `failed` day stops the walk.
 */
export function computeStreak(statusByDate: Map<string, DayOutcome>, asOf: string): number {
  let cursor = dayjs(asOf);
  const todayStatus = statusByDate.get(cursor.format(FMT));
  if (todayStatus === undefined || todayStatus === "pending") {
    cursor = cursor.subtract(1, "day");
  }
  let count = 0;
  for (;;) {
    const s = statusByDate.get(cursor.format(FMT));
    if (s === "complete") {
      count++;
      cursor = cursor.subtract(1, "day");
    } else if (s === "rest") {
      cursor = cursor.subtract(1, "day");
    } else {
      break;
    }
  }
  return count;
}

/** Longest `complete` run across a cycle (rest transparent, anything else resets). */
export function longestStreak(
  statusByDate: Map<string, DayOutcome>,
  startDate: string,
  asOf: string
): number {
  let run = 0;
  let longest = 0;
  let cursor = dayjs(startDate);
  const end = dayjs(asOf);
  while (!cursor.isAfter(end, "day")) {
    const s = statusByDate.get(cursor.format(FMT));
    if (s === "complete") {
      run++;
      longest = Math.max(longest, run);
    } else if (s === "rest" || s === undefined || s === "pending") {
      // transparent: don't break a run on rest/not-yet-played days
    } else {
      run = 0; // failed
    }
    cursor = cursor.add(1, "day");
  }
  return longest;
}
