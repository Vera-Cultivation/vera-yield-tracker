import { cx, Pill } from "./ui";
import { tones } from "../lib/logic";

/** Harvest-year pills + cycle cards, shared by AI Reports and the per-room report. */
export default function CyclePicker({ theme, cycles, year, cycle, onYear, onCycle }) {
  const light = theme === "light";
  const T = tones(theme);
  const CYCLES = cycles;
  const YEARS = [...new Set(cycles.map((c) => c.year))];
  const idx = CYCLES.map((c, i) => i).filter((i) => CYCLES[i].year === year);
  const last = CYCLES[idx[idx.length - 1]];

  return (
    <div data-noprint className={cx.card + " flex flex-col gap-3.5 px-6 py-5"}>
      <div className="flex flex-wrap items-center gap-3.5">
        <span className={cx.label}>Harvest year</span>
        <div className="flex flex-wrap gap-1.5">
          {YEARS.map((y) => (
            <Pill
              key={y}
              active={y === year}
              light={light}
              className="tnum !px-4 !py-2 !font-bold"
              onClick={() => {
                const ix = CYCLES.map((c, i) => i).filter((i) => CYCLES[i].year === y);
                onYear(y);
                onCycle(ix[ix.length - 1]);
              }}
            >
              {y}
            </Pill>
          ))}
        </div>
        <span className="text-[13px] text-vt4">
          {idx.length} harvest {idx.length === 1 ? "cycle" : "cycles"}
          {last && last.current ? " so far" : ""}
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-2.5">
        {idx.map((i) => {
          const c = CYCLES[i];
          const a = i === cycle;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onCycle(i)}
              className="rounded-[18px] border px-4 py-3.5 text-left text-vt1 transition-all duration-200 hover:!border-[rgba(16,185,129,0.4)]"
              style={{
                background: a ? (light ? "rgba(4,120,87,0.08)" : "rgba(16,185,129,0.10)") : "var(--vtile)",
                borderColor: a ? "rgba(16,185,129,0.45)" : "var(--vbd)",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-bold" style={{ color: a ? "var(--vaccent)" : "var(--vt1)" }}>
                  {c.label}
                </span>
                <span className="text-[11px] font-bold" style={{ color: c.current ? T.green[0] : "var(--vt4)" }}>
                  {c.current ? "LIVE" : "Closed"}
                </span>
              </div>
              <div className="tnum mt-1 text-xs text-vt3">{c.range}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
