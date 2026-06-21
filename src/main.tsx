import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { ensureSeeded, getMeta, settle } from "./db/repo";
import { applyTheme } from "./config/themes";
import { scheduleReminder } from "./utils/reminders";
import "./index.css";

// Seed defaults, apply the saved theme, and finalize any elapsed days — all
// writes, kept out of the read-only liveQueries — before the first render.
async function boot() {
  await ensureSeeded();
  const meta = await getMeta();
  applyTheme(meta.theme);
  if (meta.notifyEnabled) scheduleReminder(meta.notifyHour);
  await settle();
}

boot().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
});
