import CyclePicker from "../components/CyclePicker";
import { cx, I, Icon, StatusBadge } from "../components/ui";
import { avgOf, dailyRecord, fmt, mean, num, reportFor, roomStatus, tone, tones } from "../lib/logic";
import { aiStamp, closedTone, RecList, scheduledTone, useCycleStats } from "./Reports";

function SnapCard({ title, source, accent, rows }) {
  return (
    <div className="rounded-[20px] border border-vbd bg-vtile p-5" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-bold">{title}</span>
        <span className="text-[11px] font-bold" style={{ color: accent }}>
          {source}
        </span>
      </div>
      <div className="mt-2.5 flex flex-col">
        {rows.map(([l, v, s]) => (
          <div key={l} className="tnum flex justify-between gap-2.5 border-b border-vbd py-2.5 text-sm">
            <span className="text-vt3">{l}</span>
            <span className="text-right">
              <span className="font-bold">{v}</span> <span className="text-xs text-vt4">{s}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RoomReport({ rooms, ri, theme, cycles, year, cycle, onYear, onCycle, harvests, saved, regen, onRegenerate, canBackToRoom = true, onBack }) {
  const T = tones(theme);
  const r = rooms[ri];
  const cy = cycles[cycle];
  const prevCy = cycle > 0 ? cycles[cycle - 1] : null;
  const statsQ = useCycleStats(cy);
  const days = dailyRecord(cy, r, statsQ.data || [], saved);
  const rg = regen[r.id + "|" + cy.key] || {};
  const R = reportFor(r, cy, prevCy, harvests, days, rg);
  const t = cy.current ? tone(T, roomStatus(r).s) : cy.scheduled ? scheduledTone : closedTone;
  const inCycle = Boolean(cy.ids[r.id]);
  const cA = (k) => avgOf(days, k);

  const env = cy.current
    ? [
        ["Temperature", fmt(r.env.temp[0], 1, " °F"), "sp " + r.env.temp[1]],
        ["Humidity", fmt(r.env.rh[0], 0, "%"), "sp " + r.env.rh[1]],
        ["CO₂", fmt(r.env.co2[0], 0, " ppm"), "sp " + r.env.co2[1]],
      ]
    : [
        ["Avg temperature", fmt(cA("temp"), 1, " °F"), "sp " + r.env.temp[1]],
        ["Avg humidity", fmt(cA("rh"), 0, "%"), "sp " + r.env.rh[1]],
        ["Avg CO₂", fmt(cA("co2"), 0, " ppm"), "sp " + r.env.co2[1]],
      ];
  const root = cy.current
    ? [
        ["VWC", fmt(r.rz.vwc[0], 1, "%"), r.rz.vwc[1] + "–" + r.rz.vwc[2]],
        ["EC", fmt(r.rz.ec[0], 2, " dS/m"), r.rz.ec[1] + "–" + r.rz.ec[2]],
        ["Root zone temp", fmt(r.rz.rzt[0], 1, " °F"), r.rz.rzt[1] + "–" + r.rz.rzt[2]],
      ]
    : [
        ["Avg VWC", fmt(cA("vwc"), 1, "%"), r.rz.vwc[1] + "–" + r.rz.vwc[2]],
        ["Avg EC", fmt(cA("ec"), 2, " dS/m"), r.rz.ec[1] + "–" + r.rz.ec[2]],
        ["Avg root zone temp", fmt(cA("rzt"), 1, " °F"), "cycle avg"],
      ];
  const caps = saved.filter((x) => x.roomId === r.id && x.cycleKey === cy.key);
  const latest = caps[0];
  const leach = [
    ["Avg pH", fmt(mean(caps.map((x) => num(x.ph))), 1), "all captures"],
    ["Avg EC", fmt(mean(caps.map((x) => num(x.ec))), 1, " dS/m"), "all captures"],
    ["Captures", String(caps.length), latest ? "latest " + latest.date : "none logged"],
  ];

  const downloadPdf = () => {
    const title = document.title;
    document.title = "Vera Yield Tracker - AI Report - " + r.name + " - " + cy.name;
    window.print();
    setTimeout(() => {
      document.title = title;
    }, 1500);
  };

  return (
    <main className="relative mx-auto max-w-[1240px] px-10 pb-[90px] pt-8">
      <div data-noprint className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className={cx.btnGhost}>
          <Icon d={I.arrowLeft} size={15} stroke={2} />
          {canBackToRoom ? "Back to " + r.name : "All reports"}
        </button>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" disabled={statsQ.loading || !inCycle} onClick={() => onRegenerate(r, cy, R, days)} className={cx.btnGhost}>
            <Icon d={I.ai} />
            {rg.loading ? "Generating…" : R.summary ? "Regenerate" : "Generate"}
          </button>
          <button type="button" onClick={downloadPdf} className={cx.btnPrimary + " flex items-center gap-2"}>
            <Icon d={I.download} stroke={2} />
            Download PDF
          </button>
        </div>
      </div>

      <div className="mt-5">
        <CyclePicker theme={theme} cycles={cycles} rooms={rooms} roomId={r.id} year={year} cycle={cycle} onYear={onYear} onCycle={onCycle} />
      </div>

      {!inCycle && (
        <div className={cx.card + " mt-5 px-8 py-12 text-center text-[15px] text-vt3"}>
          {r.name} isn't part of {cy.name}. Pick one of {r.name}'s cycles above.
        </div>
      )}

      {(statsQ.error || rg.error) && (
        <div data-noprint className="mt-5 rounded-[14px] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.10)] px-4 py-3 text-sm">
          {statsQ.error ? "Couldn't load readings: " + statsQ.error : "Couldn't generate: " + rg.error}
        </div>
      )}

      {inCycle && (
      <article className={cx.card + " mt-5 flex flex-col gap-7 p-10"}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-vaccent">
              <Icon d={I.ai} />
              AI Crop Report
            </div>
            <div className="mt-3 text-[52px] font-bold leading-none tracking-[-0.035em]">{r.name}</div>
            <div className="mt-2.5 text-base text-vt3">{[r.stage, r.cultivar].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="flex flex-col items-end gap-2.5">
            <StatusBadge t={t} />
            <div className="tnum text-[15px] font-bold">{cy.name}</div>
            <div className="tnum text-[13px] text-vt3">{cy.range}</div>
            <div className="text-xs text-vt4">Generated {aiStamp(rg)} · Claude</div>
          </div>
        </div>
        <div className="h-px bg-[linear-gradient(90deg,transparent,rgba(16,185,129,0.3),transparent)]" />
        <div className="rounded-[22px] border border-[rgba(16,185,129,0.22)] bg-[linear-gradient(160deg,rgba(16,185,129,0.08),transparent_70%)] p-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-vaccent">Summary</div>
          {R.headline && <div className="mt-2.5 text-2xl font-bold leading-[1.3] tracking-[-0.02em]">{R.headline}</div>}
          <div className="mt-2.5 text-base leading-[1.65] text-vt2">{R.summary || "No AI report for this cycle yet. Press Generate to have Claude write one from this room's data."}</div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3.5">
          <SnapCard title="Environment" source="SkySpark" accent="var(--vaccent)" rows={env} />
          <SnapCard title="Root zone" source="Aroya" accent="var(--vcyan)" rows={root} />
          <SnapCard title="Leachate" source="leachate_log" accent="var(--vamber)" rows={leach} />
        </div>
        <div>
          <div className={cx.label}>Recommendations</div>
          <RecList recs={R.recs} T={T} big />
        </div>
        <div className="border-t border-vbd pt-[18px] text-xs text-vt4">
          <span>Built by Claude from SkySpark, Aroya and leachate data · EAH Enterprises, LLC</span>
        </div>
      </article>
      )}
    </main>
  );
}
