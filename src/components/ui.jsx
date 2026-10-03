import { GAUGE_TRACK, gaugeDash } from "../lib/logic";

export const I = {
  live: "M22 12h-4l-3 9L9 3l-3 9H2",
  ai: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z M19 3v4 M17 5h4",
  cal: "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  sheet: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 9h18 M3 15h18 M9 3v18",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8",
  check: "M20 6 9 17l-5-5",
  x: "M18 6 6 18 M6 6l12 12",
  moon: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4",
  chevDown: "m6 9 6 6 6-6",
  chevLeft: "m15 18-6-6 6-6",
  chevRight: "m9 18 6-6-6-6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 18l-6-6 6-6",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  clipboard: "M9 2h6v4H9z M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
  plus: "M12 5v14 M5 12h14",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  leaf1: "M12 21c0-6 0-9 0-12",
  leaf2: "M12 12c4.5 0 7-2.6 7-7-4.5 0-7 2.6-7 7z",
  leaf3: "M12 16c-4 0-6.2-2.3-6.2-6.2 4 0 6.2 2.3 6.2 6.2z",
};

export function Icon({ d, size = 16, stroke = 1.5, color = "currentColor", className = "", style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d={d} />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="relative flex h-10 w-10 items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-[rgba(16,185,129,0.35)] blur-md" />
      <div className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[rgba(16,185,129,0.4)] bg-vb shadow-[0_0_18px_-5px_#10b981]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d={I.leaf1} />
          <path d={I.leaf2} />
          <path d={I.leaf3} />
        </svg>
      </div>
    </div>
  );
}

/* Shared Tailwind class strings */
export const cx = {
  card: "rounded-[28px] border border-vbd bg-vcard shadow-v backdrop-blur-xl",
  tile: "rounded-[22px] border border-vbd bg-vtile",
  label: "text-[10px] font-bold uppercase tracking-[0.14em] text-vt3",
  eyebrow: "text-[11px] font-bold uppercase tracking-[0.18em] text-vaccent",
  h1: "mt-2.5 text-[44px] font-bold leading-[1.05] tracking-[-0.03em]",
  sub: "mt-3 max-w-[700px] text-[17px] leading-[1.55] text-vt3",
  main: "relative mx-auto max-w-[1720px] px-10 pb-[90px] pt-11",
  btnPrimary:
    "whitespace-nowrap rounded-full border-0 bg-gradient-to-br from-[#10b981] to-[#22d3ee] px-[22px] py-3 text-sm font-bold text-[#04140f] shadow-[0_0_20px_-5px_rgba(16,185,129,0.6)] transition-all duration-[250ms] hover:scale-[1.03] hover:shadow-[0_0_32px_-5px_rgba(16,185,129,0.7)] active:scale-[0.97]",
  btnGhost:
    "flex items-center gap-2 whitespace-nowrap rounded-full border border-vbd2 bg-vsoft px-[18px] py-[11px] text-sm font-semibold text-vt1 transition-all duration-200 hover:border-[rgba(16,185,129,0.35)] hover:bg-vsoft2 active:scale-[0.97]",
  input:
    "w-full rounded-[14px] border border-vbd2 bg-vtile px-3.5 py-[13px] text-[15px] text-vt1 outline-none transition-all duration-200 focus:border-[rgba(16,185,129,0.5)] focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)]",
};

/** Style for selectable pills (years, rooms, cycles…) */
export const pillStyle = (active, light) =>
  active
    ? { background: light ? "rgba(4,120,87,0.10)" : "rgba(16,185,129,0.14)", color: "var(--vaccent)", borderColor: "rgba(16,185,129,0.45)" }
    : { background: "var(--vsoft)", color: "var(--vt2)", borderColor: "var(--vbd)" };

/** Style for segmented tabs (nav, metric switch) */
export const tabStyle = (active, light) =>
  active
    ? { background: light ? "rgba(4,120,87,0.10)" : "rgba(16,185,129,0.14)", color: "var(--vaccent)", borderColor: "rgba(16,185,129,0.4)" }
    : { background: "transparent", color: "var(--vt3)", borderColor: "transparent" };

export function Pill({ active, light, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={pillStyle(active, light)}
      className={"whitespace-nowrap rounded-full border px-[18px] py-2.5 text-sm font-semibold transition-all duration-200 hover:!text-vt1 " + className}
    >
      {children}
    </button>
  );
}

export function StatusBadge({ t, label, small = false }) {
  return (
    <div
      className={
        "flex items-center gap-2 whitespace-nowrap rounded-full border font-bold " +
        (small ? "px-[13px] py-[7px] text-xs" : "px-3.5 py-2 text-[13px]")
      }
      style={{ borderColor: t.border, background: t.tint, color: t.color }}
    >
      <span className={"rounded-full " + (small ? "h-[7px] w-[7px]" : "h-2 w-2")} style={{ background: t.color }} />
      {label ?? t.statusLabel}
    </div>
  );
}

/** 270° arc gauge with a target band. */
export function Gauge({ value, display, unit, lo, hi, min, max, color, size = 150, stroke = 8, sp, valueClass = "text-[38px]" }) {
  const g = gaugeDash(value, lo, hi, min, max);
  let spDot = null;
  if (sp != null) {
    const spf = Math.max(0, Math.min(1, (sp - min) / (max - min)));
    const ang = ((135 + spf * 270) * Math.PI) / 180;
    spDot = { x: (50 + 42 * Math.cos(ang)).toFixed(2), y: (50 + 42 * Math.sin(ang)).toFixed(2) };
  }
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="block h-full w-full">
        <circle cx="50" cy="50" r="42" fill="none" strokeWidth={stroke} style={{ stroke: "var(--vsoft2)" }} strokeDasharray={GAUGE_TRACK} transform="rotate(135 50 50)" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(16,185,129,0.3)" strokeWidth={stroke} strokeDasharray={g.band} strokeDashoffset={g.bandOff} transform="rotate(135 50 50)" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={g.dash} transform="rotate(135 50 50)" />
        {spDot && <circle cx={spDot.x} cy={spDot.y} r="4" strokeWidth="1.5" style={{ fill: "var(--vt1)", stroke: "var(--vb)" }} />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1.5">
        <div className={"tnum font-extrabold leading-none tracking-[-0.035em] " + valueClass}>{display}</div>
        <div className="mt-1 text-[13px] font-semibold text-vt3">{unit}</div>
      </div>
    </div>
  );
}

export function AdminBadge({ children = "Admin only" }) {
  return (
    <span className="whitespace-nowrap rounded-full border border-vbd2 px-[9px] py-[3px] text-[10px] font-bold uppercase tracking-[0.12em] text-vt3">
      {children}
    </span>
  );
}

export function SourceBadge({ color, children }) {
  return (
    <span
      className="whitespace-nowrap rounded-full border px-3.5 py-[7px] text-[13px] font-bold"
      style={{ borderColor: color.border, background: color.bg, color: color.text }}
    >
      {children}
    </span>
  );
}

/** Shown when a table has no rows yet — tells the admin where the data comes from. */
export function EmptyState({ title, children, className = "" }) {
  return (
    <div className={cx.card + " px-8 py-12 text-center " + className}>
      <div className="text-xl font-bold tracking-[-0.015em]">{title}</div>
      <div className="mx-auto mt-2.5 max-w-[620px] text-[15px] leading-relaxed text-vt3">{children}</div>
    </div>
  );
}

/** Small overlay for a chart with no data in its window. */
export function NoData({ children = "No readings in this window yet." }) {
  return <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-[13px] text-vt4">{children}</div>;
}

export const SRC = {
  sky: { border: "rgba(16,185,129,0.35)", bg: "rgba(16,185,129,0.12)", text: "var(--vaccent)" },
  aroya: { border: "rgba(34,211,238,0.35)", bg: "rgba(34,211,238,0.12)", text: "var(--vcyan)" },
  sheets: { border: "rgba(251,191,36,0.35)", bg: "rgba(251,191,36,0.12)", text: "var(--vamber)" },
};
