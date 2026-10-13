import { useEffect, useRef, useState } from "react";
import { cx, I, Icon, Pill } from "../components/ui";
import StatusFilter, { defaultStatus, matchStatus, statusLabel } from "../components/StatusFilter";
import { captureDay, cycleRooms, fdate, isoDay, pad2, pickCycle, tones } from "../lib/logic";

const EMPTY = { date: "", stage: "", dur: "", strain: "", ph: "", ec: "", vol: "", p1: "", notes: "" };
// New rows start on today's date; pick another in the calendar.
const blankRows = () => [0, 1, 2].map(() => ({ ...EMPTY, date: isoDay(new Date()) }));

// Stage numbers offered in the dropdown. Change to match the grow schedule.
const STAGES = ["1", "2", "3", "4", "5", "6"];
// Capture times in 30-minute steps: "12:00 AM" … "11:30 PM".
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  return (h % 12 || 12) + ":" + (i % 2 ? "30" : "00") + " " + (h < 12 ? "AM" : "PM");
});
/** "1:30am" / "1:30 AM" / "13:30" -> "1:30 PM"-style; anything else is returned as typed. */
function normTime(s) {
  const t = String(s || "").trim();
  const ap = t.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m?\.?$/i);
  if (ap && +ap[1] >= 1 && +ap[1] <= 12) return +ap[1] + ":" + (ap[2] || "00") + " " + ap[3].toUpperCase() + "M";
  const h24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (h24 && +h24[1] <= 23) return (+h24[1] % 12 || 12) + ":" + h24[2] + " " + (+h24[1] < 12 ? "AM" : "PM");
  return t;
}
// Duration of capture is stored as one text value, "1:30 AM - 5:30 AM".
const splitDur = (v) => {
  const [a = "", b = ""] = String(v || "").split(/\s*[-–]\s*/);
  return [normTime(a), normTime(b)];
};
const joinDur = (a, b) => (a || b ? (a + " - " + b).trim() : "");

