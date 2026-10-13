import { useEffect, useState } from "react";
import { AdminBadge, cx, Pill, tabStyle } from "../components/ui";
import Targets from "./Targets";
import { cycleState, isoDay, tones } from "../lib/logic";

const FAR = "9999-12-31";
// Cycle names come from a fixed list so they stay consistent: Cycle 1 … Cycle 30 each year.
// Several can run at once in different rooms (e.g. 26.10 in Room 4 and 26.11 in Room 5).
const CYCLE_NAMES = Array.from({ length: 30 }, (_, i) => "Cycle " + (i + 1));
const usedNames = (cycles, year, exceptKey) => cycles.filter((c) => c.year === Number(year) && c.key !== exceptKey).map((c) => c.label);
const firstFree = (cycles, year) => CYCLE_NAMES.find((n) => !usedNames(cycles, year).includes(n)) || "";
const today = () => isoDay(new Date());

// A room's date span in a cycle. Running cycles reach at least today (and their estimated end).
const spanOf = (row) => {
  if (row.status !== "current") return [row.startDate, row.endDate || row.startDate];
  const est = row.endDate || FAR;
  return [row.startDate, est > today() ? est : today()];
};
const overlaps = ([a1, b1], [a2, b2]) => a1 <= b2 && a2 <= b1;

/** Returns an error message, or "" when the cycle can be saved. `self` is the cycle being edited. */
function check({ name, year, startDate, endDate, roomIds, closing }, cycles, rooms, self) {
  if (!self && usedNames(cycles, year).length >= CYCLE_NAMES.length) return `${year} already has ${CYCLE_NAMES.length} cycles, the most allowed.`;
  if (!CYCLE_NAMES.includes(name)) return "Pick a cycle name from the list.";
  if (!/^\d{4}$/.test(String(year))) return "Year should look like 2026.";
  if (!startDate) return "Pick a start date.";
  if (!endDate) return closing ? "Pick the actual end date." : "Pick an estimated end date.";
  if (endDate < startDate) return "The end date is before the start date.";
  if (!roomIds.length) return "Pick at least one room.";
  const others = cycles.filter((c) => c.key !== self?.key);
  if (others.some((c) => c.year === Number(year) && c.label.trim().toLowerCase() === name.trim().toLowerCase()))
    return `${year} already has a cycle called "${name.trim()}".`;
  // Closed cycles end on their end date; open ones (running or scheduled) on the estimate, or today if that has passed.
  const fixedEnd = closing || (self && !self.open);
  const mine = fixedEnd ? [startDate, endDate] : [startDate, endDate > today() ? endDate : today()];
  // Any number of cycles can be open at once; a room just can't be in two at the same time.
  for (const roomId of roomIds) {
    const roomName = (rooms.find((r) => r.id === roomId) || {}).name || "A room";
    for (const c of others) {
      const row = c.rows.find((r) => r.roomId === roomId);
      if (row && overlaps(mine, spanOf(row))) return `${roomName}: these dates overlap ${c.name}.`;
    }
  }
  return "";
}

// Native date picker; clicking anywhere in the field opens the calendar.
function DateInput({ value, onChange, light }) {
  return (
    <input
      type="date"
      className={cx.input + " cursor-pointer"}
      style={{ colorScheme: light ? "light" : "dark" }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => {
        try {
          e.currentTarget.showPicker();
        } catch {
          /* older browsers: the calendar icon still works */
        }
      }}
    />
  );
}

function Select({ value, onChange, light, children }) {
  return (
    <select className={cx.input + " cursor-pointer"} style={{ colorScheme: light ? "light" : "dark" }} value={value} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  );
}

// Cycle 1-5; names already used that year are disabled.
const nameOptions = (cycles, year, exceptKey) => {
  const used = usedNames(cycles, year, exceptKey);
  return CYCLE_NAMES.map((n) => (
    <option key={n} value={n} disabled={used.includes(n)}>
      {n + (used.includes(n) ? " · used" : "")}
    </option>
  ));
};

const Field = ({ label, children }) => (
  <label className="flex flex-col gap-2">
    <span className={cx.label}>{label}</span>
    {children}
  </label>
);

