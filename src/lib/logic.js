import { useEffect, useState } from "react";
import { PRICE_PER_GRAM } from "./config";

// Status tones: [color, border, tint, label]
const TONES_DARK = {
  green: ["#10b981", "rgba(16,185,129,0.35)", "rgba(16,185,129,0.12)", "In range"],
  amber: ["#fbbf24", "rgba(251,191,36,0.4)", "rgba(251,191,36,0.12)", "Drifting"],
  red: ["#ef4444", "rgba(239,68,68,0.45)", "rgba(239,68,68,0.14)", "Out of range"],
  none: ["#64748b", "rgba(100,116,139,0.35)", "rgba(100,116,139,0.10)", "No data"],
};
const TONES_LIGHT = {
  green: ["#047857", "rgba(4,120,87,0.35)", "rgba(4,120,87,0.10)", "In range"],
  amber: ["#b45309", "rgba(180,83,9,0.35)", "rgba(180,83,9,0.10)", "Drifting"],
  red: ["#b91c1c", "rgba(185,28,28,0.38)", "rgba(185,28,28,0.10)", "Out of range"],
  none: ["#59685f", "rgba(89,104,95,0.35)", "rgba(89,104,95,0.10)", "No data"],
};

export const tones = (theme) => (theme === "light" ? TONES_LIGHT : TONES_DARK);
export const tone = (T, s) => ({ color: T[s][0], border: T[s][1], tint: T[s][2], statusLabel: T[s][3] });

export const ENV_DEFS = [
  ["temp", "Temperature", "°F", 1, 70, 90],
  ["rh", "Humidity", "% RH", 0, 30, 100],
  ["co2", "CO₂", "ppm", 0, 400, 1800],
];
export const RZ_DEFS = [
  ["vwc", "VWC", "%", 1, 0, 70],
  ["ec", "EC", "dS/m", 2, 0, 12],
  ["rzt", "Root zone temp", "°F", 1, 60, 85],
];

export function status(v, lo, hi, m) {
  if (v == null) return "none";
  if (v >= lo && v <= hi) return "green";
  if (v >= lo - m && v <= hi + m) return "amber";
  return "red";
}

export const worst = (list) => (list.includes("red") ? "red" : list.includes("amber") ? "amber" : "green");

export function roomStatus(r) {
  const s = ENV_DEFS.map(([k]) => {
    const e = r.env[k];
    return status(e[0], e[2], e[3], e[4]);
  }).concat(
    RZ_DEFS.slice(0, 2).map(([k]) => {
      const z = r.rz[k];
      return status(z[0], z[1], z[2], z[3]);
    })
  );
  const seen = s.filter((x) => x !== "none");
  const red = seen.filter((x) => x === "red").length;
  const amber = seen.filter((x) => x === "amber").length;
  return { s: worst(seen), n: red + amber, red, amber };
}

/** "All in range", "1 out", "2 drifting" or "1 out · 1 drifting". `outWord` lets the room page say "out of range". */
export function statusText(st, allGood = "All in range", outWord = "out") {
  if (!st.n) return allGood;
  return [st.red && st.red + " " + outWord, st.amber && st.amber + " drifting"].filter(Boolean).join(" · ");
}

export const arc = (v, min, max) => Math.max(0, Math.min(1, (v - min) / (max - min)));

// Gauge arc geometry: 270° arc on a r=42 circle.
const C = 263.9;
const A = 197.9;
export function gaugeDash(v, lo, hi, min, max) {
  const f = arc(v, min, max);
  const a = arc(lo, min, max);
  const b = arc(hi, min, max);
  return {
    dash: Math.max(1, f * A).toFixed(1) + " " + C,
    band: ((b - a) * A).toFixed(1) + " " + C,
    bandOff: (-a * A).toFixed(1),
  };
}
export const GAUGE_TRACK = `${A} ${C}`;

/** SVG path through `vals` (nulls break the line). `xs` are optional 0–1 x positions. */
export function linePath(vals, W, H, min, max, xs) {
  const pad = H * 0.05;
  let pen = false;
  let out = "";
  vals.forEach((v, i) => {
    if (v == null || isNaN(v)) {
      pen = false;
      return;
    }
    const x = (xs ? xs[i] : i / Math.max(1, vals.length - 1)) * W;
    const y = pad + (1 - (Math.max(min, Math.min(max, v)) - min) / (max - min)) * (H - 2 * pad);
    out += (pen ? " L" : " M") + x.toFixed(1) + "," + y.toFixed(1);
    pen = true;
  });
  return out.trim();
}

