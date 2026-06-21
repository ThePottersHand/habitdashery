import dayjs from "dayjs";
import { useLiveQuery } from "dexie-react-hooks";
import {
  WEEKDAY_LABELS,
  getActiveCycle,
  getCycleDays,
  getCycleStats,
  getReviewableCycle,
  getStreakState
} from "../db/repo";
import type { DayStatus } from "../types";

export default function Progress() {
  const view = useLiveQuery(async () => {
    const cycle = (await getActiveCycle()) ?? (await getReviewableCycle());
    if (!cycle?.id) return null;
    const [stats, streak, days] = await Promise.all([
      getCycleStats(cycle),
      getStreakState(),
      getCycleDays(cycle.id)
    ]);
    return { stats, streak, days };
  }, []);

  if (view === undefined) return <p className="text-slate-500">Loading…</p>;
  if (view === null) return <p className="text-slate-400">No cycle yet.</p>;

  const { stats, streak, days } = view;
  const { cycle } = stats;
  const start = dayjs(cycle.startDate);
  const today = dayjs();

  const lookup = new Map(days.map((d) => [d.date, { status: d.status, star: d.starEarned }]));
  const cells = Array.from({ length: stats.totalDays }, (_, i) => start.add(i, "day"));
  const leadPad = start.day(); // align day 1 to its weekday column

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{cycle.name}</h1>

      <div className="grid grid-cols-4 gap-2 text-center">
        <Tile value={stats.starDays} label="Stars" accent="text-amber-400" />
        <Tile value={streak.current} label="Streak" accent="text-orange-400" />
        <Tile value={stats.longestStreak} label="Best" accent="text-brand-light" />
        <Tile value={stats.completeDays} label="Done" accent="text-emerald-400" />
      </div>

      <section className="space-y-2">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500">
          {WEEKDAY_LABELS.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadPad }).map((_, i) => (
            <span key={`pad${i}`} />
          ))}
          {cells.map((d) => {
            const key = d.format("YYYY-MM-DD");
            const rec = lookup.get(key);
            const isFuture = d.isAfter(today, "day");
            const isToday = d.isSame(today, "day");
            return (
              <div
                key={key}
                className={`flex aspect-square items-center justify-center rounded-md text-[11px] ${cellClass(
                  rec?.status,
                  rec?.star,
                  isFuture
                )} ${isToday ? "ring-2 ring-white/70" : ""}`}
                title={`${d.format("ddd D MMM")}${rec ? ` · ${rec.status}` : ""}`}
              >
                {rec?.star ? "⭐" : d.date()}
              </div>
            );
          })}
        </div>
        <Legend />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-light">
          Per-habit success
        </h2>
        <ul className="space-y-2">
          {stats.habitStats.map((hs) => (
            <li key={hs.habit.id} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">
                  <span className="text-slate-500">{hs.habit.type === "do" ? "Do" : "Don't"} ·</span>{" "}
                  {hs.habit.name}
                </span>
                <span className="text-slate-400">
                  {hs.successDays}/{hs.scheduledDays}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-brand" style={{ width: `${Math.round(hs.rate * 100)}%` }} />
              </div>
            </li>
          ))}
          {stats.habitStats.length === 0 && (
            <li className="text-xs text-slate-600">No habits in this cycle.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Tile({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 py-3">
      <div className={`text-xl font-bold ${accent}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function cellClass(status: DayStatus | undefined, star: boolean | undefined, isFuture: boolean): string {
  if (isFuture) return "bg-slate-900 text-slate-700";
  if (star) return "bg-amber-500/25 text-amber-200";
  switch (status) {
    case "complete":
      return "bg-brand/30 text-brand-light";
    case "failed":
      return "bg-red-950/60 text-red-400";
    case "pending":
      return "bg-slate-800 text-slate-400";
    default:
      return "bg-slate-900 text-slate-600"; // rest / none
  }
}

function Legend() {
  const items = [
    ["bg-amber-500/25", "Star"],
    ["bg-brand/30", "Complete"],
    ["bg-red-950/60", "Failed"],
    ["bg-slate-900", "Rest/future"]
  ] as const;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
      {items.map(([c, l]) => (
        <span key={l} className="flex items-center gap-1">
          <span className={`inline-block h-3 w-3 rounded ${c}`} /> {l}
        </span>
      ))}
    </div>
  );
}
