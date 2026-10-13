import { useState } from "react";
import { AdminBadge, cx, I, Icon, pillStyle } from "../components/ui";
import { fdate, initials, tones } from "../lib/logic";
import { PERMISSIONS, STAFF_DEFAULT } from "../lib/config";

const PERM_KEYS = PERMISSIONS.map(([k]) => k);
const permLabel = (k) => (PERMISSIONS.find(([p]) => p === k) || [, k])[1];

/** Ticks or unticks `k`. Room detail opens from the Live Rooms cards, so it needs Live rooms. */
function togglePerm(list, k) {
  const next = list.includes(k)
    ? list.filter((x) => x !== k && !(k === "live_rooms" && x === "room_detail"))
    : [...list, k, ...(k === "room_detail" ? ["live_rooms"] : [])];
  return PERM_KEYS.filter((p) => next.includes(p));
}

/** Checkbox tiles for a staff member's features. */
function PermissionPicker({ value, onChange, light, T }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-2">
      {PERMISSIONS.map(([k, label, sub]) => {
        const on = value.includes(k);
        const s = pillStyle(on, light);
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(togglePerm(value, k))}
            className="flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left"
            style={{ background: s.background, borderColor: s.borderColor }}
          >
            <span
              className="flex h-5 w-5 flex-none items-center justify-center rounded-md border"
              style={{ borderColor: on ? T.green[0] : "var(--vbd2)", background: on ? T.green[2] : "transparent" }}
            >
              {on && <Icon d={I.check} size={13} stroke={2.5} color={T.green[0]} />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold" style={{ color: s.color }}>
                {label}
              </span>
              <span className="block text-xs text-vt3">{sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function Team({ theme, user, team, onAdd, onToggleRole, onToggleActive, onSetPermissions }) {
  const light = theme === "light";
  const T = tones(theme);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("staff");
  const [perms, setPerms] = useState(STAFF_DEFAULT);
  const [msg, setMsg] = useState("");
  const [msgErr, setMsgErr] = useState(false);
  const [busy, setBusy] = useState(false);
  // Editing one staff member's access: { id, perms, err, busy }
  const [edit, setEdit] = useState(null);

  const say = (m, err) => {
    setMsg(m);
    setMsgErr(err);
  };

  const add = async () => {
    const n = name.trim();
    const em = email.trim().toLowerCase();
    if (!n) return say("Add their full name.", true);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return say("That email doesn't look right.", true);
    if (password.length < 6) return say("Password needs at least 6 characters.", true);
    if (team.some((x) => x.email.toLowerCase() === em)) return say(em + " is already on the team.", true);
    if (role === "staff" && !perms.length) return say("Pick at least one permission.", true);
    setBusy(true);
    try {
      // Admins have every feature; their list only matters if they're later made staff.
      await onAdd({ name: n, email: em, password, role, perms: role === "staff" ? perms : STAFF_DEFAULT });
      setName("");
      setEmail("");
      setPassword("");
      setPerms(STAFF_DEFAULT);
      say("Added " + em + " as " + (role === "admin" ? "Admin" : "Staff") + ". They can sign in now with this email and password.", false);
    } catch (e) {
      say("Couldn't add member: " + e.message, true);
    } finally {
      setBusy(false);
    }
  };

  const guard = (fn) => async () => {
    try {
      await fn();
    } catch (e) {
      say(e.message, true);
    }
  };

  const saveEdit = async (m) => {
    if (!edit.perms.length) return setEdit({ ...edit, err: "Pick at least one permission." });
    setEdit({ ...edit, busy: true, err: "" });
    try {
      await onSetPermissions(m, edit.perms);
      setEdit(null);
      say("Updated " + m.name + "'s access.", false);
    } catch (e) {
      setEdit((x) => x && { ...x, busy: false, err: "Couldn't save: " + e.message });
    }
  };

  const aN = team.filter((x) => x.role === "admin").length;
  const sN = team.length - aN;
  const roleSty = (r) =>
    r === "admin"
      ? { color: "var(--vaccent)", borderColor: "rgba(16,185,129,0.35)", background: "rgba(16,185,129,0.10)" }
      : { color: "var(--vcyan)", borderColor: "rgba(34,211,238,0.35)", background: "rgba(34,211,238,0.10)" };
  const off = light ? "#94a3b8" : "#64748b";

  return (
    <main className={cx.main}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className={cx.eyebrow}>Team</span>
            <AdminBadge />
          </div>
          <div className={cx.h1}>Who Can See What</div>
          <div className={cx.sub}>
            Admins see everything. Staff see only the features an admin turns on for them — pick them when adding someone, and change them any time with Edit access.
          </div>
        </div>
        <div className="flex gap-2.5">
          <span className="whitespace-nowrap rounded-full border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.10)] px-4 py-2.5 text-[13px] font-bold text-vaccent">
            {aN + (aN === 1 ? " Admin" : " Admins")}
          </span>
          <span className="whitespace-nowrap rounded-full border border-[rgba(34,211,238,0.35)] bg-[rgba(34,211,238,0.10)] px-4 py-2.5 text-[13px] font-bold text-vcyan">
            {sN} Staff
          </span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,1.6fr)_minmax(min(100%,380px),1fr)] items-start gap-6">
        <div className={cx.card + " overflow-hidden"}>
          <div className="border-b border-vbd px-6 py-5 text-lg font-bold">Members</div>
          <div>
            <div>
              {team.map((m) => {
                const self = m.id === user.id;
                const editing = edit?.id === m.id;
                return (
                  <div key={m.id} className="border-b border-vbd px-6 py-4 hover:bg-vsoft" style={editing ? { background: "var(--vsoft)" } : undefined}>
                  {/* Wraps instead of squeezing: actions drop to their own line on narrow cards. */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <div className="flex min-w-[200px] flex-1 items-center gap-3">
                      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-vbd bg-vsoft2 text-[13px] font-extrabold text-vt2">
                        {initials(m.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-semibold">{m.name}</div>
                        <div className="mt-0.5 truncate text-xs text-vt3" title={m.email}>
                          {m.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      <span className="whitespace-nowrap rounded-full border px-[11px] py-[5px] text-xs font-bold" style={roleSty(m.role)}>
                        {m.role === "admin" ? "Admin" : "Staff"}
                      </span>
                      <span className="flex items-center gap-[7px] whitespace-nowrap text-[13px] text-vt2">
                        <span className="h-[7px] w-[7px] rounded-full" style={{ background: m.active ? T.green[0] : off }} />
                        {m.active ? "Active" : "Disabled"}
                      </span>
                      <span className="whitespace-nowrap text-[13px] text-vt3">{m.createdAt ? "Added " + fdate(new Date(m.createdAt)) : ""}</span>
                    </div>
                    <div className="ml-auto flex flex-wrap justify-end gap-1.5">
                      {self ? (
                        <span className="text-xs text-vt4">You</span>
                      ) : (
                        <>
                          {m.role === "staff" && (
                            <button
                              type="button"
                              onClick={() => setEdit(editing ? null : { id: m.id, perms: m.perms, err: "", busy: false })}
                              className="whitespace-nowrap rounded-full border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.08)] px-3 py-[7px] text-xs font-semibold text-vaccent hover:bg-[rgba(16,185,129,0.16)]"
                            >
                              Edit access
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={guard(() => onToggleRole(m))}
                            className="whitespace-nowrap rounded-full border border-vbd2 bg-vsoft px-3 py-[7px] text-xs font-semibold text-vt1 hover:border-[rgba(16,185,129,0.4)]"
                          >
                            {m.role === "admin" ? "Make staff" : "Make admin"}
                          </button>
                          <button
                            type="button"
                            onClick={guard(() => onToggleActive(m))}
                            className="whitespace-nowrap rounded-full border border-vbd2 bg-transparent px-3 py-[7px] text-xs font-semibold text-vt3 hover:border-[rgba(239,68,68,0.45)] hover:text-[#ef4444]"
                          >
                            {m.active ? "Disable" : "Enable"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 pl-[52px]">
                    {(m.role === "admin" ? ["All features"] : m.perms.length ? m.perms.map(permLabel) : ["No access"]).map((p) => (
                      <span key={p} className="whitespace-nowrap rounded-full border border-vbd bg-vtile px-2.5 py-1 text-[11px] font-semibold text-vt3">
                        {p}
                      </span>
                    ))}
                  </div>
                  {editing && m.role === "staff" && (
                    <div className="pt-4">
                      <div className="rounded-[18px] border border-vbd bg-vtile p-4">
                        <div className="mb-3 text-sm font-semibold">What {m.name} can use</div>
                        <PermissionPicker value={edit.perms} onChange={(p) => setEdit({ ...edit, perms: p, err: "" })} light={light} T={T} />
                        {edit.err && <div className="mt-3 text-[13px] font-semibold text-[#ef4444]">{edit.err}</div>}
                        <div className="mt-4 flex gap-2">
                          <button type="button" disabled={edit.busy} onClick={() => saveEdit(m)} className={cx.btnPrimary + " !px-4 !py-2 !text-xs"}>
                            {edit.busy ? "Saving…" : "Save access"}
                          </button>
                          <button type="button" onClick={() => setEdit(null)} className={cx.btnGhost + " !px-3.5 !py-2 !text-xs"}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className={cx.card + " p-[26px]"}>
            <div className="text-xl font-bold">Add a team member</div>
            <div className="mt-1.5 text-sm text-vt3">They sign in with this email and password.</div>
            <div className="mt-5 flex flex-col gap-3.5">
              <label className="flex flex-col gap-2">
                <span className={cx.label}>Full name</span>
                <input value={name} onChange={(e) => (setName(e.target.value), setMsg(""))} placeholder="e.g. Jordan Reyes" className={cx.input} />
              </label>
              <label className="flex flex-col gap-2">
                <span className={cx.label}>Work email</span>
                <input type="email" value={email} onChange={(e) => (setEmail(e.target.value), setMsg(""))} placeholder="name@company.com" className={cx.input} />
              </label>
              <label className="flex flex-col gap-2">
                <span className={cx.label}>Password</span>
                <input type="text" autoComplete="new-password" value={password} onChange={(e) => (setPassword(e.target.value), setMsg(""))} placeholder="At least 6 characters" className={cx.input} />
              </label>
              <div>
                <span className={cx.label}>Role</span>
                <div className="mt-2 grid grid-cols-2 gap-2.5">
                  {[
                    ["staff", "Staff", "Only the features you pick"],
                    ["admin", "Admin", "Full access"],
                  ].map(([k, l, sub]) => {
                    const s = pillStyle(role === k, light);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setRole(k)}
                        className="rounded-2xl border px-3.5 py-3 text-left"
                        style={{ background: s.background, borderColor: s.borderColor }}
                      >
                        <div className="text-sm font-bold" style={{ color: s.color }}>
                          {l}
                        </div>
                        <div className="mt-0.5 text-xs text-vt3">{sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {role === "staff" ? (
                <div>
                  <span className={cx.label}>Permissions · at least one</span>
                  <div className="mt-2">
                    <PermissionPicker value={perms} onChange={(p) => (setPerms(p), setMsg(""))} light={light} T={T} />
                  </div>
                </div>
              ) : (
                <div className="text-xs text-vt3">Admins can use every feature, including Team and Settings.</div>
              )}
              {msg && (
                <div
                  className="rounded-[14px] border px-3.5 py-[11px] text-[13px] text-vt1"
                  style={
                    msgErr
                      ? { background: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.35)" }
                      : { background: "rgba(16,185,129,0.10)", borderColor: "rgba(16,185,129,0.35)" }
                  }
                >
                  {msg}
                </div>
              )}
              <button type="button" onClick={add} disabled={busy} className={cx.btnPrimary}>
                {busy ? "Adding…" : "Add Member"}
              </button>
            </div>
          </div>

          <div className={cx.card + " p-[26px]"}>
            <div className="text-xl font-bold">Permissions</div>
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_64px_64px] gap-2.5 border-b border-vbd pb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-vt3">
              <span />
              <span className="text-center text-vaccent">Admin</span>
              <span className="text-center text-vcyan">Staff</span>
            </div>
            {/* Staff: null = picked per person; false = never. */}
            {[...PERMISSIONS.map(([, l]) => [l, null]), ["Team & settings", false]].map(([l, b]) => (
              <div key={l} className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2.5 border-b border-vbd py-3 text-sm">
                <span className="text-vt2">{l}</span>
                <span className="flex justify-center">
                  <Icon d={I.check} size={18} stroke={2} color={T.green[0]} />
                </span>
                <span className="flex justify-center">
                  {b === null ? <span className="text-center text-[11px] font-bold leading-tight text-vcyan">Per person</span> : <Icon d={I.x} size={18} stroke={2} color={off} />}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
