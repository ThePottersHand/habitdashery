# Habitdashery — Product & Technical Plan

A mobile-first, installable **PWA** for 4-week habit reinforcement cycles. Each day the
user works a checklist of **Do** habits (complete them) and **Don't** habits (avoid them).
Completing everything earns a **star**; consecutive complete days build a **streak**;
streaks unlock **rewards**; a pool of **skips** protects the streak on rough days. After
28 days the user reviews stats and re-commits.

## Locked decisions (v1)

- **Skips:** 5 per 4-week cycle, replenished only by streak rewards (scarce & strategic).
- **Storage:** On-device only — Dexie/IndexedDB, no accounts, no backend. JSON export/import for backup.
- **Stack:** React + Vite + TypeScript + Tailwind + `vite-plugin-pwa` + Zustand + day.js.
- **Notifications:** best-effort "open-the-app" nudges in v1; true push deferred to optional P8.

## Mechanics (rules engine)

### Habit scheduling
- Each habit is assigned the **weekdays it applies to** (any subset of Sun–Sat).
- A day's **required set** = habits scheduled for that weekday. Off-schedule habits don't count.
- A day with **no scheduled habits** is a **rest day**: streak continues, but no star is available.

### Day completion
- A **day** runs from a configurable *day-start* time (default local midnight; option for 4 AM).
- **Do habit** states: `pending → done` (toggle) or `skipped`.
- **Don't habit** states: default `avoided` (success), `slipped` (broke it), or `skipped`.
  Don'ts assumed successful unless marked as a slip; confirmed at day-end.
- A day is **Complete** if every habit is `done`/`avoided` or covered by a skip,
  with at least one non-skipped success.
- A day is **Failed** if any habit ends `pending`/`slipped` with no skip applied
  (including days the app wasn't opened).

### Stars vs. streak
- **Streak** = consecutive non-failed days. A skip keeps the day from failing → preserves the streak.
- **Star** = a *perfect* day: every habit genuinely succeeded with **no skips used**.
  Skips save your streak but cost you the star that day.

### Skips
- A skip covers **one habit for one day**. Miss two habits → costs two skips.
- Pool: **5 skips per 4-week cycle**, topped up only by streak rewards.
- Applied from Today view up until the day-start cutoff of the next day.

### Reward ladder (per cycle, fires once each)
| Streak | Reward |
|---|---|
| 3 days | +1 skip |
| 7 days | Bonus star + badge |
| 14 days | +2 skips |
| 21 days | Bonus star + unlock new theme |
| 28 days | "Cycle Complete" badge + 2 carry-over skips into next cycle |

All numbers live in a single config file (`src/config/rules.ts`) for easy tuning.

### User-defined star goals
- Beyond the fixed ladder, users set their own targets: **"at N stars → <reward I promise myself>"**.
- Stored in a `starGoals` table; shown with live progress on the Rewards screen; marked
  achieved once the running star total reaches the threshold. Pure self-motivation, no in-app payout.

### Cycle lifecycle
- Day 1 starts when the user finishes habit setup.
- Habits **locked during the cycle**; adjustments happen at review. Whole-cycle **pause** allowed (freezes streak).
- Day 28 → **Review screen**: completion rate, stars, longest streak, per-habit success %, then edit & restart.

## Screens
1. **Onboarding / Setup** — name, Do list + Don't list, day-start time.
2. **Today** (home) — two grouped checklists, per-habit skip, live day status, skip balance, streak.
3. **Progress** — 4×7 calendar grid, streak counter, stats.
4. **Rewards** — skip balance, milestone ladder, badges.
5. **Review** — end-of-cycle summary + adjust habits → start new cycle.
6. **Settings** — day-start time, notifications, theme, data export/import.

## Architecture
- Vite + React + TS + Tailwind, `vite-plugin-pwa` (manifest + Workbox SW).
- **Dexie.js** over IndexedDB; Zustand state; day.js dates. Offline-first, no backend.

### Data model (Dexie tables)
- `cycles` — `{ id, name, startDate, endDate, dayStartHour, status }`
- `habits` — `{ id, cycleId, type:'do'|'dont', name, order, daysOfWeek }`
- `days` — `{ id, cycleId, date, status, starEarned }`
- `entries` — `{ id, dayId, habitId, status }`
- `rewards` — `{ id, cycleId, milestone, type, amount, grantedAt }`
- `starGoals` — `{ id, label, starsRequired, createdAt, achievedAt? }`
- `meta` — skip balance, totals, longest streak, theme, settings

### Engineering notes
- Streak/star/skip computation is a **pure, unit-tested function** over `days` + `entries` + config.
- **Missed-day "settle" pass** on app open finalizes elapsed days before rendering Today.
- JSON export/import in Settings (IndexedDB can be cleared by the OS).

## Build phases
- **P0** ✅ Scaffold: Vite + PWA manifest + SW, installable shell, Dexie setup.
- **P1** ✅ Setup flow + habit/cycle data layer.
- **P2** ✅ Today view + completion toggling.
- **P3** ✅ Rules engine: classify/streak (unit-tested) + missed-day settle pass at startup.
- **P4** ✅ Rewards ladder granting + earned badges.
- **P5** ✅ Progress calendar + stats.
- **P6** ✅ Cycle review + rollover (carry-over skips, lifetime stars).
- **P7** ✅ Themes (reward-unlocked), export/import, install prompt, best-effort reminders.
- **P8** *(optional, not built)* — Accounts + cloud sync.

All of P0–P7 are implemented and building; `npm test` covers the engine (14 tests).