export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const pad2 = (x) => String(x).padStart(2, "0");
export const fdate = (dt) => pad2(dt.getDate()) + " " + MON[dt.getMonth()];
export const money = (v) => "$" + (v >= 1000 ? (v / 1000).toFixed(1) + "K" : v.toFixed(0));
export const fmt = (v, dp, suffix = "") => (v == null || isNaN(v) ? "—" : v.toFixed(dp) + suffix);
export const initials = (n) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

export function stampLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const hm = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  return d.toDateString() === now.toDateString() ? "Today " + hm : fdate(d) + " " + hm;
}

export function relativeTime(iso) {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "Now";
  if (mins < 60) return mins + "m ago";
  if (mins < 60 * 24) return Math.round(mins / 60) + "h ago";
  if (mins < 60 * 48) return "Yesterday";
  return Math.round(mins / 1440) + "d ago";
}

/* -------------------------------------------------------------- dates */
export const isoDay = (dt) => dt.getFullYear() + "-" + pad2(dt.getMonth() + 1) + "-" + pad2(dt.getDate());
export const parseIsoDay = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const fmtDay = (s) => {
  const d = parseIsoDay(s);
  return fdate(d) + " " + d.getFullYear();
};

/** Leachate capture dates are typed as 9/29/26, 9/29 (this year) or 2026-09-29. Returns YYYY-MM-DD, or null if it isn't a real date. */
export function captureDay(s) {
  const t = String(s || "").trim();
  let y, mo, d;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const us = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
  if (iso) [, y, mo, d] = iso.map(Number);
  else if (us) {
    mo = Number(us[1]);
    d = Number(us[2]);
    y = us[3] == null ? new Date().getFullYear() : us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3]);
  } else return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null; // e.g. 2/30
  return y + "-" + pad2(mo) + "-" + pad2(d);
}

/** "6.0 +" -> 6, "43%" -> 43, "" -> null */
export const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(/[+%]/g, ""));
  return isNaN(n) ? null : n;
};
export const mean = (list) => {
  const xs = list.filter((v) => v != null && !isNaN(v));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
};
export const avgOf = (rows, k) => mean(rows.map((r) => r[k]));

/* ------------------------------------------------------------- cycles */
/** Rows from the `cycles` table -> cycle objects used across the app. */
export function buildCycles(rows) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const span = (a, b) => Math.max(1, Math.round((b - a) / 86400000) + 1);
  return rows.map((c) => {
    const start = parseIsoDay(c.startDate);
    // An open cycle is scheduled until its start date, then running. A running cycle counts data
    // up to today; its end_date is only the estimated end.
    const scheduled = c.open && start > today;
    const current = c.open && !scheduled;
    const estEnd = c.open && c.endDate ? parseIsoDay(c.endDate) : null;
    const end = current ? today : scheduled ? estEnd || start : parseIsoDay(c.endDate || c.startDate);
    const fd = (d) => fdate(d) + " " + d.getFullYear();
    return {
      ...c,
      start,
      end,
      estEnd,
      current,
      scheduled,
      days: span(start, end),
      estDays: estEnd ? span(start, estEnd) : null,
      name: `${c.year} · ${c.label}`,
      range: scheduled
        ? "starts " + fd(start) + (estEnd ? " · est. end " + fd(estEnd) : "")
        : fd(start) + " – " + (current ? "today" + (estEnd ? " · est. end " + fd(estEnd) : "") : fd(end)),
    };
  });
}

/** Index of the cycle to show first among `idx` (default: all): the latest running one, else the latest started, else the last. */
export function pickCycle(cycles, idx = cycles.map((_, i) => i)) {
  const last = (f) => idx.filter((i) => f(cycles[i])).at(-1);
  return last((c) => c.current) ?? last((c) => !c.scheduled) ?? idx.at(-1) ?? -1;
}

/** "In progress" / "Scheduled" / "Closed" with its colour, for cycle badges. */
export const cycleState = (c, T) =>
  c.current ? ["In progress", T.green] : c.scheduled ? ["Scheduled", T.amber] : ["Closed", null];

/** "Room 2, Room 3" for the rooms a cycle covers. */
export const cycleRooms = (c, rooms) =>
  rooms
    .filter((r) => c.ids[r.id])
    .map((r) => r.name)
    .join(", ");

