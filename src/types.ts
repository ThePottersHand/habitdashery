export type HabitType = "do" | "dont";

export type CycleStatus = "active" | "paused" | "completed";

export type DayStatus = "pending" | "complete" | "failed" | "rest";

/**
 * Per-habit, per-day outcome.
 * - do habits resolve to `done` (success) or `skipped`.
 * - dont habits default to `avoided` (success); `slipped` is a failure; `skipped` covers it.
 */
export type EntryStatus = "pending" | "done" | "avoided" | "slipped" | "skipped";

export type RewardType = "skip" | "star" | "theme" | "badge";

export interface Cycle {
  id?: number;
  name: string;
  startDate: string; // YYYY-MM-DD (day 1)
  endDate: string; // YYYY-MM-DD (day 28, inclusive)
  dayStartHour: number; // 0-23, when a new day begins locally
  status: CycleStatus;
  createdAt: number;
}

export interface Habit {
  id?: number;
  cycleId: number;
  type: HabitType;
  name: string;
  order: number;
  /** Weekdays this habit applies to: 0 = Sunday … 6 = Saturday. */
  daysOfWeek: number[];
}

export interface Day {
  id?: number;
  cycleId: number;
  date: string; // YYYY-MM-DD
  status: DayStatus;
  starEarned: boolean;
  settledAt?: number; // when the day was finalized by the settle pass
}

export interface Entry {
  id?: number;
  dayId: number;
  habitId: number;
  status: EntryStatus;
}

export interface Reward {
  id?: number;
  cycleId: number;
  milestone: number; // streak length that triggered it
  type: RewardType;
  amount: number;
  grantedAt: number;
}

/**
 * A user-defined target: "when I reach N stars, I get <reward>".
 * Personal, self-chosen incentives to aim toward across cycles.
 */
export interface StarGoal {
  id?: number;
  label: string; // the reward the user promises themselves
  starsRequired: number;
  createdAt: number;
  achievedAt?: number; // set once totalStars >= starsRequired
}

/** Singleton-ish app metadata (id = 1). */
export interface Meta {
  id?: number;
  skipsRemaining: number;
  /** Lifetime total = star-days + bonusStars. */
  totalStars: number;
  /** Bonus stars granted by streak rewards (kept separately from earned star-days). */
  bonusStars: number;
  longestStreak: number;
  theme: string;
  unlockedThemes: string[];
  onboardingComplete: boolean;
  notifyEnabled: boolean;
  notifyHour: number; // local hour for the daily nudge
}
