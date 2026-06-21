import dayjs from "dayjs";
import minMax from "dayjs/plugin/minMax";
import { db, META_ID } from "./db";
import { RULES } from "../config/rules";
import { classifyDay, computeStreak, longestStreak, type DayOutcome } from "../engine/classify";
import { THEMES } from "../config/themes";
import type { Cycle, Day, Entry, EntryStatus, Habit, HabitType, Meta } from "../types";

dayjs.extend(minMax);

function nextLockedTheme(unlocked: string[]): string | undefined {
  return THEMES.find((t) => !unlocked.includes(t.id))?.id;
}

const DEFAULT_META: Meta = {
  id: META_ID,
  skipsRemaining: RULES.startingSkips,
  totalStars: 0,
  bonusStars: 0,
  longestStreak: 0,
  theme: "violet",
  unlockedThemes: ["violet"],
  onboardingComplete: false,
  notifyEnabled: false,
  notifyHour: 20
};

/**
 * Read-only meta accessor. Returns defaults if the row doesn't exist yet without
 * writing — safe to call inside a `useLiveQuery` (reactive read-only) context.
 * Seeding happens once at startup via `ensureSeeded`.
 */
export async function getMeta(): Promise<Meta> {
  const existing = await db.meta.get(META_ID);
  return existing ?? DEFAULT_META;
}

/** Idempotently persist the default meta row. Call once at app startup. */
export async function ensureSeeded(): Promise<void> {
  const existing = await db.meta.get(META_ID);
  if (!existing) await db.meta.put(DEFAULT_META);
}

export async function updateMeta(patch: Partial<Meta>): Promise<void> {
  const current = await getMeta();
  await db.meta.put({ ...current, ...patch, id: META_ID });
}

export async function getActiveCycle(): Promise<Cycle | undefined> {
  return db.cycles.where("status").equals("active").first();
}

export interface NewHabitInput {
  type: HabitType;
  name: string;
  daysOfWeek: number[];
}

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Create the first cycle from the setup flow: persists the cycle + habits,
 * resets the skip pool, and marks onboarding complete. Returns the cycle id.
 */
export async function createCycle(
  name: string,
  dayStartHour: number,
  habits: NewHabitInput[]
): Promise<number> {
  const start = dayjs();
  const cycle: Cycle = {
    name: name.trim() || "My Cycle",
    startDate: start.format("YYYY-MM-DD"),
    endDate: start.add(RULES.cycleDays - 1, "day").format("YYYY-MM-DD"),
    dayStartHour,
    status: "active",
    createdAt: Date.now()
  };

  return db.transaction("rw", db.cycles, db.habits, db.meta, async () => {
    const cycleId = await db.cycles.add(cycle);
    const rows: Habit[] = habits
      .map((h, i) => ({
        cycleId,
        type: h.type,
        name: h.name.trim(),
        order: i,
        daysOfWeek: h.daysOfWeek.length ? h.daysOfWeek : ALL_DAYS
      }))
      .filter((h) => h.name.length > 0);
    await db.habits.bulkAdd(rows);
    await updateMeta({
      skipsRemaining: RULES.startingSkips,
      onboardingComplete: true
    });
    return cycleId;
  });
}

export async function getHabitsForCycle(cycleId: number): Promise<Habit[]> {
  const rows = await db.habits.where("cycleId").equals(cycleId).toArray();
  return rows.sort((a, b) => a.order - b.order);
}

export interface EditHabitRow {
  id?: number; // present = existing habit, absent = new
  type: HabitType;
  name: string;
  daysOfWeek: number[];
}

/**
 * Apply edits to the active cycle's habits: rename, reschedule, add, and remove.
 * Removed habits take their day-entries with them. Today's entries are
 * re-synced and derived state recomputed so changes show immediately.
 */
