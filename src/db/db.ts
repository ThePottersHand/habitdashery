import Dexie, { type Table } from "dexie";
import type { Cycle, Day, Entry, Habit, Meta, Reward, StarGoal } from "../types";

export class HabitdasheryDB extends Dexie {
  cycles!: Table<Cycle, number>;
  habits!: Table<Habit, number>;
  days!: Table<Day, number>;
  entries!: Table<Entry, number>;
  rewards!: Table<Reward, number>;
  meta!: Table<Meta, number>;
  starGoals!: Table<StarGoal, number>;

  constructor() {
    super("habitdashery");
    this.version(1).stores({
      cycles: "++id, status, startDate",
      habits: "++id, cycleId, type, order",
      days: "++id, cycleId, date, status, [cycleId+date]",
      entries: "++id, dayId, habitId, [dayId+habitId]",
      rewards: "++id, cycleId, milestone",
      meta: "++id",
      starGoals: "++id, starsRequired, achievedAt"
    });
  }
}

export const db = new HabitdasheryDB();

export const META_ID = 1;
