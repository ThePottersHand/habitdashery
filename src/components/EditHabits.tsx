import { useEffect, useState } from "react";
import { RULES } from "../config/rules";
import {
  ALL_DAYS,
  WEEKDAY_LABELS,
  type EditHabitRow,
  updateCycleHabits
} from "../db/repo";
import type { Habit, HabitType } from "../types";

interface Row extends EditHabitRow {
  key: string;
}

let keySeq = 0;
const fromHabit = (h: Habit): Row => ({
  key: `e${keySeq++}`,
  id: h.id,
  type: h.type,
  name: h.name,
  daysOfWeek: [...h.daysOfWeek]
});
const blank = (type: HabitType): Row => ({
  key: `e${keySeq++}`,
  type,
  name: "",
  daysOfWeek: [...ALL_DAYS]
});

export default function EditHabits({ cycleId, habits }: { cycleId: number; habits: Habit[] }) {
  const [rows, setRows] = useState<Row[]>(habits.map(fromHabit));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Re-sync local draft if the underlying habits change (e.g. after save).
  useEffect(() => {
    setRows(habits.map(fromHabit));
  }, [habits]);

  const update = (key: string, patch: Partial<Row>) => {
    setSaved(false);
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const remove = (key: string) => {
    setSaved(false);
    setRows((rs) => rs.filter((r) => r.key !== key));
  };
  const toggleDay = (key: string, day: number) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const has = r.daysOfWeek.includes(day);
        return {
          ...r,
          daysOfWeek: has
            ? r.daysOfWeek.filter((d) => d !== day)
            : [...r.daysOfWeek, day].sort((a, b) => a - b)
        };
      })
    );
  const add = (type: HabitType) => {
    if (rows.filter((r) => r.type === type).length >= RULES.maxHabitsPerType) return;
    setSaved(false);
    setRows((rs) => [...rs, blank(type)]);
  };

  const named = rows.filter((r) => r.name.trim().length > 0);
  const canSave = named.length > 0 && named.every((r) => r.daysOfWeek.length > 0) && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    await updateCycleHabits(
      cycleId,
      named.map((r) => ({ id: r.id, type: r.type, name: r.name, daysOfWeek: r.daysOfWeek }))
    );
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="space-y-4">
      <Group title="Do" rows={rows.filter((r) => r.type === "do")} type="do" {...{ update, remove, toggleDay, add }} />
      <Group title="Don't" rows={rows.filter((r) => r.type === "dont")} type="dont" {...{ update, remove, toggleDay, add }} />

      <button
        onClick={save}
        disabled={!canSave}
        className="w-full rounded-lg bg-brand py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save habit changes"}
      </button>
      <p className="text-xs text-slate-500">
        Edits apply from today forward; already-completed days keep their results.
      </p>
    </div>
  );
}

interface GroupProps {
  title: string;
  type: HabitType;
  rows: Row[];
  update: (key: string, patch: Partial<Row>) => void;
  remove: (key: string) => void;
  toggleDay: (key: string, day: number) => void;
  add: (type: HabitType) => void;
}

function Group({ title, type, rows, update, remove, toggleDay, add }: GroupProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {rows.map((r) => (
        <div key={r.key} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <div className="flex items-center gap-2">
            <input
              value={r.name}
              onChange={(e) => update(r.key, { name: e.target.value })}
              maxLength={RULES.maxHabitNameLength}
              placeholder="Name this habit"
              className="flex-1 bg-transparent text-white placeholder:text-slate-500 focus:outline-none"
            />
            <button
              onClick={() => remove(r.key)}
              className="text-slate-500 hover:text-red-400"
              aria-label="Remove habit"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex gap-1.5">
            {WEEKDAY_LABELS.map((lbl, day) => {
              const on = r.daysOfWeek.includes(day);
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(r.key, day)}
                  className={`h-8 w-8 rounded-full text-xs font-medium transition ${
                    on ? "bg-brand text-white" : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {rows.length < RULES.maxHabitsPerType && (
        <button
          onClick={() => add(type)}
          className="w-full rounded-lg border border-dashed border-slate-700 py-2 text-xs text-slate-400 hover:border-brand-light hover:text-brand-light"
        >
          + Add {title.toLowerCase()} habit
        </button>
      )}
    </div>
  );
}
