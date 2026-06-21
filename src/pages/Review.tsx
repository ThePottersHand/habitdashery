import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import HabitForm from "../components/HabitForm";
import { getCycleStats, getReviewableCycle, settle, startNewCycle } from "../db/repo";

export default function Review() {
  const navigate = useNavigate();
  const [adjusting, setAdjusting] = useState(false);

  const data = useLiveQuery(async () => {
    const cycle = await getReviewableCycle();
    if (!cycle?.id) return null;
    return getCycleStats(cycle);
  }, []);

  if (data === undefined) return <p className="text-slate-500">Loading…</p>;
  if (data === null) return <p className="text-slate-400">Nothing to review yet.</p>;

  const completion = data.totalDays ? Math.round((data.completeDays / data.totalDays) * 100) : 0;

  if (adjusting) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-white">Adjust & restart</h1>
          <p className="text-sm text-slate-400">
            Tweak your habits, then start a fresh 28 days. Your stars carry over.
          </p>
        </header>
        <HabitForm
          initial={{
            name: data.cycle.name,
            dayStartHour: data.cycle.dayStartHour,
            habits: data.habitStats.map((hs) => ({
              type: hs.habit.type,
              name: hs.habit.name,
              daysOfWeek: hs.habit.daysOfWeek
            }))
          }}
          submitLabel="Start new cycle"
          onSubmit={async (name, dayStartHour, habits) => {
            await startNewCycle(name, dayStartHour, habits);
            await settle();
            navigate("/", { replace: true });
          }}
        />
        <button
          onClick={() => setAdjusting(false)}
          className="w-full text-sm text-slate-500 hover:text-slate-300"
        >
          ← Back to summary
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Cycle complete! 🎉</h1>
        <p className="text-sm text-slate-400">{data.cycle.name} — here's how it went.</p>
      </header>

      <div className="grid grid-cols-2 gap-2 text-center">
        <Big value={`${completion}%`} label="Days completed" accent="text-emerald-400" />
        <Big value={data.starDays} label="Stars earned" accent="text-amber-400" />
        <Big value={data.longestStreak} label="Longest streak" accent="text-orange-400" />
        <Big value={data.failedDays} label="Days missed" accent="text-red-400" />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-light">
          How each habit did
        </h2>
        <ul className="space-y-2">
          {data.habitStats.map((hs) => (
            <li
              key={hs.habit.id}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
            >
              <span className="text-slate-300">
                <span className="text-slate-500">{hs.habit.type === "do" ? "Do" : "Don't"} ·</span>{" "}
                {hs.habit.name}
              </span>
              <span className="text-slate-400">{Math.round(hs.rate * 100)}%</span>
            </li>
          ))}
        </ul>
      </section>

      <button
        onClick={() => setAdjusting(true)}
        className="w-full rounded-xl bg-brand py-3 font-semibold text-white active:scale-[0.99]"
      >
        Adjust habits & start next cycle
      </button>
    </div>
  );
}

function Big({ value, label, accent }: { value: string | number; label: string; accent: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 py-4">
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