export async function updateCycleHabits(cycleId: number, rows: EditHabitRow[]): Promise<void> {
  const existing = await getHabitsForCycle(cycleId);
  const keep = new Set(rows.filter((r) => r.id != null).map((r) => r.id));

  await db.transaction("rw", db.habits, db.entries, async () => {
    // Delete removed habits and their entries.
    for (const h of existing) {
      if (h.id != null && !keep.has(h.id)) {
        await db.entries.where("habitId").equals(h.id).delete();
        await db.habits.delete(h.id);
      }
    }
    // Update existing / add new, preserving on-screen order.
    let order = 0;
    for (const r of rows) {
      const name = r.name.trim();
      if (!name) continue;
      const daysOfWeek = r.daysOfWeek.length ? r.daysOfWeek : ALL_DAYS;
      if (r.id != null) {
        await db.habits.update(r.id, { name, daysOfWeek, order });
      } else {
        await db.habits.add({ cycleId, type: r.type, name, order, daysOfWeek });
      }
      order++;
    }
  });

  // Re-sync today's entries to the new schedule and recompute.
  const cycle = await getActiveCycle();
  if (cycle?.id) {
    const today = currentHabitDate(cycle.dayStartHour);
    const habits = await getHabitsForCycle(cycle.id);
    const scheduled = habits.filter((h) => h.daysOfWeek.includes(dayjs(today).day()));
    const dayId = await ensureToday(cycle.id, today, scheduled);
    await recomputeDay(dayId);
  } else {
    await recomputeDerived();
  }
}

// --- Daily check-off (P2) ---

/** The habit-date "now" falls in, accounting for a custom day-start hour. */
export function currentHabitDate(dayStartHour: number, now = dayjs()): string {
  const shifted = now.hour() < dayStartHour ? now.subtract(1, "day") : now;
  return shifted.format("YYYY-MM-DD");
}

/** Default resolved state when an entry is first created. */
function defaultStatus(type: HabitType): EntryStatus {
  return type === "do" ? "pending" : "avoided";
}

export function isSuccess(status: EntryStatus): boolean {
  return status === "done" || status === "avoided";
}

/**
 * Ensure a Day row and Entry rows exist for the given date's scheduled habits.
 * Idempotent. Returns the day id.
 */
export async function ensureToday(
  cycleId: number,
  date: string,
  scheduled: Habit[]
): Promise<number> {
  return db.transaction("rw", db.days, db.entries, async () => {
    let day = await db.days.where("[cycleId+date]").equals([cycleId, date]).first();
    let dayId = day?.id;
    if (dayId == null) {
      dayId = await db.days.add({ cycleId, date, status: "pending", starEarned: false });
    }
    for (const h of scheduled) {
      if (h.id == null) continue;
      const existing = await db.entries
        .where("[dayId+habitId]")
        .equals([dayId, h.id])
        .first();
      if (!existing) {
        await db.entries.add({ dayId, habitId: h.id, status: defaultStatus(h.type) });
      }
    }
    return dayId;
  });
}

export async function getDay(cycleId: number, date: string): Promise<Day | undefined> {
  return db.days.where("[cycleId+date]").equals([cycleId, date]).first();
}

export async function getCycleDays(cycleId: number): Promise<Day[]> {
  return db.days.where("cycleId").equals(cycleId).toArray();
}

export async function getEntries(dayId: number): Promise<Entry[]> {
  return db.entries.where("dayId").equals(dayId).toArray();
}

/** Toggle a habit between success and not-done (do: pending↔done, dont: avoided↔slipped). */
export async function toggleEntry(entry: Entry, type: HabitType): Promise<void> {
  if (entry.id == null) return;
  if (entry.status === "skipped") return; // unskip first
  const next: EntryStatus =
    type === "do"
      ? entry.status === "done"
        ? "pending"
        : "done"
      : entry.status === "slipped"
        ? "avoided"
        : "slipped";
  await db.entries.update(entry.id, { status: next });
  await recomputeDay(entry.dayId);
}

/** Spend or refund a skip on a habit for the day. */
export async function toggleSkip(entry: Entry, type: HabitType): Promise<void> {
  if (entry.id == null) return;
  const meta = await getMeta();
  if (entry.status === "skipped") {
    await db.entries.update(entry.id, { status: defaultStatus(type) });
    await updateMeta({ skipsRemaining: Math.min(RULES.maxSkips, meta.skipsRemaining + 1) });
  } else {
    if (meta.skipsRemaining <= 0) return;
    await db.entries.update(entry.id, { status: "skipped" });
    await updateMeta({ skipsRemaining: meta.skipsRemaining - 1 });
  }
  await recomputeDay(entry.dayId);
}

