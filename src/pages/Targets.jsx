import { useState } from "react";
import CyclePicker from "../components/CyclePicker";
import { cx } from "../components/ui";
import { DEFAULT_TARGETS } from "../lib/config";
import { ENV_DEFS, RZ_DEFS } from "../lib/logic";

// [key, label, unit] for the six readings. Setpoints only apply to the climate readings.
const METRICS = [...ENV_DEFS, ...RZ_DEFS].map(([k, label, unit]) => [k, label, unit]);
const HAS_SETPOINT = ["temp", "rh", "co2"];
const FIELDS = [
  ["setpoint", "Setpoint", 0],
  ["low", "Low", 1],
  ["high", "High", 2],
  ["drift", "Drift ±", 3],
]; // [field, label, index in DEFAULT_TARGETS]
const fieldsOf = (k) => FIELDS.filter(([f]) => f !== "setpoint" || HAS_SETPOINT.includes(k));

const toStr = (v) => (v == null ? "" : String(v));
const toNum = (v) => (String(v).trim() === "" ? null : Number(v));

/** One room's saved targets in one cycle as { metric: { setpoint, low, high, drift } } strings ("" = not set). */
function savedOf(cycleId, targets) {
  return Object.fromEntries(
    METRICS.map(([k]) => {
      const t = targets.find((x) => x.cycleId === cycleId && x.metric === k) || {};
      return [k, { setpoint: toStr(t.setpoint), low: toStr(t.low), high: toStr(t.high), drift: toStr(t.drift) }];
    })
  );
}

/** Error message for one room's form, or "". Blank fields are fine: they use the default. */
function check(form) {
  for (const [k, label] of METRICS) {
    const m = form[k];
    for (const [f, fl] of fieldsOf(k)) if (m[f] !== "" && Number.isNaN(Number(m[f]))) return `${label}: ${fl} must be a number.`;
    if (m.low !== "" && m.high !== "" && Number(m.low) > Number(m.high)) return `${label}: Low is above High.`;
    if (m.drift !== "" && Number(m.drift) < 0) return `${label}: Drift can't be negative.`;
  }
  return "";
}

const rowsOf = (cycleId, form) =>
  METRICS.map(([k]) => {
    const m = form[k];
    return { cycleId, metric: k, setpoint: HAS_SETPOINT.includes(k) ? toNum(m.setpoint) : null, low: toNum(m.low), high: toNum(m.high), drift: toNum(m.drift) };
  });