// CSV columns, in the same order as the Google Sheet and the paste box.
const CSV_HEAD = ["Date", "Stage", "Duration of Capture", "Strain", "pH", "EC", "Volume (mL)", "% of P1 Irrigation Vol", "Capture Notes"];
const CSV_SAMPLE = [
  ["9/29/2026", "2", "1:30 AM - 5:30 AM", "JOB 28", "5.8", "5.1", "1600", "43%", "Optional notes"],
  ["9/29/2026", "2", "1:30 AM - 5:30 AM", "Strain B", "6.0", "4.8", "1200", "35%", ""],
];
const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
/** Saves rows as a CSV that Excel opens directly (the BOM keeps non-ASCII text intact). */
function downloadCsv(name, rows) {
  const blob = new Blob(["﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
/** Tab-separated (pasted from the sheet) or comma-separated (CSV) text -> rows of cells. Handles quoted cells. */
function parseDelimited(text) {
  const t = text.replace(/^﻿/, "");
  const delim = t.split(/\r?\n/)[0].includes("\t") ? "\t" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (t[i + 1] === '"') (cell += '"'), i++;
      else quoted = false;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) row.push(cell), (cell = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += ch;
  }
  row.push(cell), rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** One editable cell: calendar for Date, dropdowns for Stage and the capture times, text box otherwise. */
function Cell({ k, value, onChange, placeholder, borderColor, light, compact = false }) {
  const cls =
    "w-full min-w-0 rounded-xl border bg-vtile text-sm text-vt1 outline-none focus:!border-[rgba(16,185,129,0.5)] focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)] " +
    (compact ? "px-2.5 py-2" : "px-3 py-[11px]") +
    (MONO.includes(k) ? " font-mono" : "");
  const style = { borderColor, colorScheme: light ? "light" : "dark" };
  // A value from older rows or an import that isn't in the list still shows.
  const opts = (list, v) => (v && !list.includes(v) ? [v, ...list] : list);

  if (k === "date")
    return (
      <input
        type="date"
        value={captureDay(value) || ""}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker();
          } catch {
            /* older browsers: the calendar icon still works */
          }
        }}
        className={cls + " cursor-pointer"}
        style={style}
      />
    );
  if (k === "stage")
    return (
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={cls + " cursor-pointer !px-2"} style={style}>
        <option value="">—</option>
        {opts(STAGES, value).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    );
  if (k === "dur") {
    const [a, b] = splitDur(value);
    const pick = (v, which) => (
      <select
        value={v}
        onChange={(e) => onChange(which === 0 ? joinDur(e.target.value, b) : joinDur(a, e.target.value))}
        className={cls + " cursor-pointer !px-2"}
        style={style}
        aria-label={which === 0 ? "Capture start" : "Capture end"}
      >
        <option value="">{which === 0 ? "From" : "To"}</option>
        {opts(TIMES, v).map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    );
    return (
      <div className="flex min-w-0 items-center gap-1">
        {pick(a, 0)}
        <span className="text-vt4">–</span>
        {pick(b, 1)}
      </div>
    );
  }
  return <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} style={style} />;
}

// Columns match the grow team's Google Sheet "Leachate Capture" tab.
const COLS = [
  ["date", "9/29/26"],
  ["stage", "2"],
  ["dur", "1:30 AM - 5:30 AM"],
  ["strain", "Strain"],
  ["ph", "5.8"],
  ["ec", "5.1"],
  ["vol", "1600"],
  ["p1", "43%"],
  ["notes", "Optional"],
];
const MONO = ["date", "stage", "ph", "ec", "vol", "p1"];
const NUM_K = ["ph", "ec", "vol", "p1"];
const RNG = { ph: [3, 9], ec: [0, 20], vol: [0, 5000], p1: [0, 100] };

const num = (v) => Number(String(v).replace(/\+/g, "").replace(/%/g, "").trim());
function bad(k, v) {
  if (v === "" || v == null || ["notes", "dur", "strain", "stage"].includes(k)) return false;
  // Same parser the save uses, so a date that shows as valid can always be stored.
  if (k === "date") return captureDay(v) == null;
  const n = num(v);
  return isNaN(n) || n < RNG[k][0] || n > RNG[k][1];
}
// Blank Date/Stage cells in pasted or imported rows carry down from the row above (merged cells in the sheet).
function carry(rows) {
  let d = "";
  let sg = "";
  return rows.map((r) => {
    d = r.date || d;
    sg = r.stage || sg;
    return { ...r, date: d, stage: sg };
  });
}
const rowValid = (r) => !!r.date && !!(r.strain || "").trim() && !["date", ...NUM_K].some((k) => bad(k, r[k])) && NUM_K.some((k) => r[k] !== "");
const fmtP1 = (p) => (p ? (String(p).includes("%") ? p : p + "%") : "—");
const fmtAt = (iso) => {
  const d = new Date(iso);
  return fdate(d) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
};

export default function DataEntry({ rooms, theme, cycles, defaultCycle, saved, onSave, onUpdate }) {
  const light = theme === "light";
  const T = tones(theme);
  const [eCycle, setECycle] = useState(defaultCycle);
  const [eRoom, setERoom] = useState(null); // room id; null = first room in the cycle
  const [eStatus, setEStatus] = useState(() => defaultStatus(cycles));
  const [rows, setRows] = useState(blankRows);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [toast, setToast] = useState("");
  const [toastErr, setToastErr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editRow, setEditRow] = useState(EMPTY);
  const [updating, setUpdating] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editIn, setEditIn] = useState("saved"); // which table the row is being edited in
  const [showRoom, setShowRoom] = useState(false);
  const toastTimer = useRef(null);
  const fileRef = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const ecy = cycles[eCycle];
  const eOpen = ecy.current; // several cycles can be running at once (one per room)
  const eRooms = rooms.filter((r) => ecy.ids[r.id]);
  const room = eRooms.find((r) => r.id === eRoom) || eRooms[0] || rooms[0];
  // A running cycle to offer from a closed or scheduled one: this room's, else any.
  const runningIdx = [cycles.findIndex((c) => c.current && c.ids[room.id]), cycles.findIndex((c) => c.current)].find((i) => i >= 0) ?? -1;
  const shownIdx = cycles.map((c, i) => i).filter((i) => matchStatus(cycles[i], eStatus)).reverse();
  // A new filter keeps the picked cycle if it's still listed, else picks one that is.
  const pickStatus = (st) => {
    setEStatus(st);
    const idx = cycles.map((c, i) => i).filter((i) => matchStatus(cycles[i], st));
    if (!idx.includes(eCycle) && idx.length) {
      setECycle(pickCycle(cycles, idx));
      setPasteOpen(false);
    }
  };
  const validN = rows.filter(rowValid).length;
  const badN = rows.filter((r) => ["date", ...NUM_K].some((k) => bad(k, r[k]))).length;
  const acc = light ? "#047857" : "#10b981";

  const setCell = (ri, k, v) => setRows((rs) => rs.map((x, j) => (j === ri ? { ...x, [k]: v } : x)));
  const flash = (msg, isErr = false) => {
    setToast(msg);
    setToastErr(isErr);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 6000);
  };

  const save = async () => {
    if (!eOpen || !validN || saving) return;
    setSaving(true);
    try {
      const add = rows.filter(rowValid).map((r) => ({ ...r, cycleKey: ecy.key, roomId: room.id }));
      await onSave(add, ecy);
      setRows(blankRows());
      flash("Saved " + add.length + (add.length === 1 ? " row" : " rows") + " to leachate_log · " + ecy.name + " / " + room.name);
    } catch (e) {
      flash("Couldn't save: " + e.message, true);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (sv, where = "saved") => {
    setEditId(sv.id);
    setEditIn(where);
    setEditErr("");
    setEditRow({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, sv[k] || ""])) });
  };
  const editOk = rowValid(editRow);
  const update = async () => {
    if (updating) return;
    if (!editOk) {
      setEditErr("Check the values: Date and Strain are required, and red fields are out of range.");
      return;
    }
    setUpdating(true);
    setEditErr("");
    try {
      await onUpdate(editId, editRow);
      setEditId(null);
      flash("Updated row in leachate_log");
    } catch (e) {
      setEditErr("Couldn't update: " + e.message);
    } finally {
      setUpdating(false);
    }
  };

  const importPaste = () => {
    const K = ["date", "stage", "dur", "strain", "ph", "ec", "vol", "p1", "notes"];
    let unread = 0;
    const parsed = carry(
      parseDelimited(pasteText)
        .map((c) => {
          const o = {};
          K.forEach((k, j) => {
            o[k] = (k === "notes" ? c.slice(8).join(", ") : c[j] || "").trim();
          });
          if (/^day\s*\d+/i.test(o.date)) o.date = "";
          return o;
        })
        .filter((r) => !/^date$/i.test(r.date) && (r.strain || NUM_K.some((k) => r[k])))
    ).map((r) => {
      // The calendar needs a real date; a date that can't be read is left blank to pick by hand.
      const d = captureDay(r.date);
      if (r.date && !d) unread++;
      return { ...r, date: d || "", dur: joinDur(...splitDur(r.dur)) };
    });
    if (!parsed.length) return flash("No rows found. Check the columns match the sample file.", true);
    const keep = rows.filter((r) => ["strain", "ph", "ec", "vol", "p1", "notes", "dur"].some((k) => r[k]));
    setRows(keep.concat(parsed));
    setPasteOpen(false);
    setPasteText("");
    flash(
      "Imported " + parsed.length + (parsed.length === 1 ? " row" : " rows") +
        (unread ? " · " + unread + " with a date that couldn't be read (use M/D/YYYY or YYYY-MM-DD) — pick it in the calendar" : "") +
        ". Check them, then Save to Supabase.",
      !!unread
    );
  };

  const loadFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // so the same file can be picked again
    if (!f) return;
    f.text().then((t) => {
      setPasteText(t.replace(/^﻿/, ""));
      setPasteOpen(true);
    });
  };

  const addRow = () =>
    setRows((rs) => {
      const last = rs[rs.length - 1] || {};
      return rs.concat([{ ...EMPTY, date: last.date || isoDay(new Date()), stage: last.stage || "" }]);
    });

  const exportCsv = () => {
    if (!roomRows.length) return flash("No saved rows for " + room.name + " in " + ecy.name + " to export.", true);
    const data = roomRows.map((x) => [x.date, x.stage, x.dur, x.strain, x.ph, x.ec, x.vol, x.p1 ? fmtP1(x.p1) : "", x.notes]);
    downloadCsv(("leachate " + ecy.name + " " + room.name).replace(/[^\w-]+/g, "-") + ".csv", [CSV_HEAD, ...data]);
  };

  // Closed cycles: the captures saved to leachate_log for this cycle + room.
  const viewRows = eOpen
    ? []
    : saved
        .filter((x) => x.cycleKey === ecy.key && x.roomId === room.id)
        .map((x, j) => ({
          date: x.date,
          stage: x.stage,
          dur: x.dur,
          strain: x.strain || "—",
          ph: x.ph || "—",
          ec: x.ec || "—",
          vol: x.vol || "—",
          p1: fmtP1(x.p1),
          notes: x.notes,
          line: j === 0 ? "var(--vbd2)" : "var(--vbd)",
          bg: "transparent",
        }));

  // Current cycle: everything already saved for the selected room ("View Room data").
  const roomRows = saved.filter((x) => x.cycleKey === ecy.key && x.roomId === room.id);

  const closeRoom = () => {
    setShowRoom(false);
    if (editIn === "room") setEditId(null);
  };

  const editCols = "grid-cols-[36px_150px_76px_250px_150px_76px_76px_100px_110px_minmax(240px,2fr)_40px]";
  const viewCols = "grid-cols-[110px_64px_170px_150px_76px_76px_100px_110px_minmax(260px,2fr)]";
  const savedCols = "grid-cols-[130px_100px_145px_76px_130px_70px_70px_90px_90px_minmax(0,1.8fr)_130px_150px]";
  const roomCols = "grid-cols-[145px_76px_250px_150px_76px_76px_100px_110px_minmax(240px,2fr)_150px]";
  const cellProps = (k, val, set, compact) => ({ k, value: val, onChange: set, borderColor: bad(k, val) ? T.red[1] : "var(--vbd)", light, compact });
  const savedRows = saved.slice(0, 12);
  const editBtns = (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={update}
        className="whitespace-nowrap rounded-full border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.08)] px-3 py-1.5 text-[12px] font-semibold text-vaccent hover:bg-[rgba(16,185,129,0.16)]"
        style={{ opacity: editOk && !updating ? 1 : 0.45 }}
      >
        {updating ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditId(null)}
        className="whitespace-nowrap rounded-full border border-vbd2 px-3 py-1.5 text-[12px] font-semibold text-vt3 hover:text-vt1"
      >
        Cancel
      </button>
    </span>
  );

  return (
    <main className={cx.main}>
      <div>
        <div className="flex items-center gap-2.5">
          <span className={cx.eyebrow}>Data Entry</span>
          <span className="whitespace-nowrap rounded-full border border-vbd2 px-[9px] py-[3px] text-[10px] font-bold uppercase tracking-[0.12em] text-vt3">Admin &amp; Staff</span>
        </div>
        <div className={cx.h1}>Add Data to a Harvest Cycle</div>
        <div className={cx.sub}>
          Rows are saved to the Supabase leachate_log table under the cycle and room you pick. Cycles in progress accept new rows; scheduled and closed cycles are view-only. The columns match the Google Sheet the grow team already uses, so you can paste straight from it.
        </div>
      </div>

      <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-5">
        <div className={cx.card + " px-6 py-[22px]"}>
          <StepTitle n="1">Harvest cycle</StepTitle>
          {/* Running cycles accept new rows; scheduled and closed ones can be viewed. Newest first. */}
          <div className="mt-3.5">
            <StatusFilter cycles={cycles} value={eStatus} onChange={pickStatus} light={light} label="" />
          </div>
          <div className="mt-3.5 flex flex-wrap gap-2">
            {!shownIdx.length && <span className="text-[13px] text-vt4">No {statusLabel(eStatus).toLowerCase()} cycles.</span>}
            {shownIdx.map((i) => (
              <Pill
                key={cycles[i].key}
                active={i === eCycle}
                light={light}
                onClick={() => {
                  setECycle(i);
                  setPasteOpen(false);
                }}
              >
                {cycles[i].name}
                <span className="text-vt4">{" · " + cycleRooms(cycles[i], rooms)}</span>
              </Pill>
            ))}
          </div>
        </div>
        <div className={cx.card + " px-6 py-[22px]"}>
          <StepTitle n="2">Room</StepTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            {eRooms.map((r) => (
              <Pill key={r.id} active={r.id === room.id} light={light} onClick={() => setERoom(r.id)}>
                {r.name}
              </Pill>
            ))}
          </div>
          {eRooms.length < rooms.length && <div className="mt-3 text-[13px] text-vt4">Only rooms that are part of {ecy.name} are shown.</div>}
        </div>
      </div>

      {toast && (
        <div
          className="mt-5 flex items-center gap-3 rounded-[20px] border px-5 py-4 text-[15px] font-semibold text-vt1"
          style={
            toastErr
              ? { background: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.35)" }
              : { background: "rgba(16,185,129,0.10)", borderColor: "rgba(16,185,129,0.35)" }
          }
        >
          <Icon d={toastErr ? I.x : I.check} size={18} stroke={2} color={toastErr ? "#ef4444" : "#10b981"} />
          {toast}
        </div>
      )}

      <div className={cx.card + " mt-5 overflow-hidden"}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-vbd px-6 py-[22px]">
          <div>
            <div className="flex items-center gap-2.5">
              <StepTitle n="3" big>
                Leachate Capture
              </StepTitle>
              <span
                className="whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold"
                style={{ color: eOpen ? T.green[0] : "var(--vt3)", borderColor: eOpen ? T.green[1] : "var(--vbd2)", background: eOpen ? T.green[2] : "transparent" }}
              >
                {eOpen ? "Current · editable" : "View only"}
              </span>
            </div>
            <div className="mt-1.5 text-[13px] text-vt3">
              {(eOpen ? "Adding to " : "Viewing ") + ecy.name + " → " + room.name + " · Leachate Capture tab"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {eOpen && (
              <>
                <button type="button" onClick={() => setShowRoom(true)} className={cx.btnGhost}>
                  <Icon d={I.eye} />
                  View All Data
                </button>
                <button type="button" onClick={() => downloadCsv("leachate-capture-sample.csv", [CSV_HEAD, ...CSV_SAMPLE])} className={cx.btnGhost}>
                  <Icon d={I.download} />
                  Download Sample
                </button>
                <button type="button" onClick={() => setPasteOpen((o) => !o)} className={cx.btnGhost}>
                  <Icon d={I.clipboard} />
                  Import CSV / Paste
                </button>
              </>
            )}
            <button type="button" onClick={exportCsv} className={cx.btnGhost}>
              <Icon d={I.download} />
              Export CSV
            </button>
            {eOpen && (
              <>
                <button type="button" onClick={addRow} className={cx.btnGhost}>
                  <Icon d={I.plus} />
                  Add Row
                </button>
                <button type="button" onClick={save} className={cx.btnPrimary} style={{ opacity: validN && !saving ? 1 : 0.45 }}>
                  {saving ? "Saving…" : "Save to Supabase"}
                </button>
              </>
            )}
          </div>
        </div>

        {eOpen ? (
          <>
            {pasteOpen && (
              <div className="flex flex-col gap-3 border-b border-vbd bg-vtile px-6 py-5">
                <div className="text-sm text-vt2">
                  Fill in the sample file (Download Sample) in Excel, save it as CSV and upload it — or paste rows straight from the Leachate Capture tab. Columns in this order; blank Date and Stage
                  cells carry down from the row above, just like the merged cells in the sheet:{" "}
                  <span className="font-mono text-[13px] text-vt1">Date · Stage · Duration of Capture · Strain · pH · EC · Volume (mL) · % of P1 Irrigation Vol · Capture Notes</span>
                </div>
                <div>
                  <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" onChange={loadFile} className="hidden" />
                  <button type="button" onClick={() => fileRef.current.click()} className={cx.btnGhost}>
                    <Icon d={I.sheet} />
                    Upload CSV File
                  </button>
                </div>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"5/28/26\t2\t1:30 AM - 5:30 AM\tJOB 28\t5.61\t6.0 +\t1100\t20%\t"}
                  className="min-h-[120px] w-full resize-y rounded-[14px] border border-vbd2 bg-vcard p-3.5 font-mono text-sm text-vt1 outline-none"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={importPaste} className={cx.btnPrimary}>
                    Import Rows
                  </button>
                  <button type="button" onClick={() => setPasteOpen(false)} className={cx.btnGhost}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <div className="min-w-[1480px]">
                <div className={"grid items-end gap-2.5 border-b border-vbd px-6 py-3 text-[10px] font-bold uppercase leading-[1.35] tracking-[0.12em] text-vt3 " + editCols}>
                  <span>#</span>
                  <span>Date</span>
                  <span>Stage</span>
                  <span>Duration of Capture</span>
                  <span>Strain</span>
                  <span>pH</span>
                  <span>EC</span>
                  <span>Volume (mL)</span>
                  <span>% of P1 Irrigation Vol</span>
                  <span>Capture Notes &amp; Irrigation Schedule Updates</span>
                  <span />
                </div>
                {rows.map((row, ri) => (
                  <div key={ri} className={"grid items-center gap-2.5 border-b border-vbd px-6 py-2.5 " + editCols}>
                    <span className="font-mono text-[13px] font-bold" style={{ color: rowValid(row) ? acc : "var(--vt4)" }}>
                      {ri + 1}
                    </span>
                    {COLS.map(([k, ph]) => (
                      <Cell key={k} {...cellProps(k, row[k], (v) => setCell(ri, k, v))} placeholder={ph} />
                    ))}
                    <button
                      type="button"
                      title="Remove row"
                      onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== ri) : blankRows()))}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-transparent text-vt3 hover:border-[rgba(239,68,68,0.4)] hover:text-[#ef4444]"
                    >
                      <Icon d={I.x} size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-[13px] text-vt3">
              <span>
                {validN + (validN === 1 ? " row ready" : " rows ready") + (badN ? " · " + badN + " with values out of range (marked red)" : "")}
              </span>
              <span className="text-vt4">pH 3–9 · EC 0–20 (6.0 + accepted) · Volume 0–5000 mL · % of P1 0–100</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-vbd bg-vtile px-6 py-3.5 text-sm text-vt2">
              <Icon d={I.eye} className="text-vt3" />
              <span>
                View only — {ecy.name} {ecy.scheduled ? "hasn't started yet (" + ecy.range + ")" : "is closed"}, so its leachate captures can be read but not added to.
              </span>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[1320px]">
                <div className={"grid items-end gap-2.5 border-b border-vbd px-6 py-3 text-[10px] font-bold uppercase leading-[1.35] tracking-[0.12em] text-vt3 " + viewCols}>
                  <span>Date</span>
                  <span>Stage</span>
                  <span>Duration of Capture</span>
                  <span>Strain</span>
                  <span>pH</span>
                  <span>EC</span>
                  <span>Volume (mL)</span>
                  <span>% of P1 Irrigation Vol</span>
                  <span>Capture Notes &amp; Irrigation Schedule Updates</span>
                </div>
                {!viewRows.length && <div className="px-6 py-10 text-center text-[15px] text-vt3">No leachate captures saved for {room.name} in {ecy.name}.</div>}
                {viewRows.map((v, i) => (
                  <div
                    key={i}
                    className={"tnum grid items-center gap-2.5 border-t px-6 py-[11px] text-sm hover:!bg-vsoft2 " + viewCols}
                    style={{ borderColor: v.line, background: v.bg }}
                  >
                    <span className="font-mono text-[13px] font-semibold">{v.date}</span>
                    <span className="font-semibold">{v.stage}</span>
                    <span className="text-[13px] text-vt2">{v.dur}</span>
                    <span className="font-semibold">{v.strain}</span>
                    <span className="font-mono">{v.ph}</span>
                    <span className="font-mono">{v.ec}</span>
                    <span className="font-mono">{v.vol}</span>
                    <span className="font-mono">{v.p1}</span>
                    <span className="text-[13px] text-vt2">{v.notes}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-vbd px-6 py-4 text-[13px] text-vt3">
              <span>{viewRows.length + (viewRows.length === 1 ? " row" : " rows")} in leachate_log</span>
              {runningIdx >= 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setECycle(runningIdx);
                    setEStatus("current");
                  }}
                  className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.08)] px-4 py-2.5 text-[13px] font-semibold text-vaccent hover:bg-[rgba(16,185,129,0.16)]"
                >
                  Add rows to {cycles[runningIdx].name} · {cycleRooms(cycles[runningIdx], rooms)}
                </button>
              ) : (
                <span className="text-vt4">No cycle is running. An admin can start one in Settings to accept entries.</span>
              )}
            </div>
          </>
        )}
      </div>

      <div className={cx.card + " mt-5 overflow-hidden"}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-vbd px-6 py-5">
          <span className="text-lg font-bold">Recently saved</span>
          <span className="text-[13px] text-vt3">
            {saved.length + (saved.length === 1 ? " row" : " rows") + " in leachate_log"}
          </span>
        </div>
        {saved.length === 0 ? (
          <div className="px-6 py-10 text-center text-[15px] text-vt3">Nothing saved yet. Rows you save will show up here and in Harvests.</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1560px]">
              <div className={"grid gap-2.5 border-b border-vbd px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-vt3 " + savedCols}>
                <span>Saved</span>
                <span>Room</span>
                <span>Date</span>
                <span>Stage</span>
                <span>Strain</span>
                <span>pH</span>
                <span>EC</span>
                <span>Vol (mL)</span>
                <span>% of P1</span>
                <span>Capture Notes</span>
                <span>By</span>
                <span />
              </div>
              {savedRows.map((sv) =>
                sv.id === editId && editIn === "saved" ? (
                  <div key={sv.id} className="border-b border-vbd bg-vsoft">
                  <div className={"tnum grid items-center gap-2.5 px-6 py-2.5 text-sm " + savedCols}>
                    <span className="text-[13px] text-vt3">{sv.createdAt ? fmtAt(sv.createdAt) : ""}</span>
                    <span>{(rooms.find((r) => r.id === sv.roomId) || {}).name || sv.roomId}</span>
                    {["date", "stage", "strain", "ph", "ec", "vol", "p1", "notes"].map((k) => (
                      <Cell
                        key={k}
                        {...cellProps(k, editRow[k], (v) => setEditRow((r) => ({ ...r, [k]: v })), true)}
                        placeholder={(COLS.find((c) => c[0] === k) || [])[1]}
                      />
                    ))}
                    <span className="text-vt2">{sv.by}</span>
                    <span className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={update}
                        className="whitespace-nowrap rounded-full border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.08)] px-3 py-1.5 text-[12px] font-semibold text-vaccent hover:bg-[rgba(16,185,129,0.16)]"
                        style={{ opacity: editOk && !updating ? 1 : 0.45 }}
                      >
                        {updating ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className="whitespace-nowrap rounded-full border border-vbd2 px-3 py-1.5 text-[12px] font-semibold text-vt3 hover:text-vt1"
                      >
                        Cancel
                      </button>
                    </span>
                  </div>
                  {editErr && <div className="px-6 pb-3 text-[13px] font-semibold text-[#ef4444]">{editErr}</div>}
                  </div>
                ) : (
                <div key={sv.id} className={"tnum grid items-center gap-2.5 border-b border-vbd px-6 py-3 text-sm hover:bg-vsoft " + savedCols}>
                  <span className="text-[13px] text-vt3">{sv.createdAt ? fmtAt(sv.createdAt) : ""}</span>
                  <span>{(rooms.find((r) => r.id === sv.roomId) || {}).name || sv.roomId}</span>
                  <span className="font-mono text-[13px]">{sv.date}</span>
                  <span>{sv.stage || "—"}</span>
                  <span className="font-semibold">{sv.strain || "—"}</span>
                  <span>{sv.ph || "—"}</span>
                  <span>{sv.ec || "—"}</span>
                  <span>{sv.vol || "—"}</span>
                  <span>{fmtP1(sv.p1)}</span>
                  <span className="text-vt3">{sv.notes || "—"}</span>
                  <span className="text-vt2">{sv.by}</span>
                  <span>
                    <button
                      type="button"
                      onClick={() => startEdit(sv)}
                      className="whitespace-nowrap rounded-full border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.08)] px-3 py-1.5 text-[12px] font-semibold text-vaccent hover:bg-[rgba(16,185,129,0.16)]"
                    >
                      Update
                    </button>
                  </span>
                </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
      {eOpen && showRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeRoom}>
          <div className={cx.card + " flex max-h-[85vh] w-full max-w-[1560px] flex-col overflow-hidden bg-vcard"} onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-vbd px-6 py-5">
              <div>
                <div className="text-lg font-bold">{room.name} · All Data</div>
                <div className="mt-1 text-[13px] text-vt3">{ecy.name + " · " + roomRows.length + (roomRows.length === 1 ? " row" : " rows") + " in leachate_log"}</div>
              </div>
              <button
                type="button"
                title="Close"
                onClick={closeRoom}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-vbd2 bg-transparent text-vt3 hover:text-vt1"
              >
                <Icon d={I.x} size={15} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="min-w-[1560px]">
                <div className={"grid items-end gap-2.5 border-b border-vbd px-6 py-3 text-[10px] font-bold uppercase leading-[1.35] tracking-[0.12em] text-vt3 " + roomCols}>
                  <span>Date</span>
                  <span>Stage</span>
                  <span>Duration of Capture</span>
                  <span>Strain</span>
                  <span>pH</span>
                  <span>EC</span>
                  <span>Volume (mL)</span>
                  <span>% of P1 Irrigation Vol</span>
                  <span>Capture Notes &amp; Irrigation Schedule Updates</span>
                  <span />
                </div>
                {!roomRows.length && <div className="px-6 py-10 text-center text-[15px] text-vt3">No leachate captures saved for {room.name} in {ecy.name} yet.</div>}
                {roomRows.map((x) =>
                  x.id === editId && editIn === "room" ? (
                    <div key={x.id} className="border-t border-vbd bg-vsoft">
                      <div className={"tnum grid items-center gap-2.5 px-6 py-2.5 text-sm " + roomCols}>
                        {COLS.map(([k, ph]) => (
                          <Cell key={k} {...cellProps(k, editRow[k], (v) => setEditRow((r) => ({ ...r, [k]: v })), true)} placeholder={ph} />
                        ))}
                        {editBtns}
                      </div>
                      {editErr && <div className="px-6 pb-3 text-[13px] font-semibold text-[#ef4444]">{editErr}</div>}
                    </div>
                  ) : (
                    <div key={x.id} className={"tnum grid items-center gap-2.5 border-t border-vbd px-6 py-[11px] text-sm hover:!bg-vsoft2 " + roomCols}>
                      <span className="font-mono text-[13px] font-semibold">{x.date}</span>
                      <span className="font-semibold">{x.stage || "—"}</span>
                      <span className="text-[13px] text-vt2">{x.dur || "—"}</span>
                      <span className="font-semibold">{x.strain || "—"}</span>
                      <span className="font-mono">{x.ph || "—"}</span>
                      <span className="font-mono">{x.ec || "—"}</span>
                      <span className="font-mono">{x.vol || "—"}</span>
                      <span className="font-mono">{fmtP1(x.p1)}</span>
                      <span className="text-[13px] text-vt2">{x.notes || "—"}</span>
                      <span>
                        <button
                          type="button"
                          onClick={() => startEdit(x, "room")}
                          className="whitespace-nowrap rounded-full border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.08)] px-3 py-1.5 text-[12px] font-semibold text-vaccent hover:bg-[rgba(16,185,129,0.16)]"
                        >
                          Update
                        </button>
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StepTitle({ n, children, big = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[9px] bg-[rgba(16,185,129,0.14)] text-[13px] font-extrabold text-vaccent">{n}</span>
      <span className={(big ? "text-lg" : "text-base") + " font-bold"}>{children}</span>
    </div>
  );
}
