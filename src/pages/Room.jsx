import { useMemo } from "react";
import { cx, Gauge, I, Icon, NoData, SourceBadge, SRC } from "../components/ui";
import * as api from "../lib/api";
import { ENV_DEFS, RZ_DEFS, cycleName, fmt, fmtDay, gppOf, linePath, num, relativeTime, roomStatus, status, statusText, tone, tones, useAsync } from "../lib/logic";

const HOUR = 3600000;

function SectionHead({ n, title, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-baseline gap-3.5">
        <span className="font-mono text-sm text-vt4">{n}</span>
        <span className="text-[26px] font-bold tracking-[-0.02em]">{title}</span>
      </div>
      <div className="flex items-center gap-2.5">{children}</div>
    </div>
  );
}

/** Points of one metric inside the last `hours`, as { vals, xs } for linePath. */
function windowed(series, k, hours, now) {
  const start = now - hours * HOUR;
  const pts = series.filter((p) => p[k] != null && new Date(p.ts).getTime() >= start);
  return { vals: pts.map((p) => p[k]), xs: pts.map((p) => (new Date(p.ts).getTime() - start) / (hours * HOUR)) };
}

function EnvCard({ def, room, series, now, T, light }) {
  const [k, label, unit, dp, min, max] = def;
  const e = room.env[k];
  const t = tone(T, status(e[0], e[2], e[3], e[4]));
  const w = windowed(series, k, 24, now);
  const yMin = Math.min(e[2] - e[4] * 2, ...w.vals);
  const yMax = Math.max(e[3] + e[4] * 2, ...w.vals);
  const H = 110;
  const pad = H * 0.05;
  const y = (v) => pad + (1 - (v - yMin) / (yMax - yMin)) * (H - 2 * pad);
  const dev = e[0] == null ? null : e[0] - e[1];
  const line = light ? (k === "co2" ? "#0f766e" : k === "rh" ? "#0e7490" : "#047857") : k === "co2" ? "#5eead4" : k === "rh" ? "#22d3ee" : "#10b981";

  return (
    <div className={cx.tile + " p-[22px]"}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] font-bold uppercase tracking-[0.14em] text-vt2">{label}</div>
        <div className="flex items-center gap-[7px] whitespace-nowrap rounded-full border px-[11px] py-[5px] text-xs font-bold" style={{ borderColor: t.border, background: t.tint, color: t.color }}>
          {t.statusLabel}
        </div>
      </div>
      <div className="mt-3.5 grid grid-cols-[150px_minmax(0,1fr)] items-center gap-[18px]">
        <Gauge value={e[0] ?? min} display={fmt(e[0], dp)} unit={unit} lo={e[2]} hi={e[3]} min={min} max={max} color={t.color} sp={e[1]} />
        <div className="tnum flex flex-col gap-2.5 text-sm">
          <div className="flex justify-between gap-2.5">
            <span className="text-vt3">Setpoint</span>
            <span className="font-bold">
              {e[1].toFixed(dp)} {unit}
            </span>
          </div>
          <div className="flex justify-between gap-2.5">
            <span className="text-vt3">Target</span>
            <span className="font-semibold text-vt2">
              {e[2].toFixed(dp)}–{e[3].toFixed(dp)}
            </span>
          </div>
          <div className="flex justify-between gap-2.5">
            <span className="text-vt3">Off setpoint</span>
            <span className="font-bold" style={{ color: t.color }}>
              {dev == null ? "—" : (dev >= 0 ? "+" : "−") + Math.abs(dev).toFixed(dp) + " " + unit}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-[18px] grid grid-cols-[44px_minmax(0,1fr)] gap-2">
        <div className="flex h-[110px] flex-col items-end justify-between font-mono text-[11px] text-vt4">
          <span>{yMax.toFixed(0)}</span>
          <span className="text-vt1">{e[1].toFixed(0)}</span>
          <span>{yMin.toFixed(0)}</span>
        </div>
        <div className="relative h-[110px] overflow-hidden rounded-xl border border-vbd bg-vtile">
          <svg viewBox="0 0 1000 110" preserveAspectRatio="none" className="absolute inset-0 block h-full w-full">
            <rect x="0" y={y(e[3]).toFixed(1)} width="1000" height={(y(e[2]) - y(e[3])).toFixed(1)} fill="rgba(16,185,129,0.10)" />
            <path
              d={`M0,${y(e[1]).toFixed(1)} L1000,${y(e[1]).toFixed(1)}`}
              fill="none"
              strokeOpacity="0.55"
              style={{ stroke: "var(--vt1)" }}
              strokeWidth="1.5"
              strokeDasharray="7 6"
              vectorEffect="non-scaling-stroke"
            />
            <path d={linePath(w.vals, 1000, H, yMin, yMax, w.xs)} fill="none" stroke={line} strokeWidth="2.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {!w.vals.length && <NoData>No SkySpark readings in the last 24h.</NoData>}
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-[44px_minmax(0,1fr)] gap-2">
        <span />
        <div className="tnum flex justify-between text-[11px] text-vt4">
          <span>-24h</span>
          <span>-12h</span>
          <span>now</span>
        </div>
      </div>
    </div>
  );
}

