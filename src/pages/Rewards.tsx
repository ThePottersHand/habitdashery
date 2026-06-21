import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { RULES } from "../config/rules";
import {
  addStarGoal,
  getActiveCycle,
  getMeta,
  getRewards,
  getStarGoals,
  getStreakState,
  removeStarGoal
} from "../db/repo";

export default function Rewards() {
  const meta = useLiveQuery(() => getMeta(), []);
  const goals = useLiveQuery(() => getStarGoals(), []);
  const streak = useLiveQuery(() => getStreakState(), []);
  const earned = useLiveQuery(async () => {
    const cycle = await getActiveCycle();
    return cycle?.id ? getRewards(cycle.id) : [];
  }, []);
  const [label, setLabel] = useState("");
  const [stars, setStars] = useState("10");

  const totalStars = meta?.totalStars ?? 0;
  const earnedMilestones = new Set((earned ?? []).map((r) => r.milestone));
  const currentStreak = streak?.current ?? 0;
  const nextMilestone = RULES.rewardLadder.find((m) => m.streak > currentStreak);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(stars);
    if (!label.trim() || !Number.isFinite(n) || n < 1) return;
    await addStarGoal(label, n);
    setLabel("");
    setStars("10");
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-white">Rewards</h1>
        <p className="text-sm text-slate-400">
          {totalStars} ⭐ earned · {meta?.skipsRemaining ?? 0} skips banked
        </p>
      </header>

      {/* Current streak + next milestone */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-bold text-white">🔥 {currentStreak}</span>
          <span className="text-xs text-slate-400">day streak</span>
        </div>
        {nextMilestone ? (
          <p className="mt-2 text-xs text-slate-400">
            {nextMilestone.streak - currentStreak} more day
            {nextMilestone.streak - currentStreak === 1 ? "" : "s"} →{" "}
            <span className="text-brand-light">{nextMilestone.label}</span>
          </p>
        ) : (
          <p className="mt-2 text-xs text-amber-400">All streak rewards unlocked! 🎉</p>
        )}
      </section>

      {/* User-defined star goals */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-light">
          Your star goals
        </h2>
        <p className="text-xs text-slate-500">
          Promise yourself a reward at a star milestone — something to aim toward.
        </p>

        <ul className="space-y-2">
          {goals?.map((g) => {
            const done = totalStars >= g.starsRequired;
            const pct = Math.min(100, Math.round((totalStars / g.starsRequired) * 100));
            return (
              <li
                key={g.id}
                className="rounded-lg border border-slate-800 bg-slate-900 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-medium ${done ? "text-amber-400" : "text-slate-200"}`}>
                    {done ? "🏆 " : ""}
                    {g.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {Math.min(totalStars, g.starsRequired)}/{g.starsRequired} ⭐
                    </span>
                    <button
                      onClick={() => g.id != null && removeStarGoal(g.id)}
                      className="text-slate-600 hover:text-red-400"
                      aria-label="Remove goal"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full ${done ? "bg-amber-400" : "bg-brand"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
          {goals && goals.length === 0 && (
            <li className="text-xs text-slate-600">No goals yet — add one below.</li>
          )}
        </ul>

        <form onSubmit={submit} className="flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Reward (e.g. new running shoes)"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand-light focus:outline-none"
          />
          <input
            value={stars}
            onChange={(e) => setStars(e.target.value)}
            type="number"
            min={1}
            className="w-16 rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-center text-sm text-white focus:border-brand-light focus:outline-none"
            aria-label="Stars required"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand px-3 text-sm font-semibold text-white"
          >
            Add
          </button>
        </form>
      </section>

      {/* Fixed streak ladder */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-light">
          Streak rewards
        </h2>
        <ul className="space-y-2">
          {RULES.rewardLadder.map((m) => {
            const got = earnedMilestones.has(m.streak);
            return (
              <li
                key={m.streak}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                  got ? "border-amber-500/40 bg-amber-500/10" : "border-slate-800 bg-slate-900"
                }`}
              >
                <span className="text-slate-300">
                  {got ? "🏅 " : ""}
                  <b className="text-white">{m.streak}-day</b> streak
                </span>
                <span className={got ? "text-amber-400" : "text-brand-light"}>
                  {got ? "Earned · " : ""}
                  {m.label}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
