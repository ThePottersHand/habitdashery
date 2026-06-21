import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/", label: "Today", icon: "✓" },
  { to: "/progress", label: "Progress", icon: "▦" },
  { to: "/rewards", label: "Rewards", icon: "★" },
  { to: "/settings", label: "Settings", icon: "⚙" }
];

export default function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-800 bg-slate-900/95 backdrop-blur">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === "/"}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              isActive ? "text-brand-light" : "text-slate-400"
            }`
          }
        >
          <span className="text-lg leading-none">{t.icon}</span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