/** Recompute today's (live) day status + star from its entries, then refresh derived state. */
export async function recomputeDay(dayId: number): Promise<void> {
  const entries = await db.entries.where("dayId").equals(dayId).toArray();
  const { status, star } = classifyDay(
    entries.map((e) => e.status),
    false
  );
  await db.days.update(dayId, { status, starEarned: star });
  await recomputeDerived();
}

/**
 * Recompute everything derived from day records: lifetime stars, milestone
 * rewards, longest streak, and star-goal achievement. Safe to call after any
 * change. Not for use inside a liveQuery (it writes).
 */
export async function recomputeDerived(): Promise<void> {
  const cycle = await getActiveCycle();
  if (cycle?.id) {
    const days = await db.days.where("cycleId").equals(cycle.id).toArray();
    const map = statusMap(days);
    const today = currentHabitDate(cycle.dayStartHour);
    const longest = longestStreak(map, cycle.startDate, today);
    await grantRewards(cycle.id, longest);
    const meta = await getMeta();
    if (longest > meta.longestStreak) await updateMeta({ longestStreak: longest });
  }
  const starDays = await db.days.filter((d) => d.starEarned).count();
  const meta = await getMeta();
  const total = starDays + meta.bonusStars;
  await updateMeta({ totalStars: total });
  await reconcileStarGoals(total);
}

function statusMap(days: Day[]): Map<string, DayOutcome> {
  return new Map(days.map((d) => [d.date, d.status as DayOutcome]));
}

/** Current + longest streak for the active cycle (for display). */
export async function getStreakState(): Promise<{ current: number; longest: number }> {
  const cycle = await getActiveCycle();
  if (!cycle?.id) return { current: 0, longest: 0 };
  const days = await db.days.where("cycleId").equals(cycle.id).toArray();
  const map = statusMap(days);
  const today = currentHabitDate(cycle.dayStartHour);
  return {
    current: computeStreak(map, today),
    longest: longestStreak(map, cycle.startDate, today)
  };
}

/** Grant any not-yet-granted milestone rewards up to the given streak length. */
async function grantRewards(cycleId: number, longest: number): Promise<void> {
  const existing = await db.rewards.where("cycleId").equals(cycleId).toArray();
  const granted = new Set(existing.map((r) => r.milestone));
  let meta = await getMeta();
  let changed = false;
  for (const m of RULES.rewardLadder) {
    if (m.streak > longest || granted.has(m.streak)) continue;
    if (m.type === "skip") {
      meta = { ...meta, skipsRemaining: Math.min(RULES.maxSkips, meta.skipsRemaining + m.amount) };
    } else if (m.type === "star") {
      meta = { ...meta, bonusStars: meta.bonusStars + m.amount };
    } else if (m.type === "theme") {
      const next = nextLockedTheme(meta.unlockedThemes);
      if (next) meta = { ...meta, unlockedThemes: [...meta.unlockedThemes, next] };
    }
    await db.rewards.add({
      cycleId,
      milestone: m.streak,
      type: m.type,
      amount: m.amount,
      grantedAt: Date.now()
    });
    changed = true;
  }
  if (changed) await db.meta.put({ ...meta, id: META_ID });
}

/**
 * Finalize every elapsed day before today so streaks/stars are correct even if
 * the app wasn't opened. Marks the cycle completed once it runs past its end.
 * Idempotent — already-settled days are skipped.
 */
export async function settle(now = dayjs()): Promise<void> {
  const cycle = await getActiveCycle();
  if (!cycle?.id) return;
  const habits = await getHabitsForCycle(cycle.id);
  const todayDate = currentHabitDate(cycle.dayStartHour, now);
  const lastToFinalize = dayjs.min(dayjs(todayDate).subtract(1, "day"), dayjs(cycle.endDate))!;

  let cursor = dayjs(cycle.startDate);
  while (!cursor.isAfter(lastToFinalize, "day")) {
    const date = cursor.format("YYYY-MM-DD");
    const scheduled = habits.filter((h) => h.daysOfWeek.includes(cursor.day()));
    await finalizeDay(cycle.id, date, scheduled.length);
    cursor = cursor.add(1, "day");
  }

  if (dayjs(todayDate).isAfter(dayjs(cycle.endDate), "day")) {
    await db.cycles.update(cycle.id, { status: "completed" });
  }
  await recomputeDerived();
}

