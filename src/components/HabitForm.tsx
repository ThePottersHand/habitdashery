import { useState } from "react";
import { RULES } from "../config/rules";
import { ALL_DAYS, WEEKDAY_LABELS, type NewHabitInput } from "../db/repo";
import type { HabitType } from "../types";

interface DraftHabit {
  key: string;
  type: HabitType;
  name: string;
  daysOfWeek: number[];
}

let keySeq = 0;
const draft = (type: HabitType, name = "", daysOfWeek = [...ALL_DAYS]): DraftHabit => ({
  key: `h${keySeq++}`,
  type,
  name,
  daysOfWeek
});

export interface HabitFormInitial {
  name: string;
  dayStartHour: number;
  habits: { type: HabitType; name: string; daysOfWeek: number[] }[];
}

interface Props {
  initial: HabitFormInitial;
  submitLabel: string;
  onSubmit: (name: string, dayStartHour: number, habits: NewHabitInput[]) => Promise<void>;
}

export default function HabitForm({ initial, submitLabel, onSubmit }: Props) {
  const [name, setName] = useState(initial.name);
  const [dayStartHour, setDayStartHour] = useState<number>(initial.dayStartHour);
  const [habits, setHabits] = useState<DraftHabit[]>(
    initial.habits.length
      ? initial.habits.map((h) => draft(h.type, h.name, [...h.daysOfWeek]))
      : [draft("do"), draft("dont")]
  );
  const [saving, setSaving] = useState(false);

  const update = (key: string, patch: Partial<DraftHabit>) =>
    setHabits((hs) => hs.map((h) => (h.key === key ? { ...h, ...patch } : h)));
  const remove = (key: string) => setHabits((hs) => hs.filter((h) => h.key !== key));
  const toggleDay = (key: string, day: number) =>
    setHabits((hs) =>
      hs.map((h) => {
        if (h.key !== key) return h;
        const has = h.daysOfWeek.includes(day);
        return {
          ...h,
          daysOfWeek: has
            ? h.daysOfWeek.filter((d) => d !== day)
            : [...h.daysOfWeek, day].sort((a, b) => a - b)
        };
      })
    );
  const addHabit = (type: HabitType) => {
    if (habits.filter((h) => h.type === type).length >= RULES.maxHabitsPerType) return;
    setHabits((hs) => [...hs, draft(type)]);
  };

  const named = habits.filter((h) => h.name.trim().length > 0);
  const canStart = named.length > 0 && named.every((h) => h.daysOfWeek.length > 0) && !saving;

  const submit = async () => {
    if (!canStart) return;
    setSaving(true);
    await onSubmit(
      name,
      dayStartHour,
      named.map((h) => ({ type: h.type, name: h.name, daysOfWeek: h.daysOfWeek }))
    );
  };

  const dos = habits.filter((h) => h.type === "do");
  const donts = habits.filter((h) => h.type === "dont");

  return (
    <div className="space-y-6">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-300">Cycle name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Summer reset"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500 focus:border-brand-light focus:outline-none"
        />
      </label>

      <Section
        title="Do habits"
        hint="Things to complete each scheduled day"
        habits={dos}
        full={dos.length >= RULES.maxHabitsPerType}
        onUpdate={update}
        onRemove={remove}
        onToggleDay={toggleDay}
        onAdd={() => addHabit("do")}
      />
      <Section
        title="Don't habits"
        hint="Things to avoid — assumed kept unless you mark a slip"
        habits={donts}
        full={donts.length >= RULES.maxHabitsPerType}
        onUpdate={update}
        onRemove={remove}
        onToggleDay={toggleDay}
        onAdd={() => addHabit("dont")}
      />

      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-300">A new day starts at</span>
        <select
          value={dayStartHour}
          onChange={(e) => setDayStartHour(Number(e.target.value))}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-brand-light focus:outline-none"
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {h.toString().padStart(2, "0")}:00
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          Pick a later hour (e.g. 04:00) if you're a night owl.
        </span>
      </label>

      <button
        onClick={submit}
        disabled={!canStart}
        className="w-full rounded-xl bg-brand py-3 font-semibold text-white transition enabled:active:scale-[0.99] disabled:opacity-40"
      >
        {saving ? "Starting…" : submitLabel}
      </button>
    </div>
  );
}

interface SectionProps {
  title: string;
  hint: string;
  habits: DraftHabit[];
  full: boolean;
  onUpdate: (key: string, patch: Partial<DraftHabit>) => void;
  onRemove: (key: string) => void;
  onToggleDay: (key: string, day: number) => void;
  onAdd: () => void;
}

function Section({ title, hint, habits, full, onUpdate, onRemove, onToggleDay, onAdd }: SectionProps) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-light">{title}</h2>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <div className="space-y-3">
        {habits.map((h) => (
          <div key={h.key} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <div className="flex items-center gap-2">
              <input
                value={h.name}
                onChange={(e) => onUpdate(h.key, { name: e.target.value })}
                maxLength={RULES.maxHabitNameLength}
                placeholder="Name this habit"
                className="flex-1 bg-transparent text-white placeholder:text-slate-500 focus:outline-none"
              />
              <button
                onClick={() => onRemove(h.key)}
                className="text-slate-500 hover:text-red-400"
                aria-label="Remove habit"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 flex gap-1.5">
              {WEEKDAY_LABELS.map((lbl, day) => {
                const on = h.daysOfWeek.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => onToggleDay(h.key, day)}
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
      </div>
      {!full && (
        <button
          onClick={onAdd}
          className="w-full rounded-lg border border-dashed border-slate-700 py-2 text-sm text-slate-400 hover:border-brand-light hover:text-brand-light"
        >
          + Add {title.toLowerCase()}
        </button>
      )}
    </section>
  );
}
