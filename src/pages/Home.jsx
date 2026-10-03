import { cx, I, Icon, StatusBadge } from "../components/ui";
import { fmt, roomStatus, status, statusText, tone, tones } from "../lib/logic";

export default function Home({ rooms, theme, onOpenRoom }) {
  const light = theme === "light";
  const T = tones(theme);
  const statuses = rooms.map((r) => roomStatus(r).s);
  const legend = [
    ["green", "In range"],
    ["amber", "Drifting"],
    ["red", "Out of range"],
  ].map(([k, label]) => ({ label, color: T[k][0], count: statuses.filter((s) => s === k).length }));

  return (
    <main className="relative mx-auto max-w-[1720px] px-10 pb-20 pt-11">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-vaccent">Facility</div>
          <div className={cx.h1}>
            {rooms.length === 1 ? "One Room" : "Every Room"}, <span className="grad-text">One View.</span>
          </div>
          <div className="mt-3 max-w-[640px] text-[17px] leading-normal text-vt3">
            Climate from SkySpark and root zone from Aroya, side by side for every room. Tap a room to open it.
          </div>
        </div>
        <div className="flex flex-wrap gap-[18px]">
          {legend.map((lg) => (
            <div key={lg.label} className="flex items-center gap-[9px] whitespace-nowrap text-sm text-vt2">
              <span className="h-3 w-3 rounded-full" style={{ background: lg.color, boxShadow: `0 0 10px ${lg.color}` }} />
              {lg.label}
              <span className="tnum font-bold text-vt1">{lg.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-9 grid grid-cols-[repeat(auto-fit,minmax(min(100%,500px),1fr))] gap-6">
        {rooms.map((x, i) => {
          const st = roomStatus(x);
          const t = tone(T, st.s);
          const glow = light
            ? "rgba(6,32,24,0.16)"
            : st.s === "green"
            ? "rgba(16,185,129,0.12)"
            : st.s === "amber"
            ? "rgba(251,191,36,0.14)"
            : "rgba(239,68,68,0.16)";
          const label = statusText(st);
          const metrics = [
            ["Temp", x.env.temp, "°F", 1, status(x.env.temp[0], x.env.temp[2], x.env.temp[3], x.env.temp[4])],
            ["RH", x.env.rh, "%", 0, status(x.env.rh[0], x.env.rh[2], x.env.rh[3], x.env.rh[4])],
            ["CO₂", x.env.co2, "ppm", 0, status(x.env.co2[0], x.env.co2[2], x.env.co2[3], x.env.co2[4])],
            ["VWC", x.rz.vwc, "%", 1, status(x.rz.vwc[0], x.rz.vwc[1], x.rz.vwc[2], x.rz.vwc[3])],
            ["EC", x.rz.ec, "dS/m", 2, status(x.rz.ec[0], x.rz.ec[1], x.rz.ec[2], x.rz.ec[3])],
          ];
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => onOpenRoom(i)}
              className="flex flex-col gap-[22px] rounded-[28px] border bg-vcard px-[30px] py-7 text-left text-inherit backdrop-blur-xl transition-all duration-300 hover:-translate-y-[3px] hover:!border-[rgba(16,185,129,0.35)] active:scale-[0.99]"
              style={{ borderColor: t.border, boxShadow: `0 0 0 1px rgba(16,185,129,0.06),0 25px 50px -12px ${glow}` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[30px] font-bold leading-[1.1] tracking-[-0.025em]">{x.name}</div>
                  <div className="mt-1.5 text-sm text-vt3">{x.stage}</div>
                </div>
                <StatusBadge t={t} label={label} />
              </div>
              <div className="grid grid-cols-5 gap-2.5">
                {metrics.map(([label, a, unit, dp, s]) => (
                  <div key={label} className="rounded-[18px] border border-vbd bg-vtile px-3 py-3.5" style={{ borderTop: `3px solid ${T[s][0]}` }}>
                    <div className={cx.label}>{label}</div>
                    <div className="tnum mt-2 text-[30px] font-extrabold leading-none tracking-[-0.03em]">{fmt(a[0], dp)}</div>
                    <div className="mt-[5px] text-xs font-semibold" style={{ color: T[s][0] }}>
                      {unit}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-vt4">
                <span className="flex flex-wrap gap-3.5">
                  <span>
                    <span className="font-semibold text-vaccent">SkySpark</span> Temp · RH · CO₂
                  </span>
                  <span>
                    <span className="font-semibold text-vcyan">Aroya</span> VWC · EC
                  </span>
                </span>
                <span className="flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-vaccent">
                  Open room
                  <Icon d={I.arrowRight} size={15} stroke={2} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
}
