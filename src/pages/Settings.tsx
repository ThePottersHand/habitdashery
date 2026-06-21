import { useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { THEMES, applyTheme } from "../config/themes";
import {
  exportData,
  getMeta,
  importData,
  resetAll,
  setNotify,
  setTheme
} from "../db/repo";
import { useInstallPrompt } from "../utils/install";
import {
  clearReminder,
  notificationsSupported,
  requestNotifyPermission,
  scheduleReminder,
  testNotification
} from "../utils/reminders";

export default function Settings() {
  const meta = useLiveQuery(() => getMeta(), []);
  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const fileRef = useRef<HTMLInputElement>(null);

  if (!meta) return <p className="text-slate-500">Loading…</p>;

  const chooseTheme = async (id: string) => {
    applyTheme(id);
    await setTheme(id);
  };

  const toggleNotify = async () => {
    if (!meta.notifyEnabled) {
      const perm = await requestNotifyPermission();
      if (perm !== "granted") {
        alert("Notifications were blocked by the browser.");
        return;
      }
      await setNotify(true, meta.notifyHour);
      scheduleReminder(meta.notifyHour);
      testNotification();
    } else {
      await setNotify(false, meta.notifyHour);
      clearReminder();
    }
  };

  const changeHour = async (hour: number) => {
    await setNotify(meta.notifyEnabled, hour);
    if (meta.notifyEnabled) scheduleReminder(hour);
  };

  const doExport = async () => {
    const json = await exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `habitdashery-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File) => {
    try {
      await importData(await file.text());
      location.href = "/";
    } catch (e) {
      alert(`Import failed: ${(e as Error).message}`);
    }
  };

  const reset = async () => {
    if (!confirm("Erase all habits, cycles and progress? This cannot be undone.")) return;
    await resetAll();
    location.href = "/";
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      {/* Theme */}
      <Section title="Theme">
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => {
            const unlocked = meta.unlockedThemes.includes(t.id);
            const active = meta.theme === t.id;
            return (
              <button
                key={t.id}
                disabled={!unlocked}
                onClick={() => chooseTheme(t.id)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  active ? "border-white text-white" : "border-slate-700 text-slate-300"
                } disabled:opacity-40`}
              >
                <span
                  className="h-4 w-4 rounded-full"
                  style={{ background: `rgb(${t.brand})` }}
                />
                {t.label}
                {!unlocked && " 🔒"}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">Locked themes unlock via streak rewards.</p>
      </Section>

      {/* Reminders */}
      <Section title="Daily reminder">
        {notificationsSupported() ? (
          <>
            <label className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Enable nudge</span>
              <input type="checkbox" checked={meta.notifyEnabled} onChange={toggleNotify} className="h-5 w-5 accent-brand" />
            </label>
            {meta.notifyEnabled && (
              <label className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Remind me at</span>
                <select
                  value={meta.notifyHour}
                  onChange={(e) => changeHour(Number(e.target.value))}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-white"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {h.toString().padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="text-xs text-slate-500">
              Best-effort: fires while the app is open. Reliable scheduled push needs a server
              (planned), and iOS requires the app be installed to Home Screen.
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-500">This browser doesn't support notifications.</p>
        )}
      </Section>

      {/* Install */}
      <Section title="Install">
        {installed ? (
          <p className="text-sm text-emerald-400">Installed to your device ✓</p>
        ) : canInstall ? (
          <button
            onClick={promptInstall}
            className="w-full rounded-lg bg-brand py-2 text-sm font-semibold text-white"
          >
            Add Habitdashery to your device
          </button>
        ) : (
          <p className="text-xs text-slate-500">
            Use your browser's “Install app” / “Add to Home Screen” option (Share menu on iOS).
          </p>
        )}
      </Section>

      {/* Data */}
      <Section title="Data">
        <div className="flex gap-2">
          <button
            onClick={doExport}
            className="flex-1 rounded-lg border border-slate-700 py-2 text-sm text-slate-200 hover:border-brand-light"
          >
            Export backup
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 rounded-lg border border-slate-700 py-2 text-sm text-slate-200 hover:border-brand-light"
          >
            Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
            }}
          />
        </div>
        <p className="text-xs text-slate-500">
          Your data lives only in this browser — export occasionally to back it up.
        </p>
        <button
          onClick={reset}
          className="w-full rounded-lg border border-red-900 bg-red-950/40 py-2 text-sm font-medium text-red-300 hover:bg-red-950"
        >
          Reset everything
        </button>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-light">{title}</h2>
      {children}
    </section>
  );
}