async function finalizeDay(cycleId: number, date: string, scheduledCount: number): Promise<void> {
  const day = await getDay(cycleId, date);
  if (day?.id) {
    if (day.settledAt) return; // already locked in
    const entries = await getEntries(day.id);
    const { status, star } = classifyDay(
      entries.map((e) => e.status),
      true
    );
    await db.days.update(day.id, { status, starEarned: star, settledAt: Date.now() });
  } else {
    const placeholder = scheduledCount > 0 ? (Array(scheduledCount).fill("pending") as EntryStatus[]) : [];
    const { status, star } = classifyDay(placeholder, true);
    await db.days.add({ cycleId, date, status, starEarned: star, settledAt: Date.now() });
  }
}

// --- Star goals (user-defined targets) ---

export async function getStarGoals(): Promise<import("../types").StarGoal[]> {
  const rows = await db.starGoals.toArray();
  return rows.sort((a, b) => a.starsRequired - b.starsRequired);
}

export async function addStarGoal(label: string, starsRequired: number): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed || starsRequired < 1) return;
  await db.starGoals.add({
    label: trimmed,
    starsRequired: Math.round(starsRequired),
    createdAt: Date.now()
  });
}

export async function removeStarGoal(id: number): Promise<void> {
  await db.starGoals.delete(id);
}

/** Mark any goals as achieved once the running star total reaches them. */
export async function reconcileStarGoals(totalStars: number): Promise<void> {
  const pending = await db.starGoals.filter((g) => !g.achievedAt).toArray();
  const now = Date.now();
  for (const g of pending) {
    if (totalStars >= g.starsRequired && g.id != null) {
      await db.starGoals.update(g.id, { achievedAt: now });
    }
  }
}

// --- Rewards display (P4) ---

export async function getRewards(cycleId: number): Promise<import("../types").Reward[]> {
  const rows = await db.rewards.where("cycleId").equals(cycleId).toArray();
  return rows.sort((a, b) => a.milestone - b.milestone);
}

// --- Settings (P7) ---

export async function setTheme(theme: string): Promise<void> {
  await updateMeta({ theme });
}

export async function setNotify(enabled: boolean, hour: number): Promise<void> {
  await updateMeta({ notifyEnabled: enabled, notifyHour: hour });
}

// --- Cycle review + rollover (P6) ---

export interface HabitStat {
  habit: Habit;
  successDays: number;
  scheduledDays: number;
  rate: number; // 0..1
}

export interface CycleStats {
  cycle: Cycle;
  totalDays: number;
  completeDays: number;
  starDays: number;
  failedDays: number;
  longestStreak: number;
  habitStats: HabitStat[];
}

/** The cycle to review: the latest completed one, else the active one. */
export async function getReviewableCycle(): Promise<Cycle | undefined> {
  const completed = await db.cycles.where("status").equals("completed").reverse().sortBy("createdAt");
  if (completed.length) return completed[0];
  return getActiveCycle();
}

export async function getCycleStats(cycle: Cycle): Promise<CycleStats> {
  const cycleId = cycle.id!;
  const days = await db.days.where("cycleId").equals(cycleId).toArray();
  const habits = await getHabitsForCycle(cycleId);
  const map = statusMap(days);

  const completeDays = days.filter((d) => d.status === "complete").length;
  const starDays = days.filter((d) => d.starEarned).length;
  const failedDays = days.filter((d) => d.status === "failed").length;

  const dayIds = days.filter((d) => d.id != null).map((d) => d.id!);
  const entries = dayIds.length
    ? await db.entries.where("dayId").anyOf(dayIds).toArray()
    : [];
  const dayById = new Map(days.map((d) => [d.id!, d]));

  const habitStats: HabitStat[] = habits.map((habit) => {
    const hEntries = entries.filter((e) => e.habitId === habit.id);
    const successDays = hEntries.filter((e) => isSuccess(e.status)).length;
    // scheduled days = days whose weekday includes this habit, within elapsed range
    const scheduledDays = days.filter(
      (d) => habit.daysOfWeek.includes(dayjs(d.date).day()) && dayById.get(d.id!)
    ).length;
    return {
      habit,
      successDays,
      scheduledDays,
      rate: scheduledDays ? successDays / scheduledDays : 0
    };
  });

  return {
    cycle,
    totalDays: dayjs(cycle.endDate).diff(dayjs(cycle.startDate), "day") + 1,
    completeDays,
    starDays,
    failedDays,
    longestStreak: longestStreak(map, cycle.startDate, cycle.endDate),
    habitStats
  };
}

