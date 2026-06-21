import { useLiveQuery } from "dexie-react-hooks";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import { getActiveCycle, getMeta } from "./db/repo";
import Setup from "./pages/Setup";
import Today from "./pages/Today";
import Progress from "./pages/Progress";
import Rewards from "./pages/Rewards";
import Review from "./pages/Review";
import Settings from "./pages/Settings";

export default function App() {
  const location = useLocation();
  const state = useLiveQuery(async () => {
    const meta = await getMeta();
    const activeCycle = await getActiveCycle();
    return { meta, hasActiveCycle: !!activeCycle };
  }, []);

  // First render before Dexie resolves.
  if (state === undefined) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">Loading…</div>
    );
  }

  const { meta, hasActiveCycle } = state;
  const path = location.pathname;
  const needsSetup = !meta.onboardingComplete;
  // Onboarded but the active cycle ended → the user must review & roll over.
  const needsReview = !needsSetup && !hasActiveCycle;

  if (needsSetup && path !== "/setup") return <Navigate to="/setup" replace />;
  if (!needsSetup && path === "/setup") return <Navigate to="/" replace />;
  if (needsReview && path !== "/review") return <Navigate to="/review" replace />;
  if (!needsReview && path === "/review") return <Navigate to="/" replace />;

  const showNav = !needsSetup && !needsReview;

  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        <Routes>
          <Route path="/setup" element={<Setup />} />
          <Route path="/review" element={<Review />} />
          <Route path="/" element={<Today />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}