export const cycleName = (cycles, key) => (cycles.find((c) => c.key === key) || {}).name || key;

/* ------------------------------------------------------- daily record */
/** One row per day of the cycle: readings averages + that day's leachate captures. */
export function dailyRecord(cy, room, stats, leach) {
  const byDay = Object.fromEntries(stats.filter((s) => s.room_id === room.id).map((s) => [String(s.day).slice(0, 10), s]));
  const caps = {};
  leach
    .filter((x) => x.roomId === room.id && x.cycleKey === cy.key)
    .forEach((x) => {
      const d = captureDay(x.date);
      if (d) (caps[d] = caps[d] || []).push(x);
    });
  const out = [];
  for (let i = 0; i < cy.days; i++) {
    const dt = new Date(cy.start);
    dt.setDate(dt.getDate() + i);
    const k = isoDay(dt);
    const s = byDay[k] || {};
    const c = caps[k] || [];
    const temp = s.temp ?? null;
    out.push({
      d: i + 1,
      day: k,
      date: fdate(dt) + " " + dt.getFullYear(),
      temp,
      rh: s.rh ?? null,
      co2: s.co2 ?? null,
      vwc: s.vwc ?? null,
      ec: s.ec ?? null,
      rzt: s.rzt ?? null,
      caps: c.length,
      lph: mean(c.map((x) => num(x.ph))),
      lec: mean(c.map((x) => num(x.ec))),
      note: c.map((x) => x.notes).filter(Boolean).join(" · "),
      spike: temp != null && temp > room.env.temp[3],
    });
  }
  return out;
}

/* ------------------------------------------------------------ harvests */
export const harvestOf = (harvests, roomId, cycleKey) => harvests.find((h) => h.roomId === roomId && h.cycleKey === cycleKey) || null;
export const gppOf = (h) => (h && h.dryG != null && h.plants ? h.dryG / h.plants : null);
export const kgOf = (h) => (h && h.dryG != null ? h.dryG / 1000 : null);

/** KPI block + stored Claude narrative for one room in one cycle. `days` = dailyRecord rows. */
export function reportFor(room, cy, prevCy, harvests, days, ai) {
  const h = harvestOf(harvests, room.id, cy.key);
  const g = gppOf(h);
  const kg = kgOf(h);
  const pkg = prevCy ? kgOf(harvestOf(harvests, room.id, prevCy.key)) : null;
  const rev = !room.veg && kg != null ? kg * 1000 * PRICE_PER_GRAM : null;
  const dv = kg != null && pkg ? ((kg - pkg) / pkg) * 100 : null;
  const avgT = cy.current ? room.env.temp[0] : avgOf(days, "temp");
  const noH = cy.current ? "not harvested yet" : "no harvest recorded";
  const price = "$" + PRICE_PER_GRAM.toFixed(2) + "/g";
  const kpis = [
    ["Revenue", rev == null ? "—" : money(rev), room.veg ? "veg · no harvest" : rev == null ? noH : "at " + price],
    ["Dry yield", fmt(kg, 1, " kg"), kg == null ? noH : dv == null ? h.plants + " plants" : (dv >= 0 ? "+" : "") + dv.toFixed(1) + "% vs previous cycle"],
    ["Per plant", fmt(g, 0, " g"), "dry weight"],
    ["Harvest rate", fmt(g == null ? null : g / cy.days, 2, " g"), "per plant per day"],
    [cy.current ? "Temperature" : "Avg temperature", fmt(avgT, 1, " °F"), "setpoint " + room.env.temp[1]],
    ["Days in cycle", String(cy.days), cy.current ? "so far" : "full cycle"],
  ];
  return { kpis, headline: ai?.headline || "", summary: ai?.text || "", recs: ai?.recs || [], harvest: h, kg, rev, avgT };
}

export const priorityTone = (T, pr) => ({
  pc: pr === "High" ? T.red[0] : pr === "Medium" ? T.amber[0] : T.green[0],
  pt: pr === "High" ? T.red[2] : pr === "Medium" ? T.amber[2] : T.green[2],
});

/* ---------------------------------------------------------------- hooks */
/** Runs an async loader whenever `deps` change. Returns { loading, data, error }. */
export function useAsync(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    fn().then(
      (data) => live && setState({ loading: false, data, error: "" }),
      (e) => live && setState({ loading: false, data: null, error: e.message })
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
