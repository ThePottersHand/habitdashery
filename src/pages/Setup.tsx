import { useNavigate } from "react-router-dom";
import HabitForm from "../components/HabitForm";
import { RULES } from "../config/rules";
import { createCycle } from "../db/repo";
import { settle } from "../db/repo";

export default function Setup() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Start your 28 days</h1>
        <p className="text-sm text-slate-400">
          Set the habits you want to <b>do</b> and <b>don't</b> want to do, and the days they
          apply.
        </p>
      </header>

      <HabitForm
        initial={{ name: "", dayStartHour: RULES.defaultDayStartHour, habits: [] }}
        submitLabel="Start cycle"
        onSubmit={async (name, dayStartHour, habits) => {
          await createCycle(name, dayStartHour, habits);
          await settle();
          navigate("/", { replace: true });
        }}
      />
    </div>
  );
}