/**
 * Roll into a fresh cycle: complete the current one, carry over skips earned via
 * the 28-day reward, and create the new cycle + habits. Lifetime stars persist.
 */
export async function startNewCycle(
  name: string,
  dayStartHour: number,
  habits: NewHabitInput[]
): Promise<number> {
  const prev = (await getActiveCycle()) ?? (await getReviewableCycle());
  let carryover = 0;
  if (prev?.id) {
    await db.cycles.update(prev.id, { status: "completed" });
    const rewards = await getRewards(prev.id);
    if (rewards.some((r) => r.milestone === RULES.cycleDays)) {
      carryover = RULES.cycleCompleteCarryoverSkips;
    }
  }

  const start = dayjs();
  const cycle: Cycle = {
    name: name.trim() || "My Cycle",
    startDate: start.format("YYYY-MM-DD"),
    endDate: start.add(RULES.cycleDays - 1, "day").format("YYYY-MM-DD"),
    dayStartHour,
    status: "active",
    createdAt: Date.now()
  };

  return db.transaction("rw", db.cycles, db.habits, db.meta, async () => {
    const cycleId = await db.cycles.add(cycle);
    const rows: Habit[] = habits
      .map((h, i) => ({
        cycleId,
        type: h.type,
        name: h.name.trim(),
        order: i,
        daysOfWeek: h.daysOfWeek.length ? h.daysOfWeek : ALL_DAYS
      }))
      .filter((h) => h.name.length > 0);
    await db.habits.bulkAdd(rows);
    await updateMeta({ skipsRemaining: RULES.startingSkips + carryover });
    return cycleId;
  });
}

// --- Backup (P7) ---

export async function exportData(): Promise<string> {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      cycles: await db.cycles.toArray(),
      habits: await db.habits.toArray(),
      days: await db.days.toArray(),
      entries: await db.entries.toArray(),
      rewards: await db.rewards.toArray(),
      starGoals: await db.starGoals.toArray(),
      meta: await db.meta.toArray()
    }
  };
  return JSON.stringify(payload, null, 2);
}

export async function importData(json: string): Promise<void> {
  const parsed = JSON.parse(json);
  const d = parsed?.data;
  if (!d) throw new Error("Unrecognized backup file");
  await db.transaction(
    "rw",
    [db.cycles, db.habits, db.days, db.entries, db.rewards, db.meta, db.starGoals],
    async () => {
      await Promise.all([
        db.cycles.clear(),
        db.habits.clear(),
        db.days.clear(),
        db.entries.clear(),
        db.rewards.clear(),
        db.starGoals.clear(),
        db.meta.clear()
      ]);
      if (d.cycles) await db.cycles.bulkPut(d.cycles);
      if (d.habits) await db.habits.bulkPut(d.habits);
      if (d.days) await db.days.bulkPut(d.days);
      if (d.entries) await db.entries.bulkPut(d.entries);
      if (d.rewards) await db.rewards.bulkPut(d.rewards);
      if (d.starGoals) await db.starGoals.bulkPut(d.starGoals);
      if (d.meta) await db.meta.bulkPut(d.meta);
    }
  );
}

/** Wipe everything — used by "reset" in dev/settings. */
export async function resetAll(): Promise<void> {
  await db.transaction(
    "rw",
    [db.cycles, db.habits, db.days, db.entries, db.rewards, db.meta, db.starGoals],
    async () => {
      await Promise.all([
        db.cycles.clear(),
        db.habits.clear(),
        db.days.clear(),
        db.entries.clear(),
        db.rewards.clear(),
        db.meta.clear(),
        db.starGoals.clear()
      ]);
    }
  );
}