const lastTs = (series, k) => {
  for (let i = series.length - 1; i >= 0; i--) if (series[i][k] != null) return series[i].ts;
  return null;
};

export default function Room({ room, theme, isAdmin, saved, harvests, cycles, onBack, onOpenReport }) {
  const light = theme === "light";
  const T = tones(theme);
  const rs = roomStatus(room);
  const rt = tone(T, rs.s);
  const statusLine = statusText(rs, "All readings in range", "out of range");

  const seriesQ = useAsync(() => api.loadRoomSeries(room.id, 72, 15), [room.id, room.updatedAt]);
  const series = seriesQ.data || [];
  const now = Date.now();

  // 72h substrate chart
  const chart = useMemo(() => {
    const path = (k, min, max) => {
      const w = windowed(series, k, 72, now);
      return linePath(w.vals, 1000, 300, min, max, w.xs);
    };
    return { vwc: path("vwc", 0, 70), ec: path("ec", 0, 12), rzt: path("rzt", 55, 90) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series]);
  const hasRz = Boolean(chart.vwc || chart.ec || chart.rzt);
  const envSynced = lastTs(series, "temp") || room.updatedAt;
  const rzSynced = lastTs(series, "vwc") || room.updatedAt;

  // Latest leachate capture (newest saved row for this room) and latest harvest.
  const L = saved.find((x) => x.roomId === room.id) || null;
  const ls = (v, lo, hi) => (v == null ? "var(--vt1)" : T[status(v, lo, hi, (hi - lo) * 0.5)][0]);
  const leachItems = L
    ? [
        { label: "pH", value: L.ph || "—", sub: "target 5.8–6.3", color: ls(num(L.ph), 5.8, 6.3) },
        { label: "EC", value: L.ec || "—", sub: "dS/m", color: ls(num(L.ec), 4, 7.5) },
        { label: "Volume", value: L.vol || "—", sub: "mL per tray", color: light ? "#08211a" : "#f8fafc" },
        { label: "% of P1", value: L.p1 ? (String(L.p1).includes("%") ? L.p1 : L.p1 + "%") : "—", sub: "irrigation vol", color: light ? "#08211a" : "#f8fafc" },
      ]
    : [];
  const H = harvests.filter((h) => h.roomId === room.id).slice(-1)[0] || null;
  const g = gppOf(H);
  const harvestItems = H
    ? [
        { label: "Harvested", value: fmtDay(H.date).split(" ").slice(0, 2).join(" "), sub: fmtDay(H.date).split(" ")[2] },
        { label: "Plants", value: String(H.plants), sub: "in cycle" },
        { label: "Dry weight", value: fmt(H.dryG == null ? null : H.dryG / 1000, 1, " kg"), sub: "wet " + fmt(H.wetG == null ? null : H.wetG / 1000, 1, " kg") },
        { label: "Per plant", value: fmt(g, 0, " g"), sub: "dry" },
      ]
    : [];

  return (
    <main className="relative mx-auto max-w-[1720px] px-10 pb-[90px] pt-8">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 whitespace-nowrap rounded-full border border-vbd2 bg-vsoft px-[18px] py-2.5 text-sm font-semibold text-vt2 hover:border-[rgba(16,185,129,0.3)] hover:bg-vbd hover:text-vt1"
      >
        <Icon d={I.arrowLeft} size={15} stroke={2} />
        All rooms
      </button>

      <div className="mt-[22px] flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-[56px] font-bold leading-none tracking-[-0.035em]">{room.name}</div>
          <div className="mt-3 text-[17px] text-vt3">{[room.stage, room.cultivar].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <button type="button" onClick={onOpenReport} className={cx.btnPrimary + " flex items-center gap-2 py-[13px] text-[15px]"}>
              <Icon d={I.ai} />
              View AI Report
            </button>
          )}
          <div
            className="flex items-center gap-2.5 whitespace-nowrap rounded-full border px-5 py-3 text-base font-bold"
            style={{ borderColor: rt.border, background: rt.tint, color: rt.color }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: rt.color, boxShadow: `0 0 12px ${rt.color}` }} />
            {statusLine}
          </div>
        </div>
      </div>

      {seriesQ.error && (
        <div className="mt-6 rounded-[14px] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.10)] px-4 py-3 text-sm">Couldn't load readings: {seriesQ.error}</div>
      )}

      {/* 01 Environment */}
      <section className="mt-9 rounded-[28px] border border-vbd border-t-[3px] border-t-[#10b981] bg-vcard p-[30px] shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_25px_50px_-12px_rgba(16,185,129,0.10)] backdrop-blur-xl">
        <SectionHead n="01" title="Environment">
          <SourceBadge color={SRC.sky}>Source · SkySpark</SourceBadge>
          <span className="tnum whitespace-nowrap text-[13px] text-vt4">synced {relativeTime(envSynced).toLowerCase()}</span>
        </SectionHead>
        <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-5">
          {ENV_DEFS.map((def) => (
            <EnvCard key={def[0]} def={def} room={room} series={series} now={now} T={T} light={light} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-[18px] text-xs text-vt3">
          <span className="flex items-center gap-2">
            <span className="w-[18px] border-t-2 border-dashed border-vt3" />
            Setpoint
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-3.5 rounded-[3px] bg-[rgba(16,185,129,0.25)]" />
            Target band
          </span>
        </div>
      </section>

      {/* 02 Root Zone */}
      <section className="mt-6 rounded-[28px] border border-vbd border-t-[3px] border-t-[#22d3ee] bg-vcard p-[30px] shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_25px_50px_-12px_rgba(16,185,129,0.10)] backdrop-blur-xl">
        <SectionHead n="02" title="Root Zone">
          <SourceBadge color={SRC.aroya}>Source · Aroya</SourceBadge>
          <span className="whitespace-nowrap text-[13px] text-vt4">synced {relativeTime(rzSynced).toLowerCase()}</span>
        </SectionHead>
        <div className="mt-6 grid grid-cols-[minmax(0,340px)_minmax(0,1fr)] items-stretch gap-6">
          <div className="flex flex-col gap-3.5">
            {RZ_DEFS.map(([k, label, unit, dp, min, max]) => {
              const z = room.rz[k];
              const t = tone(T, status(z[0], z[1], z[2], z[3]));
              return (
                <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-4 rounded-[22px] border border-vbd bg-vtile px-[18px] py-4">
                  <Gauge
                    value={z[0] ?? min}
                    display={fmt(z[0], dp)}
                    unit={unit}
                    lo={z[1]}
                    hi={z[2]}
                    min={min}
                    max={max}
                    color={t.color}
                    size={110}
                    stroke={9}
                    valueClass="text-[26px]"
                  />
                  <div>
                    <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-vt2">{label}</div>
                    <div className="tnum mt-2 text-sm text-vt3">
                      Target {z[1]}–{z[2]} {unit}
                    </div>
                    <div className="mt-2.5 inline-flex rounded-full border px-[11px] py-[5px] text-xs font-bold" style={{ borderColor: t.border, background: t.tint, color: t.color }}>
                      {t.statusLabel}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex min-w-0 flex-col rounded-[22px] border border-vbd bg-vtile p-[22px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[15px] font-bold">Substrate · last 72 hours</div>
              <div className="flex flex-wrap gap-4 text-[13px]">
                {[
                  ["#22d3ee", "VWC %"],
                  ["#fbbf24", "EC dS/m"],
                  ["#fb7185", "Root zone °F"],
                ].map(([c, l]) => (
                  <span key={l} className="flex items-center gap-2 text-vt2">
                    <span className="h-[3px] w-4 rounded-sm" style={{ background: c }} />
                    {l}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 grid min-h-[300px] flex-1 grid-cols-[40px_minmax(0,1fr)_40px] gap-2.5">
              <div className="flex flex-col items-end justify-between font-mono text-[11px] text-vcyan">
                {["70", "47", "23", "0"].map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              <div className="relative min-h-[300px] overflow-hidden rounded-xl border border-vbd">
                <svg viewBox="0 0 1000 300" preserveAspectRatio="none" className="absolute inset-0 block h-full w-full">
                  <path d={chart.rzt} fill="none" strokeWidth="1.6" style={{ stroke: "var(--vcoral)" }} strokeOpacity="0.85" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  <path d={chart.ec} fill="none" strokeWidth="2.2" style={{ stroke: "var(--vamber)" }} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  <path d={chart.vwc} fill="none" strokeWidth="2.4" style={{ stroke: "var(--vcyan)" }} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>
                {!hasRz && <NoData>{seriesQ.loading ? "Loading readings…" : "No Aroya readings in the last 72h."}</NoData>}
              </div>
              <div className="flex flex-col justify-between font-mono text-[11px] text-vamber">
                {["12", "8", "4", "0"].map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-[40px_minmax(0,1fr)_40px] gap-2.5">
              <span />
              <div className="tnum flex justify-between text-[11px] text-vt4">
                {["-72h", "-48h", "-24h", "now"].map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              <span />
            </div>
          </div>
        </div>
      </section>

      {/* 03 Leachate & Harvest */}
      <section className="mt-6 rounded-[28px] border border-vbd border-t-[3px] border-t-[#fbbf24] bg-vcard p-[30px] shadow-[0_25px_50px_-12px_rgba(251,191,36,0.08)] backdrop-blur-xl">
        <SectionHead n="03" title="Leachate & Harvest">
          <SourceBadge color={SRC.sheets}>Source · Supabase</SourceBadge>
          <span className="whitespace-nowrap text-[13px] text-vt4">manual entry</span>
        </SectionHead>
        <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] gap-5">
          <div className="rounded-[22px] border border-[rgba(251,191,36,0.22)] bg-[linear-gradient(160deg,rgba(251,191,36,0.10),var(--vtile)_60%)] p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="text-[13px] font-bold uppercase tracking-[0.14em] text-vamber">Latest leachate capture</div>
              {L && (
                <div className="tnum text-sm text-vt2">
                  {L.date}
                  {L.strain ? " · " + L.strain : ""}
                </div>
              )}
            </div>
            {L ? (
              <>
                <div className="mt-[18px] grid grid-cols-4 gap-3">
                  {leachItems.map((l) => (
                    <div key={l.label} className="rounded-[18px] border border-vbd bg-vtile px-3.5 py-4">
                      <div className={cx.label}>{l.label}</div>
                      <div className="tnum mt-2 text-[32px] font-extrabold leading-none tracking-[-0.03em]" style={{ color: l.color }}>
                        {l.value}
                      </div>
                      <div className="mt-[5px] text-xs text-vt4">{l.sub}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-[18px] text-[15px] leading-relaxed text-vt2">{L.notes || "No capture notes."}</div>
              </>
            ) : (
              <div className="mt-[18px] text-[15px] leading-relaxed text-vt3">No leachate captures for this room yet. Add them on the Data Entry screen.</div>
            )}
          </div>
          <div className="rounded-[22px] border border-vbd bg-vtile p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="text-[13px] font-bold uppercase tracking-[0.14em] text-vt2">Latest harvest report</div>
              {H && <div className="font-mono text-sm text-vt2">{cycleName(cycles, H.cycleKey)}</div>}
            </div>
            {H ? (
              <>
                <div className="mt-[18px] grid grid-cols-4 gap-3">
                  {harvestItems.map((h) => (
                    <div key={h.label} className="rounded-[18px] border border-vbd bg-vtile px-3.5 py-4">
                      <div className={cx.label}>{h.label}</div>
                      <div className="tnum mt-2 text-[28px] font-extrabold leading-none tracking-[-0.03em]">{h.value}</div>
                      <div className="mt-[5px] text-xs text-vt4">{h.sub}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-[18px] text-[15px] leading-relaxed text-vt2">{H.notes || "No harvest notes."}</div>
              </>
            ) : (
              <div className="mt-[18px] text-[15px] leading-relaxed text-vt3">No harvest recorded for this room yet. Admins add harvests in the Supabase harvests table.</div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
