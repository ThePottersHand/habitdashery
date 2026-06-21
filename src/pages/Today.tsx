import { useEffect, useRef } from "react";
import dayjs from "dayjs";
import { useLiveQuery } from "dexie-react-hooks";
import {
  currentHabitDate,
  ensureToday,
  getActiveCycle,
  getDay,
  getEntries,
  getHabitsForCycle,
  getMeta,
  getStreakState,
  isSuccess,
  toggleEntry,
  toggleSkip
} from "../db/repo";
import type { Entry, Habit } from "../types";

export default function Today() {
  const data = useLiveQuery(async () => {
    const cycle = await getActiveCycle();
    const meta = await getMeta();
    if (!cycle?.id)
      return { cycle, meta, habits: [] as Habit[], date: "", day: undefined, entries: [] as Entry[], streak: 0 };
    const date = currentHabitDate(cycle.dayStartHour);
    const habits = await getHabitsForCycle(cycle.id);
    const day = await getDay(cycle.id, date);
    const entries = day?.id ? await getEntries(day.id) : [];
    const { current } = await getStreakState();
    return { cycle, meta, habits, date, day, entries, streak: current };
  }, []);

  const cycle = data?.cycle;
  const date = data?.date ?? "";
  const habits = data?.habits ?? [];
  const weekday = date ? dayjs(date).day() : -1;
  const scheduled = habits.filter((h) => h.daysOfWeek.includes(weekday));

  // Create today's Day + Entry rows once (a write — kept out of the liveQuery).
  const ensuredFor = useRef<string>("");
  useEffect(() => {
    if (!cycle?.id || !date) return;
    const key = `${cycle.id}:${date}`;
    if (ensuredFor.current === key) return;
    ensuredFor.current = key;
    void ensureToday(cycle.id, date, scheduled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle?.id, date, scheduled.length]);

  if (!data) return <p className="text-slate-500">Loading…</p>;
  if (!cycle) return <p className="text-slate-400">No active cycle.</p>;

  const { meta, entries } = data;
  const entryByHabit = new Map(entries.map((e) => [e.habitId, e]));
  const dos = scheduled.filter((h) => h.type === "do");
  const donts = scheduled.filter((h) => h.type === "dont");

  const today = dayjs();
  const dayNumber = today.diff(dayjs(cycle.startDate), "day") + 1;
  const totalDays = dayjs(cycle.endDate).diff(dayjs(cycle.startDate), "day") + 1;

  const resolved = entries.filter((e) => isSuccess(e.status) || e.status === "skipped").length;
  const isComplete = data.day?.status === "complete";
  const hasStar = data.day?.starEarned;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{cycle.name}</h1>
          <p className="text-sm text-slate-400">
            Day {dayNumber} of {totalDays} · {today.format("ddd D MMM")}
          </p>
        </div>
        <div className="flex gap-3 text-center text-xs text-slate-400">
          <Stat label="Streak" value={data.streak} accent="text-orange-400" />
          <Stat label="Stars" value={meta.totalStars} accent="text-amber-400" />
          <Stat label="Skips" value={meta.skipsRemaining} accent="text-brand-light" />
        </div>
      </header>

      {scheduled.length === 0 ? (
        <p className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-center text-slate-400">
          Rest day — nothing scheduled. Your streak is safe. 🌙
        </p>
      ) : (
        <>
          <div
            className={`rounded-xl p-4 text-center ${
              hasStar
                ? "bg-amber-500/15 text-amber-300"
                : isComplete
                  ? "bg-brand/20 text-brand-light"
                  : "bg-slate-900 text-slate-400"
            }`}
          >
            {hasStar ? (
              <span className="font-semibold">⭐ Perfect day — star earned!</span>
            ) : isComplete ? (
              <span className="font-semibold">Day complete (skip used — no star)</span>
            ) : (
              <span>
                {resolved}/{scheduled.length} resolved
              </span>
            )}
          </div>

          {dos.length > 0 && (
            <Group title="Do">
              {dos.map((h) => (
                <HabitRow key={h.id} habit={h} entry={entryByHabit.get(h.id!)} skips={meta.skipsRemaining} />
              ))}
            </Group>
          )}
          {donts.length > 0 && (
            <Group title="Don't">
              {donts.map((h) => (
                <HabitRow key={h.id} habit={h} entry={entryByHabit.get(h.id!)} skips={meta.skipsRemaining} />
              ))}
            </Group>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div>
      <div className={`text-lg font-bold ${accent}`}>{value}</div>
      <div>{label}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-light">{title}</h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function HabitRow({ habit, entry, skips }: { habit: Habit; entry?: Entry; skips: number }) {
  if (!entry) {
    return (
      <li className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-slate-500">
        {habit.name}
      </li>
    );
  }

  const isDo = habit.type === "do";
  const skipped = entry.status === "skipped";
  const success = isSuccess(entry.status);
  const slipped = entry.status === "slipped";

  return (
    <li
      className={`flex items-center gap-3 rounded-lg border p-3 transition ${
        skipped
          ? "border-slate-700 bg-slate-800/50"
          : success
            ? "border-brand/60 bg-brand/10"
            : slipped
              ? "border-red-800 bg-red-950/30"
              : "border-slate-800 bg-slate-900"
      }`}
    >
      <button
        onClick={() => toggleEntry(entry, habit.type)}
        disabled={skipped}
        className="flex flex-1 items-center gap-3 text-left disabled:opacity-50"
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
            success
              ? "border-brand bg-brand text-white"
              : slipped
                ? "border-red-500 text-red-400"
                : "border-slate-600"
          }`}
        >
          {success ? "✓" : slipped ? "✕" : ""}
        </span>
        <span className="flex flex-col">
          <span className={`text-slate-200 ${skipped ? "line-through" : ""}`}>{habit.name}</span>
          <span className="text-xs text-slate-500">
            {skipped
              ? "Skipped — streak protected"
              : isDo
                ? success
                  ? "Done"
                  : "Tap when done"
                : slipped
                  ? "Slipped — tap to undo"
                  : "Kept · tap if you slipped"}
          </span>
        </span>
      </button>

      <button
        onClick={() => toggleSkip(entry, habit.type)}
        disabled={!skipped && skips <= 0}
        className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium transition disabled:opacity-30 ${
          skipped
            ? "bg-slate-700 text-slate-200"
            : "border border-slate-700 text-slate-400 hover:border-brand-light hover:text-brand-light"
        }`}
      >
        {skipped ? "Undo skip" : "Skip"}
      </button>
    </li>
  );
}
