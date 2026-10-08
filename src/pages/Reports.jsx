import CyclePicker from "../components/CyclePicker";
import { AdminBadge, cx, I, Icon, StatusBadge } from "../components/ui";
import * as api from "../lib/api";
import { dailyRecord, isoDay, priorityTone, reportFor, roomStatus, stampLabel, tone, tones, useAsync } from "../lib/logic";

export const closedTone = { color: "var(--vt3)", border: "var(--vbd2)", tint: "transparent", statusLabel: "Closed cycle" };

export function RecList({ recs, T, big = false }) {
  if (!recs.length) return <div className="mt-3 text-sm text-vt4">No recommendations yet.</div>;
  return (
    <div className="mt-3 flex flex-col gap-2">
      {recs.map(([t, p], j) => {
        const pt = priorityTone(T, p);
        return (
          <div
            key={t}
            className={
              "grid items-center gap-3.5 rounded-2xl border border-vbd bg-vtile " +
              (big ? "grid-cols-[36px_minmax(0,1fr)_auto] px-4 py-3.5" : "grid-cols-[32px_minmax(0,1fr)_auto] px-3.5 py-3")
            }
          >
            <span
              className={"flex items-center justify-center font-mono font-extrabold " + (big ? "h-9 w-9 rounded-xl text-[15px]" : "h-8 w-8 rounded-[11px] text-sm")}
              style={{ background: pt.pt, color: pt.pc }}
            >
              {j + 1}
            </span>
            <span className={(big ? "text-base" : "text-[15px]") + " font-semibold"}>{t}</span>
            <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: pt.pt, color: pt.pc }}>
              {p}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Daily stats for every room in one cycle. */
export function useCycleStats(cy) {
  return useAsync(() => api.loadDailyStats(isoDay(cy.start), isoDay(cy.end)), [cy.key, cy.days]);
}

export const aiStamp = (rg) => (rg.loading ? "writing…" : rg.generatedAt ? stampLabel(rg.generatedAt) : "not generated yet");

export default function Reports({ rooms, theme, cycles, year, cycle, onYear, onCycle, harvests, saved, regen, onRegenerate, onOpen }) {
  const T = tones(theme);
  const cy = cycles[cycle];
  const prevCy = cycle > 0 ? cycles[cycle - 1] : null;
  const statsQ = useCycleStats(cy);
  const stats = statsQ.data || [];

  const reports = rooms.map((r, i) => {
    const days = dailyRecord(cy, r, stats, saved);
    const rg = regen[r.id + "|" + cy.key] || {};
    const R = reportFor(r, cy, prevCy, harvests, days, rg);
    return { r, i, R, rg, days, t: cy.current ? tone(T, roomStatus(r).s) : closedTone };
  });

  return (
    <main className={cx.main}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className={cx.eyebrow}>AI Crop Reports</span>
            <AdminBadge />
          </div>
          <div className={cx.h1}>Every Room, Read Back to You.</div>
          <div className={cx.sub}>
            Each room's readings, leachate captures and harvest records go to Claude, which sends back the revenue outlook, growth and harvest pace for the cycle.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="whitespace-nowrap rounded-full border border-vbd bg-vcard px-4 py-2.5 text-[13px] font-semibold text-vt2">
            {cy.name + (cy.current ? " · Day " + cy.days + (cy.estDays ? " of ~" + cy.estDays : "") : " · closed")}
          </span>
          <button
            type="button"
            className={cx.btnPrimary}
            disabled={statsQ.loading}
            onClick={() => reports.forEach((x) => onRegenerate(x.r, cy, x.R, x.days))}
          >
            Regenerate All
          </button>
        </div>
      </div>

      <div className="mt-8">
        <CyclePicker theme={theme} cycles={cycles} year={year} cycle={cycle} onYear={onYear} onCycle={onCycle} />
      </div>

      {statsQ.error && (
        <div className="mt-5 rounded-[14px] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.10)] px-4 py-3 text-sm">Couldn't load readings: {statsQ.error}</div>
      )}

      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,620px),1fr))] gap-6">
        {reports.map(({ r, i, R, rg, days, t }) => (
          <div key={r.id} className={cx.card + " flex flex-col gap-[22px] p-7 transition-all duration-300 hover:!border-[rgba(16,185,129,0.3)]"}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[28px] font-bold leading-[1.1] tracking-[-0.025em]">{r.name}</div>
                <div className="mt-1.5 text-sm text-vt3">{cy.current ? r.stage : cy.name}</div>
              </div>
              <StatusBadge t={t} small />
            </div>
            <div className="rounded-[20px] border border-[rgba(16,185,129,0.22)] bg-[linear-gradient(160deg,rgba(16,185,129,0.08),transparent_70%)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-vaccent">
                  <Icon d={I.ai} size={15} />
                  Claude · {aiStamp(rg)}
                </div>
                <button
                  type="button"
                  disabled={statsQ.loading}
                  onClick={() => onRegenerate(r, cy, R, days)}
                  className="whitespace-nowrap rounded-full border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.08)] px-3.5 py-[7px] text-xs font-bold text-vaccent hover:bg-[rgba(16,185,129,0.16)]"
                >
                  {rg.loading ? "Generating…" : R.summary ? "Regenerate" : "Generate"}
                </button>
              </div>
              {R.headline && <div className="mt-3 text-[19px] font-bold leading-[1.35] tracking-[-0.015em]">{R.headline}</div>}
              <div className="mt-2 text-[15px] leading-relaxed text-vt2">{R.summary || "No AI report for this cycle yet. Press Generate to have Claude write one from this room's data."}</div>
              {rg.error && <div className="mt-2 text-[13px] text-[#ef4444]">Couldn't generate: {rg.error}</div>}
            </div>
            <div>
              <div className={cx.label}>Recommendations</div>
              <RecList recs={R.recs} T={T} />
            </div>
            <button type="button" onClick={() => onOpen(i)} className={cx.btnGhost + " self-start"}>
              <Icon d={I.ai} />
              Open Full Report
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
