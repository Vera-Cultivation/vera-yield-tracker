import { useEffect, useRef, useState } from "react";
import { cx, I, Icon, Pill } from "../components/ui";
import { captureDay, fdate, pad2, tones } from "../lib/logic";

const EMPTY = { date: "", stage: "", dur: "", strain: "", ph: "", ec: "", vol: "", p1: "", notes: "" };
const blankRows = () => [{ ...EMPTY }, { ...EMPTY }, { ...EMPTY }];

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
// Blank Date/Stage cells carry down from the row above (merged cells in the sheet).
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

export default function DataEntry({ rooms, theme, cycles, openCycle, saved, onSave }) {
  const light = theme === "light";
  const T = tones(theme);
  const [eCycle, setECycle] = useState(openCycle >= 0 ? openCycle : cycles.length - 1);
  const [eRoom, setERoom] = useState(0);
  const [rows, setRows] = useState(blankRows);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [toast, setToast] = useState("");
  const [toastErr, setToastErr] = useState(false);
  const [saving, setSaving] = useState(false);
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const ecy = cycles[eCycle];
  const eOpen = eCycle === openCycle;
  const room = rooms[Math.min(eRoom, rooms.length - 1)];
  const eff = carry(rows);
  const validN = eff.filter(rowValid).length;
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
      const add = eff.filter(rowValid).map((r) => ({ ...r, cycleKey: ecy.key, roomId: room.id }));
      await onSave(add, ecy);
      setRows(blankRows());
      flash("Saved " + add.length + (add.length === 1 ? " row" : " rows") + " to leachate_log · " + ecy.name + " / " + room.name);
    } catch (e) {
      flash("Couldn't save: " + e.message, true);
    } finally {
      setSaving(false);
    }
  };

  const importPaste = () => {
    const K = ["date", "stage", "dur", "strain", "ph", "ec", "vol", "p1", "notes"];
    const parsed = pasteText
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => {
        const c = l.split(l.indexOf("\t") >= 0 ? "\t" : ",");
        const o = {};
        K.forEach((k, j) => {
          o[k] = (k === "notes" ? c.slice(8).join(", ") : c[j] || "").trim();
        });
        if (/^day\s*\d+/i.test(o.date)) o.date = "";
        return o;
      })
      .filter((r) => !/^date$/i.test(r.date) && (r.strain || NUM_K.some((k) => r[k])));
    const keep = rows.filter((r) => ["ph", "ec", "vol", "p1", "notes", "dur"].some((k) => r[k]));
    const all = keep.concat(parsed);
    setRows(all.length ? all : blankRows());
    setPasteOpen(false);
    setPasteText("");
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

  const editCols = "grid-cols-[36px_110px_64px_180px_150px_76px_76px_100px_110px_minmax(260px,2fr)_40px]";
  const viewCols = "grid-cols-[110px_64px_170px_150px_76px_76px_100px_110px_minmax(260px,2fr)]";
  const savedCols = "grid-cols-[130px_100px_90px_60px_130px_70px_70px_90px_90px_minmax(0,1.8fr)_130px]";
  const savedRows = saved.slice(0, 12);

  return (
    <main className={cx.main}>
      <div>
        <div className="flex items-center gap-2.5">
          <span className={cx.eyebrow}>Data Entry</span>
          <span className="whitespace-nowrap rounded-full border border-vbd2 px-[9px] py-[3px] text-[10px] font-bold uppercase tracking-[0.12em] text-vt3">Admin &amp; Staff</span>
        </div>
        <div className={cx.h1}>Add Data to a Harvest Cycle</div>
        <div className={cx.sub}>
          Rows are saved to the Supabase leachate_log table under the cycle and room you pick. The current cycle accepts new rows; earlier cycles are view-only. The columns match the Google Sheet the grow team already uses, so you can paste straight from it.
        </div>
      </div>

      <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-5">
        <div className={cx.card + " px-6 py-[22px]"}>
          <StepTitle n="1">Harvest cycle</StepTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            {cycles.map((c, i) => (
              <Pill
                key={c.key}
                active={i === eCycle}
                light={light}
                onClick={() => {
                  setECycle(i);
                  setPasteOpen(false);
                }}
              >
                {c.name + (i === openCycle ? " · Current" : "")}
              </Pill>
            ))}
          </div>
        </div>
        <div className={cx.card + " px-6 py-[22px]"}>
          <StepTitle n="2">Room</StepTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            {rooms.map((r, i) => (
              <Pill key={r.id} active={r.id === room.id} light={light} onClick={() => setERoom(i)}>
                {r.name}
              </Pill>
            ))}
          </div>
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
          {eOpen && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setPasteOpen((o) => !o)} className={cx.btnGhost}>
                <Icon d={I.clipboard} />
                Paste From Sheet
              </button>
              <button type="button" onClick={() => setRows((rs) => rs.concat([{ ...EMPTY }]))} className={cx.btnGhost}>
                <Icon d={I.plus} />
                Add Row
              </button>
              <button type="button" onClick={save} className={cx.btnPrimary} style={{ opacity: validN && !saving ? 1 : 0.45 }}>
                {saving ? "Saving…" : "Save to Supabase"}
              </button>
            </div>
          )}
        </div>

        {eOpen ? (
          <>
            {pasteOpen && (
              <div className="flex flex-col gap-3 border-b border-vbd bg-vtile px-6 py-5">
                <div className="text-sm text-vt2">
                  Copy rows from the Leachate Capture tab in this order — blank Date and Stage cells carry down from the row above, just like the merged cells in the sheet:{" "}
                  <span className="font-mono text-[13px] text-vt1">Date · Stage · Duration of Capture · Strain · pH · EC · Volume (mL) · % of P1 Irrigation Vol · Capture Notes</span>
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
              <div className="min-w-[1400px]">
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
                    <span className="font-mono text-[13px] font-bold" style={{ color: rowValid(eff[ri]) ? acc : "var(--vt4)" }}>
                      {ri + 1}
                    </span>
                    {COLS.map(([k, ph]) => (
                      <input
                        key={k}
                        value={row[k] || ""}
                        onChange={(e) => setCell(ri, k, e.target.value)}
                        placeholder={ri > 0 && (k === "date" || k === "stage") ? "↑ same" : ph}
                        className={
                          "w-full min-w-0 rounded-xl border bg-vtile px-3 py-[11px] text-sm text-vt1 outline-none focus:!border-[rgba(16,185,129,0.5)] focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)] " +
                          (MONO.includes(k) ? "font-mono" : "")
                        }
                        style={{ borderColor: bad(k, row[k]) ? T.red[1] : "var(--vbd)" }}
                      />
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
                View only — {ecy.name} {ecy.current ? "isn't open for entry" : "is closed"}, so its leachate captures can be read but not edited.
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
              {openCycle >= 0 ? (
                <button
                  type="button"
                  onClick={() => setECycle(openCycle)}
                  className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.08)] px-4 py-2.5 text-[13px] font-semibold text-vaccent hover:bg-[rgba(16,185,129,0.16)]"
                >
                  Add rows to {cycles[openCycle].name}
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
            <div className="min-w-[1260px]">
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
              </div>
              {savedRows.map((sv) => (
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
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
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