export default function Settings({ tab, onTab, rooms, cycles, targets, theme, onCreate, onUpdate, onSaveTargets }) {
  const light = theme === "light";
  const T = tones(theme);
  const thisYear = new Date().getFullYear();
  const years = [...new Set([...cycles.map((c) => c.year), thisYear])].sort();
  const yearChoices = [...new Set([...years, thisYear - 1, thisYear + 1])].sort();
  const [year, setYear] = useState(thisYear);
  const [msg, setMsg] = useState({ text: "", err: false });
  const [busy, setBusy] = useState(false);

  // New cycle form
  const [form, setForm] = useState(() => ({ name: firstFree(cycles, thisYear), year: thisYear, startDate: "", endDate: "" }));
  // Once the cycle list reloads after a create, preselect the next free name.
  const [needName, setNeedName] = useState(false);
  useEffect(() => {
    if (!needName) return;
    setForm((f) => ({ ...f, name: firstFree(cycles, f.year) }));
    setNeedName(false);
  }, [cycles, needName]);
  const yearFull = usedNames(cycles, form.year).length >= CYCLE_NAMES.length;
  // Cycles usually cover one room, so none is ticked to start with.
  const [picked, setPicked] = useState(() => Object.fromEntries(rooms.map((r) => [r.id, { on: false, strain: r.cultivar || "" }])));
  // Inline edit / close on one cycle: { key, mode: "edit" | "close", name, startDate, endDate }
  const [edit, setEdit] = useState(null);

  const run = async (fn, okText) => {
    setBusy(true);
    try {
      await fn();
      setMsg({ text: okText, err: false });
      return true;
    } catch (e) {
      setMsg({ text: e.message, err: true });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    const roomIds = rooms.filter((r) => picked[r.id]?.on).map((r) => r.id);
    const err = check({ ...form, roomIds }, cycles, rooms);
    if (err) return setMsg({ text: err, err: true });
    const ok = await run(
      () =>
        onCreate({
          name: form.name.trim(),
          year: Number(form.year),
          startDate: form.startDate,
          endDate: form.endDate,
          rooms: roomIds.map((roomId) => ({ roomId, strain: picked[roomId].strain.trim() })),
        }),
      `Created ${form.year} · ${form.name.trim()} for ${roomIds.length} ${roomIds.length === 1 ? "room" : "rooms"}.`
    );
    if (ok) {
      setYear(Number(form.year));
      setForm({ name: "", year: Number(form.year), startDate: "", endDate: "" });
      setNeedName(true);
    }
  };

  const saveEdit = async (c) => {
    const closing = edit.mode === "close";
    const err = check({ ...edit, year: c.year, roomIds: c.rows.map((r) => r.roomId), closing }, cycles, rooms, c);
    if (err) return setMsg({ text: err, err: true });
    const ok = await run(
      () => onUpdate(c, { name: edit.name.trim(), startDate: edit.startDate, endDate: edit.endDate, ...(closing && { status: "complete" }) }),
      closing ? `Closed ${c.name}.` : `Saved ${c.name}.`
    );
    if (ok) setEdit(null);
  };

  const shown = cycles.filter((c) => c.year === year).slice().reverse();
  const fmt = (iso) => (iso ? new Date(iso + "T00:00").toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—");

  return (
    <main className={cx.main}>
      <div>
        <div className="flex items-center gap-2.5">
          <span className={cx.eyebrow}>Settings</span>
          <AdminBadge />
        </div>
        <div className={cx.h1}>{tab === "targets" ? "Room Targets" : "Harvest Cycles"}</div>
        <div className={cx.sub}>
          {tab === "targets"
            ? "Target ranges for each room's readings. They decide the in range, drifting and out of range colours on Live Rooms and the room pages."
            : "Each cycle has a start date and an estimated end date. Readings, leachate captures and daily records dated inside that range count toward the cycle. Several cycles can run at once in different rooms; one with a future start date shows as Scheduled until it starts. Update the estimate any time, and close the cycle with the actual end date when the room is harvested."}
        </div>
        <div className="mt-6 inline-flex gap-1 rounded-full border border-vbd bg-vcard p-1">
          {[
            ["cycles", "Harvest cycles"],
            ["targets", "Targets"],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => onTab(k)}
              style={tabStyle(tab === k, light)}
              className="whitespace-nowrap rounded-full border px-4 py-[9px] text-sm font-semibold transition-all duration-200 hover:!text-vt1"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "targets" ? (
        <Targets rooms={rooms} cycles={cycles} targets={targets} theme={theme} onSave={onSaveTargets} />
      ) : (
        <>

      {msg.text && (
        <div
          className="mt-6 rounded-[14px] border px-4 py-3 text-sm text-vt1"
          style={
            msg.err
              ? { background: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.35)" }
              : { background: "rgba(16,185,129,0.10)", borderColor: "rgba(16,185,129,0.35)" }
          }
        >
          {msg.text}
        </div>
      )}

      <div className="mt-8 grid grid-cols-[minmax(0,1.5fr)_minmax(min(100%,400px),1fr)] items-start gap-6">
        {/* Cycle list */}
        <div className={cx.card + " overflow-hidden"}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-vbd px-6 py-5">
            <span className="text-lg font-bold">Cycles</span>
            <div className="flex flex-wrap gap-1.5">
              {years.map((y) => (
                <Pill key={y} active={y === year} light={light} className="tnum !px-4 !py-2 !font-bold" onClick={() => setYear(y)}>
                  {y}
                </Pill>
              ))}
            </div>
          </div>
          {!shown.length && <div className="px-6 py-10 text-center text-[15px] text-vt3">No cycles in {year} yet. Create one on the right.</div>}
          {shown.map((c) => {
            const isEdit = edit?.key === c.key;
            const roomNames = c.rows.map((r) => (rooms.find((x) => x.id === r.roomId) || {}).name || "?").join(", ");
            const strains = [...new Set(c.rows.map((r) => r.strain).filter(Boolean))].join(", ");
            const [stLabel, stTone] = cycleState(c, T);
            return (
              <div key={c.key} className="border-b border-vbd px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[19px] font-bold tracking-[-0.015em]">{c.label}</span>
                      <span
                        className="whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold"
                        style={{
                          color: stTone ? stTone[0] : "var(--vt3)",
                          borderColor: stTone ? stTone[1] : "var(--vbd2)",
                          background: stTone ? stTone[2] : "transparent",
                        }}
                      >
                        {c.current ? "Running" : stLabel}
                      </span>
                    </div>
                    <div className="tnum mt-1.5 text-sm text-vt2">
                      {fmt(c.startDate)} → {c.open ? "est. " + fmt(c.endDate) : fmt(c.endDate)}
                      <span className="text-vt4">
                        {" · "}
                        {c.current ? `day ${c.days}${c.estDays ? " of ~" + c.estDays : ""}` : c.scheduled ? `~${c.days} days planned` : c.days + " days"}
                      </span>
                    </div>
                    <div className="mt-1 text-[13px] text-vt3">
                      {roomNames}
                      {strains && " · " + strains}
                    </div>
                  </div>
                  {!isEdit && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        className={cx.btnGhost + " !px-3.5 !py-2 !text-xs"}
                        onClick={() => setEdit({ key: c.key, mode: "edit", name: c.label, startDate: c.startDate, endDate: c.endDate || "" })}
                      >
                        Edit
                      </button>
                      {c.current && (
                        <button
                          type="button"
                          className={cx.btnGhost + " !px-3.5 !py-2 !text-xs"}
                          onClick={() => setEdit({ key: c.key, mode: "close", name: c.label, startDate: c.startDate, endDate: today() })}
                        >
                          Close cycle
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {isEdit && (
                  <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] items-end gap-3 rounded-[18px] border border-vbd bg-vtile p-4">
                    {edit.mode === "edit" && (
                      <Field label="Name">
                        <Select light={light} value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })}>
                          {nameOptions(cycles, c.year, c.key)}
                        </Select>
                      </Field>
                    )}
                    {edit.mode === "edit" && (
                      <Field label="Start date">
                        <DateInput light={light} value={edit.startDate} onChange={(v) => setEdit({ ...edit, startDate: v })} />
                      </Field>
                    )}
                    <Field label={edit.mode === "close" ? "Actual end date" : c.open ? "Estimated end" : "End date"}>
                      <DateInput light={light} value={edit.endDate} onChange={(v) => setEdit({ ...edit, endDate: v })} />
                    </Field>
                    <div className="flex gap-2">
                      <button type="button" disabled={busy} className={cx.btnPrimary} onClick={() => saveEdit(c)}>
                        {busy ? "Saving…" : edit.mode === "close" ? "Close cycle" : "Save"}
                      </button>
                      <button type="button" className={cx.btnGhost} onClick={() => setEdit(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* New cycle */}
        <div className={cx.card + " p-[26px]"}>
          <div className="text-xl font-bold">New cycle</div>
          <div className="mt-1.5 text-sm text-vt3">Creates the cycle for each room you tick. You can change the estimated end later.</div>
          <div className="mt-5 flex flex-col gap-3.5">
            <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
              <Field label="Name">
                <Select light={light} value={form.name} onChange={(v) => setForm({ ...form, name: v })}>
                  <option value="" disabled>
                    {yearFull ? `All ${CYCLE_NAMES.length} used` : "Pick a cycle"}
                  </option>
                  {nameOptions(cycles, form.year)}
                </Select>
              </Field>
              <Field label="Year">
                <Select light={light} value={form.year} onChange={(v) => setForm({ ...form, year: Number(v), name: firstFree(cycles, v) })}>
                  {yearChoices.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <DateInput light={light} value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
              </Field>
              <Field label="Estimated end">
                <DateInput light={light} value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} />
              </Field>
            </div>
            <div>
              <span className={cx.label}>Rooms · strain (optional)</span>
              <div className="mt-2 flex flex-col gap-2">
                {rooms.map((r) => {
                  const p = picked[r.id] || { on: false, strain: "" };
                  return (
                    <div key={r.id} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3">
                      <label className="flex items-center gap-2.5 text-sm font-semibold">
                        <input type="checkbox" checked={p.on} onChange={(e) => setPicked({ ...picked, [r.id]: { ...p, on: e.target.checked } })} />
                        {r.name}
                      </label>
                      <input
                        className={cx.input + " !py-2.5 !text-sm"}
                        disabled={!p.on}
                        value={p.strain}
                        placeholder="Strain"
                        onChange={(e) => setPicked({ ...picked, [r.id]: { ...p, strain: e.target.value } })}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <button type="button" disabled={busy} onClick={create} className={cx.btnPrimary + " mt-1"}>
              {busy ? "Saving…" : "Create cycle"}
            </button>
          </div>
        </div>
      </div>
        </>
      )}
    </main>
  );
}
