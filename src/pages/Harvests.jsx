import { useMemo, useState } from "react";
import { AdminBadge, cx, I, Icon, NoData, Pill, tabStyle } from "../components/ui";
import * as api from "../lib/api";
import StatusFilter, { defaultStatus, matchStatus, statusLabel } from "../components/StatusFilter";
import { avgOf, cycleRooms, cycleState, dailyRecord, fdate, fmt, isoDay, pickCycle, tones, useAsync } from "../lib/logic";

const PER_PAGE = 14;
const fmtP1 = (p) => (p ? (String(p).includes("%") ? p : p + "%") : "—");

const fday = (d) => fdate(d) + " " + d.getFullYear();
const DAY = 86400000;

/** One cycle: name, status, room, start → end, and progress (running), countdown (scheduled) or length (closed). */
function CycleCard({ c, rooms, T, light, active, onClick }) {
  const [stLabel, stTone] = cycleState(c, T);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = c.open ? c.estEnd : c.end;
  const pct = c.current && c.estDays ? Math.min(1, c.days / c.estDays) : c.scheduled ? 0 : 1;
  const over = c.current && c.estDays ? c.days - c.estDays : 0; // days past the estimated end
  const barColor = over > 0 ? T.amber[0] : c.current ? T.green[0] : c.scheduled ? "transparent" : "var(--vt4)";
  const startsIn = c.scheduled ? Math.round((c.start - today) / DAY) : 0;
  const foot = c.current
    ? ["Day " + c.days + (c.estDays ? " of ~" + c.estDays : ""), over > 0 ? over + (over === 1 ? " day" : " days") + " past est. end" : c.estDays ? Math.round(pct * 100) + "%" : ""]
    : c.scheduled
    ? ["Starts in " + startsIn + (startsIn === 1 ? " day" : " days"), "~" + c.days + " days planned"]
    : [c.days + " days", "Harvested"];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-3xl border p-5 text-left text-vt1 transition-all duration-[250ms] hover:-translate-y-0.5 hover:!border-[rgba(16,185,129,0.4)]"
      style={{
        background: active ? (light ? "rgba(4,120,87,0.07)" : "rgba(16,185,129,0.08)") : "var(--vcard)",
        borderColor: active ? "rgba(16,185,129,0.5)" : "var(--vbd)",
        boxShadow: active ? "0 0 0 1px rgba(16,185,129,0.25)" : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[19px] font-bold leading-tight tracking-[-0.015em]">{c.label}</div>
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-vbd bg-vtile px-2.5 py-[3px] text-xs font-semibold text-vt2">
            <span className="h-1.5 w-1.5 rounded-full bg-vcyan" />
            {cycleRooms(c, rooms) || "No rooms"}
          </div>
        </div>
        <span
          className="whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold"
          style={{ color: stTone ? stTone[0] : "var(--vt3)", borderColor: stTone ? stTone[1] : "var(--vbd2)", background: stTone ? stTone[2] : "transparent" }}
        >
          {stLabel}
        </span>
      </div>

      <div className="tnum mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-vbd bg-vtile px-3.5 py-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-vt4">Flower start</div>
          <div className="mt-1 text-sm font-semibold">{fday(c.start)}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-vt4">{c.open ? "Est. harvest" : "Harvest"}</div>
          <div className="mt-1 text-sm font-semibold">{endDate ? fday(endDate) : "—"}</div>
        </div>
      </div>

      <div className="mt-auto pt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-vsoft2">
          <div className="h-full rounded-full" style={{ width: pct * 100 + "%", background: barColor }} />
        </div>
        <div className="tnum mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-vt2">{foot[0]}</span>
          <span style={{ color: over > 0 ? T.amber[0] : "var(--vt4)" }}>{foot[1]}</span>
        </div>
      </div>
    </button>
  );
}

export default function Harvests({ rooms, theme, cycles, defaultCycle, saved }) {
  const light = theme === "light";
  const T = tones(theme);
  const [hCycle, setHCycle] = useState(defaultCycle);
  const [hYear, setHYear] = useState(cycles[defaultCycle].year);
  const [hRoom, setHRoom] = useState(null); // room id; null = first room in the cycle
  const [hMetric, setHMetric] = useState("temp");
  const [hPage, setHPage] = useState(0);
  const [hStatus, setHStatus] = useState(() => defaultStatus(cycles));
  const YEARS = [...new Set(cycles.map((c) => c.year))];
  const yearIdx = cycles.map((c, i) => i).filter((i) => cycles[i].year === hYear);
  const shownIdx = yearIdx.filter((i) => matchStatus(cycles[i], hStatus));
  // Changing year or status keeps the picked cycle if it's still on screen, else picks one that is.
  const pickYearStatus = (y, st) => {
    const idx = cycles.map((c, i) => i).filter((i) => cycles[i].year === y && matchStatus(cycles[i], st));
    setHYear(y);
    setHStatus(st);
    if (!idx.includes(hCycle) && idx.length) {
      setHCycle(pickCycle(cycles, idx));
      setHPage(0);
    }
  };

  const hc = cycles[hCycle];
  // Only rooms that are part of the picked cycle.
  const hRooms = rooms.filter((r) => hc.ids[r.id]);
  const hr = hRooms.find((r) => r.id === hRoom) || hRooms[0] || rooms[0];
  const statsQ = useAsync(() => api.loadDailyStats(isoDay(hc.start), isoDay(hc.end), hr.id), [hc.key, hc.days, hr.id]);
  const days = useMemo(() => dailyRecord(hc, hr, statsQ.data || [], saved), [hc, hr, statsQ.data, saved]);
  const withData = days.filter((x) => x.temp != null || x.vwc != null || x.caps).length;

  const summary = [
    ["Days with data", String(withData), "of " + hc.days + (hc.current ? " so far" : " in cycle")],
    ["Avg temp", fmt(avgOf(days, "temp"), 1, " °F"), "setpoint " + hr.env.temp[1]],
    ["Avg humidity", fmt(avgOf(days, "rh"), 0, "%"), "setpoint " + hr.env.rh[1] + "%"],
    ["Avg VWC", fmt(avgOf(days, "vwc"), 1, "%"), "Aroya"],
  ];

  const mDefs = {
    temp: ["Temperature", "°F", hr.env.temp[2], hr.env.temp[3], 1],
    rh: ["Humidity", "%", hr.env.rh[2], hr.env.rh[3], 0],
    co2: ["CO₂", "ppm", hr.env.co2[2], hr.env.co2[3], 0],
    vwc: ["VWC", "%", hr.rz.vwc[1], hr.rz.vwc[2], 1],
    ec: ["EC", "dS/m", hr.rz.ec[1], hr.rz.ec[2], 1],
  };
  const acc = light ? "#047857" : "#10b981";
  const mCol = { temp: acc, rh: light ? "#0e7490" : "#22d3ee", co2: light ? "#0f766e" : "#5eead4", vwc: light ? "#0e7490" : "#22d3ee", ec: light ? "#b45309" : "#fbbf24" };
  const md = mDefs[hMetric];
  const series = days.map((x) => x[hMetric]);
  const present = series.filter((v) => v != null);
  const yMin = Math.min(md[2], ...present) * 0.98;
  const yMax = Math.max(md[3], ...present) * 1.02;
  const H = 240;
  const yy = (v) => 8 + (1 - (v - yMin) / (yMax - yMin)) * (H - 16);
  let pen = false;
  const path = series
    .map((v, i) => {
      if (v == null) {
        pen = false;
        return "";
      }
      const seg = (pen ? "L" : "M") + ((i / Math.max(1, series.length - 1)) * 1000).toFixed(1) + "," + yy(v).toFixed(1);
      pen = true;
      return seg;
    })
    .join(" ");
  const dAt = (n) => {
    const x = new Date(hc.start);
    x.setDate(x.getDate() + n);
    return fdate(x) + " " + x.getFullYear();
  };

  const pages = Math.max(1, Math.ceil(days.length / PER_PAGE));
  const pg = Math.min(hPage, pages - 1);
  const desc = days.slice().reverse().slice(pg * PER_PAGE, pg * PER_PAGE + PER_PAGE);
  const warn = light ? "#b45309" : "#fbbf24";
  const manual = saved.filter((x) => x.cycleKey === hc.key && x.roomId === hr.id);
  const tableCols = "grid-cols-[70px_120px_repeat(7,minmax(0,1fr))_minmax(0,1.6fr)]";

  return (
    <main className={cx.main}>
      <div>
        <div className="flex items-center gap-2.5">
          <span className={cx.eyebrow}>Harvest History</span>
          <AdminBadge />
        </div>
        <div className={cx.h1}>Harvest Cycles</div>
        <div className={cx.sub}>Pick a cycle, then a room, to see every day of its record — climate, root zone and leachate — from first day to harvest.</div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className={cx.label}>Harvest year</span>
          <div className="flex flex-wrap gap-1.5">
            {YEARS.map((y) => (
              <Pill key={y} active={y === hYear} light={light} className="tnum !px-4 !py-2 !font-bold" onClick={() => pickYearStatus(y, hStatus)}>
                {y}
              </Pill>
            ))}
          </div>
        </div>
        <StatusFilter cycles={yearIdx.map((i) => cycles[i])} value={hStatus} onChange={(st) => pickYearStatus(hYear, st)} light={light} />
      </div>

      {!shownIdx.length ? (
        <div className={cx.card + " mt-4 px-8 py-10 text-center text-[15px] text-vt3"}>
          No {statusLabel(hStatus).toLowerCase()} cycles in {hYear}.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,270px),1fr))] gap-4">
          {shownIdx.map((i) => (
            <CycleCard
              key={cycles[i].key}
              c={cycles[i]}
              rooms={rooms}
              T={T}
              light={light}
              active={i === hCycle}
              onClick={() => {
                setHCycle(i);
                setHPage(0);
              }}
            />
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {hRooms.map((r) => (
          <Pill
            key={r.id}
            active={r.id === hr.id}
            light={light}
            onClick={() => {
              setHRoom(r.id);
              setHPage(0);
            }}
          >
            {r.name}
          </Pill>
        ))}
      </div>

      {statsQ.error && (
        <div className="mt-5 rounded-[14px] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.10)] px-4 py-3 text-sm">Couldn't load readings: {statsQ.error}</div>
      )}

      <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3.5">
        {summary.map(([l, v, s]) => (
          <div key={l} className={cx.card + " px-5 py-[18px]"}>
            <div className={cx.label}>{l}</div>
            <div className="tnum mt-2 text-[28px] font-extrabold leading-none tracking-[-0.03em]">{v}</div>
            <div className="mt-1.5 text-xs text-vt4">{s}</div>
          </div>
        ))}
      </div>

      <div className={cx.card + " mt-5 p-[26px]"}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xl font-bold tracking-[-0.015em]">
              {hr.name} · {md[0]} ({md[1]})
            </div>
            <div className="mt-1 text-[13px] text-vt3">Daily average · shaded band is the target range</div>
          </div>
          <div className="flex flex-wrap gap-1 rounded-[20px] border border-vbd bg-vtile p-1">
            {Object.keys(mDefs).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setHMetric(k)}
                style={tabStyle(k === hMetric, light)}
                className="whitespace-nowrap rounded-full border px-3.5 py-[7px] text-[13px] font-semibold"
              >
                {mDefs[k][0]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-[48px_minmax(0,1fr)] gap-2.5">
          <div className="flex h-60 flex-col items-end justify-between font-mono text-[11px] text-vt4">
            {[yMax, (yMax + yMin) / 2, yMin].map((v, i) => (
              <span key={i}>{v.toFixed(md[4])}</span>
            ))}
          </div>
          <div className="relative h-60 overflow-hidden rounded-[14px] border border-vbd bg-vtile">
            <svg viewBox="0 0 1000 240" preserveAspectRatio="none" className="absolute inset-0 block h-full w-full">
              <rect x="0" y={yy(md[3]).toFixed(1)} width="1000" height={Math.max(0, yy(md[2]) - yy(md[3])).toFixed(1)} fill="rgba(16,185,129,0.12)" />
              <path d={path} fill="none" stroke={mCol[hMetric]} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
            {/* A dot on every day with data, so single days and days between gaps still show. */}
            {series.map((v, i) =>
              v == null ? null : (
                <span
                  key={i}
                  title={days[i].date + ": " + v.toFixed(md[4]) + " " + md[1]}
                  className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ left: (i / Math.max(1, series.length - 1)) * 100 + "%", top: (yy(v) / H) * 100 + "%", background: mCol[hMetric] }}
                />
              )
            )}
            {!present.length && <NoData>{statsQ.loading ? "Loading readings…" : "No readings for this room in this cycle."}</NoData>}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-[48px_minmax(0,1fr)] gap-2.5">
          <span />
          <div className="tnum flex justify-between text-xs text-vt4">
            {[dAt(0), dAt(Math.floor(hc.days / 2)), dAt(hc.days - 1)].map((x, i) => (
              <span key={i}>{x}</span>
            ))}
          </div>
        </div>
      </div>

      <div className={cx.card + " mt-5 overflow-hidden"}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-vbd px-6 py-5">
          <div className="text-lg font-bold">Daily record</div>
          <div className="flex items-center gap-2.5">
            <span className="tnum text-[13px] text-vt3">
              Days {days.length - pg * PER_PAGE - desc.length + 1}–{days.length - pg * PER_PAGE} of {days.length} · newest first
            </span>
            {[
              [I.chevLeft, () => setHPage(Math.max(0, pg - 1)), pg === 0],
              [I.chevRight, () => setHPage(Math.min(pages - 1, pg + 1)), pg >= pages - 1],
            ].map(([d, fn, dim], k) => (
              <button
                key={k}
                type="button"
                onClick={fn}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-vbd2 bg-vsoft text-vt1 hover:border-[rgba(16,185,129,0.4)]"
                style={{ opacity: dim ? 0.35 : 1 }}
              >
                <Icon d={d} size={15} />
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[1080px]">
            <div className={"grid gap-3 border-b border-vbd px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-vt3 " + tableCols}>
              <span>Day</span>
              <span>Date</span>
              <span className="text-vaccent">Temp °F</span>
              <span className="text-vaccent">RH %</span>
              <span className="text-vaccent">CO₂</span>
              <span className="text-vcyan">VWC %</span>
              <span className="text-vcyan">EC</span>
              <span className="text-vamber">Leach pH</span>
              <span className="text-vamber">Leach EC</span>
              <span>Notes</span>
            </div>
            {desc.map((x) => (
              <div key={x.d} className={"tnum grid items-center gap-3 border-b border-vbd px-6 py-3 text-sm hover:bg-vsoft " + tableCols}>
                <span className="font-mono text-[13px] text-vt3">D{x.d}</span>
                <span className="text-vt2">{x.date}</span>
                <span className="font-semibold" style={{ color: x.spike ? warn : "var(--vt1)" }}>
                  {fmt(x.temp, 1)}
                </span>
                <span>{fmt(x.rh, 0)}</span>
                <span>{fmt(x.co2, 0)}</span>
                <span>{fmt(x.vwc, 1)}</span>
                <span>{fmt(x.ec, 2)}</span>
                <span className="text-vt2">{fmt(x.lph, 1)}</span>
                <span className="text-vt2">{fmt(x.lec, 1)}</span>
                <span className="text-[13px]" style={{ color: x.note ? "var(--vt2)" : "var(--vt4)" }}>
                  {x.note || (x.spike ? "Temp above target" : "—")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {manual.length > 0 && (
        <div className={cx.card + " mt-5 p-6"}>
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold">Leachate captures</span>
            <span className="rounded-full border border-[rgba(251,191,36,0.35)] bg-[rgba(251,191,36,0.10)] px-2.5 py-1 text-[11px] font-bold text-vamber">Supabase · leachate_log</span>
          </div>
          <div className="mt-3 flex flex-col">
            {manual.map((m) => (
              <div key={m.id} className="tnum grid grid-cols-[100px_130px_repeat(4,minmax(0,1fr))_minmax(0,2fr)] gap-3 border-b border-vbd px-1 py-3 text-sm">
                <span className="font-mono text-[13px]">{m.date}</span>
                <span className="font-semibold">{m.strain || "—"}</span>
                <span>pH {m.ph || "—"}</span>
                <span>EC {m.ec || "—"}</span>
                <span>{m.vol || "—"} mL</span>
                <span>{fmtP1(m.p1)} of P1</span>
                <span className="text-vt3">{m.notes || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
