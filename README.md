# Habitdashery

A mobile-first, installable **PWA** for 4-week habit reinforcement cycles. Build the habits
you want to **do**, avoid the ones you **don't**, keep your streak alive with a limited pool of
**skips**, and earn **stars** for perfect days. After 28 days you review your stats and re-commit.

Offline-first and private — all data lives on your device (IndexedDB). No account, no backend.

## Features

- **Do / Don't habits** with per-weekday scheduling (a day with nothing scheduled is a streak-safe rest day).
- **Daily check-off** — complete Do habits, mark slips on Don'ts, with live day status.
- **Stars vs. streak** — a *perfect* day (no skips) earns a star; a skip protects the streak but costs the star.
- **Skips** — 5 per cycle, replenished only by streak rewards.
- **Streak rewards** — milestones at 3/7/14/21/28 days grant skips, bonus stars, and theme unlocks.
- **Custom star goals** — set your own "at N stars, I get …" targets with live progress.
- **Progress calendar** — 4-week grid, streak/star stats, per-habit success rates.
- **Cycle review & rollover** — end-of-cycle summary, then adjust habits and start fresh (stars carry over).
- **Themes**, **JSON export/import** backup, **install-to-device**, and best-effort daily reminders.

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) (CSS-variable theming)
- [Dexie.js](https://dexie.org/) over IndexedDB (`dexie-react-hooks` live queries)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (manifest + Workbox service worker)
- [Vitest](https://vitest.dev/) for the rules engine

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build    # type-check + production build
npm run preview  # serve the production build
npm test         # run the rules-engine unit tests
```

## Project layout

```
src/
  engine/      # pure, unit-tested rules (day classification, streaks)
  db/          # Dexie schema + data-access repo (settle pass, rewards, rollover)
  config/      # tunable rules + color themes
  pages/       # Setup, Today, Progress, Rewards, Review, Settings
  components/  # HabitForm, BottomNav, ErrorBoundary
  utils/       # install prompt, reminders
```

See [PLAN.md](PLAN.md) for the full product and technical design, including the mechanics
of stars, skips, streaks, and rewards.

## Deploy (Cloudflare Pages)

This is a static PWA served from the domain root. Connect the repo in the Cloudflare
Pages dashboard with:

| Setting | Value |
|---|---|
| Framework preset | None (or Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `22` (pinned via `.nvmrc`) |

`public/_redirects` (`/* /index.html 200`) provides the SPA fallback so client-side
routes resolve, and the service worker uses an `index.html` navigate fallback for
offline deep links. No environment variables are required.

## Roadmap

Implemented: P0–P7 (full offline app). Not yet built: optional accounts + cloud sync for
multi-device (P8).

## License

MIT