// `cy` is the picked cycle; cy.ids maps room id -> that room's harvest_cycles row.
function RoomTargets({ room, rooms, cy, targets, light, onSave }) {
  const [form, setForm] = useState(null); // null = viewing; object = editing
  const [msg, setMsg] = useState({ text: "", err: false });
  const [busy, setBusy] = useState(false);
  const cycleId = cy.ids[room.id];
  const saved = savedOf(cycleId, targets);
  const editing = form != null;

  const save = async () => {
    const err = check(form);
    if (err) return setMsg({ text: err, err: true });
    setBusy(true);
    try {
      await onSave(rowsOf(cycleId, form));
      setForm(null);
      setMsg({ text: `Saved ${room.name}'s targets.`, err: false });
    } catch (e) {
      setMsg({ text: "Couldn't save: " + e.message, err: true });
    } finally {
      setBusy(false);
    }
  };

  const copyToAll = async () => {
    const others = rooms.filter((r) => r.id !== room.id && cy.ids[r.id]);
    if (!others.length) return setMsg({ text: `No other room is in ${cy.name}.`, err: true });
    if (!window.confirm(`Replace the ${cy.name} targets of ${others.map((r) => r.name).join(", ")} with ${room.name}'s?`)) return;
    setBusy(true);
    try {
      await onSave(others.flatMap((r) => rowsOf(cy.ids[r.id], saved)));
      setMsg({ text: `Copied ${room.name}'s targets to ${others.length} other ${others.length === 1 ? "room" : "rooms"}.`, err: false });
    } catch (e) {
      setMsg({ text: "Couldn't copy: " + e.message, err: true });
    } finally {
      setBusy(false);
    }
  };

  const small = cx.btnGhost + " !px-3.5 !py-2 !text-xs";
  return (
    <div className={cx.card + " p-6"} style={editing ? { borderColor: "rgba(16,185,129,0.45)" } : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl font-bold tracking-[-0.015em]">{room.name}</span>
          {editing && <span className="rounded-full bg-[rgba(16,185,129,0.12)] px-2.5 py-1 text-[11px] font-bold text-vaccent">Editing</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {editing ? (
            <>
              <button type="button" disabled={busy} onClick={save} className={cx.btnPrimary + " !px-4 !py-2 !text-xs"}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm(null);
                  setMsg({ text: "", err: false });
                }}
                className={small}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setForm(saved);
                  setMsg({ text: "", err: false });
                }}
                className={small}
              >
                Edit
              </button>
              {rooms.length > 1 && (
                <button type="button" disabled={busy} onClick={copyToAll} className={small}>
                  Copy to all rooms
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {msg.text && (
        <div className="mt-3 text-sm font-semibold" style={{ color: msg.err ? "#ef4444" : "var(--vaccent)" }}>
          {msg.text}
        </div>
      )}

      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-3">
        {METRICS.map(([k, label, unit]) => (
          <div key={k} className="rounded-[18px] border border-vbd bg-vtile p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className={cx.label}>{label}</span>
              <span className="text-xs text-vt4">{unit}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {fieldsOf(k).map(([f, fl, di]) => {
                const def = DEFAULT_TARGETS[k][di];
                const val = saved[k][f];
                return (
                  <div key={f} className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-vt3">{fl}</span>
                    {editing ? (
                      <input
                        inputMode="decimal"
                        value={form[k][f]}
                        placeholder={def == null ? "" : String(def)}
                        onChange={(e) => setForm({ ...form, [k]: { ...form[k], [f]: e.target.value } })}
                        className={cx.input + " tnum !px-3 !py-2 !text-sm"}
                        style={{ colorScheme: light ? "light" : "dark" }}
                      />
                    ) : (
                      <div className="tnum flex h-[38px] items-baseline gap-1.5 px-1 pt-2 text-[15px]">
                        {val !== "" ? (
                          <span className="font-bold text-vt1">{val}</span>
                        ) : (
                          <>
                            <span className="text-vt4">{def ?? "—"}</span>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-vt4">default</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Targets({ rooms, cycles, targets, theme, onSave }) {
  const light = theme === "light";
  // Start on the running cycle (or the latest one).
  const open = cycles.findIndex((c) => c.current);
  const start = open >= 0 ? open : cycles.length - 1;
  const [cycle, setCycle] = useState(start);
  const [year, setYear] = useState(cycles[start]?.year);
  const cy = cycles[Math.min(cycle, cycles.length - 1)];

  if (!cy)
    return (
      <div className={cx.card + " mt-8 px-8 py-12 text-center text-[15px] text-vt3"}>
        Targets belong to a harvest cycle. Create one on the Harvest cycles tab first.
      </div>
    );

  return (
    <div className="mt-8 flex flex-col gap-5">
      <CyclePicker theme={theme} cycles={cycles} year={year} cycle={cycle} onYear={setYear} onCycle={setCycle} />
      <div className={cx.card + " px-6 py-5 text-sm leading-relaxed text-vt3"}>
        <span className="font-semibold text-vt1">{cy.name}</span>
        {cy.current ? " is running: Live Rooms and the room pages use these targets now. " : " is closed: its targets are kept for the record. "}
        <span className="font-semibold text-vt1">Low – High</span> is the in-range band (green). Within <span className="font-semibold text-vt1">Drift ±</span> outside it a
        reading is drifting (orange); beyond that it's out of range (red). Values marked <span className="font-semibold">default</span> haven't been set for that room in
        this cycle. Press <span className="font-semibold text-vt1">Edit</span> on a room to change its targets. A new cycle starts with each room's targets from its previous
        cycle.
      </div>
      {rooms.map((r) =>
        cy.ids[r.id] ? (
          <RoomTargets key={cy.key + r.id} room={r} rooms={rooms} cy={cy} targets={targets} light={light} onSave={onSave} />
        ) : (
          <div key={cy.key + r.id} className={cx.card + " flex items-center justify-between gap-3 p-6"}>
            <span className="text-xl font-bold tracking-[-0.015em]">{r.name}</span>
            <span className="text-sm text-vt4">Not part of {cy.name}.</span>
          </div>
        )
      )}
    </div>
  );
}
