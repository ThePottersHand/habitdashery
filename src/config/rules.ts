import type { RewardType } from "../types";

/**
 * Single source of truth for all tunable game mechanics.
 * Change numbers here; the rest of the app reads from this.
 */
export const RULES = {
  /** Length of a habit cycle in days. */
  cycleDays: 28,

  /** Skips granted at the start of each cycle. */
  startingSkips: 5,

  /** Hard cap on banked skips. */
  maxSkips: 9,

  /** Default hour (local) at which a new day begins. */
  defaultDayStartHour: 0,

  /** Limits to keep setup sane. */
  maxHabitsPerType: 8,
  maxHabitNameLength: 60,

  /**
   * Streak milestones and their rewards. Each fires once per cycle the first
   * time the current streak reaches `streak`.
   */
  rewardLadder: [
    { streak: 3, type: "skip" as RewardType, amount: 1, label: "+1 skip" },
    { streak: 7, type: "star" as RewardType, amount: 1, label: "Bonus star" },
    { streak: 14, type: "skip" as RewardType, amount: 2, label: "+2 skips" },
    { streak: 21, type: "theme" as RewardType, amount: 1, label: "New theme unlocked" },
    { streak: 28, type: "badge" as RewardType, amount: 1, label: "Cycle Complete badge" }
  ],

  /** Skips carried into the next cycle on full 28-day completion. */
  cycleCompleteCarryoverSkips: 2
} as const;

export type RuleMilestone = (typeof RULES.rewardLadder)[number];
