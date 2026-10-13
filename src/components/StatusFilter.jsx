import { cx, tabStyle } from "./ui";

// Cycle status filter shared by Harvests and Data Entry.
const CYCLE_STATUS = [
  ["all", "All"],
  ["current", "In progress"],
  ["scheduled", "Scheduled"],
  ["closed", "Closed"],
];
const statusOf = (c) => (c.current ? "current" : c.scheduled ? "scheduled" : "closed");
export const matchStatus = (c, st) => st === "all" || statusOf(c) === st;
/** In progress when something is running, else All, so the list is never empty on open. */
export const defaultStatus = (cycles) => (cycles.some((c) => c.current) ? "current" : "all");
export const statusLabel = (st) => (CYCLE_STATUS.find(([k]) => k === st) || [])[1] || st;

/** Segmented All / In progress / Scheduled / Closed, each with how many of `cycles` it matches. */
export default function StatusFilter({ cycles, value, onChange, light, label = "Status" }) {
  return (
    <div className="flex flex-wrap items-center gap-3.5">
      {label && <span className={cx.label}>{label}</span>}
      <div className="flex flex-wrap gap-1 rounded-full border border-vbd bg-vcard p-1">
        {CYCLE_STATUS.map(([k, text]) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            style={tabStyle(value === k, light)}
            className="flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-[7px] text-[13px] font-semibold transition-all duration-200 hover:!text-vt1"
          >
            {text}
            <span className="tnum rounded-full bg-vsoft2 px-1.5 text-[11px] font-bold">{cycles.filter((c) => matchStatus(c, k)).length}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
