import { useState } from "react";
import { AdminBadge, cx, I, Icon, pillStyle } from "../components/ui";
import { fdate, initials, tones } from "../lib/logic";

const PERMS = [
  ["Live rooms & room detail", true, true],
  ["AI crop reports per room", true, false],
  ["Harvest cycle history", true, false],
  ["Data entry · leachate capture", true, true],
  ["Manage team members", true, false],
];

export default function Team({ theme, user, team, onAdd, onToggleRole, onToggleActive }) {
  const light = theme === "light";
  const T = tones(theme);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("staff");
  const [msg, setMsg] = useState("");
  const [msgErr, setMsgErr] = useState(false);
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
      await onAdd({ name: n, email: em, password, role });
      setName("");
      setEmail("");
      setPassword("");
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
            Admins see everything. Staff see the live rooms and Data Entry — current readings and leachate capture, no AI reports, harvest history or team.
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
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              {team.map((m) => {
                const self = m.id === user.id;
                return (
                  <div key={m.id} className="grid grid-cols-[minmax(0,1.8fr)_100px_100px_110px_210px] items-center gap-3.5 border-b border-vbd px-6 py-3.5 hover:bg-vsoft">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-vbd bg-vsoft2 text-[13px] font-extrabold text-vt2">
                        {initials(m.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold">{m.name}</div>
                        <div className="mt-0.5 overflow-hidden text-ellipsis text-xs text-vt3">{m.email}</div>
                      </div>
                    </div>
                    <span className="justify-self-start rounded-full border px-[11px] py-[5px] text-xs font-bold" style={roleSty(m.role)}>
                      {m.role === "admin" ? "Admin" : "Staff"}
                    </span>
                    <span className="flex items-center gap-[7px] text-[13px] text-vt2">
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: m.active ? T.green[0] : off }} />
                      {m.active ? "Active" : "Disabled"}
                    </span>
                    <span className="text-[13px] text-vt3">{m.createdAt ? "Added " + fdate(new Date(m.createdAt)) : ""}</span>
                    <div className="flex justify-end gap-1.5">
                      {self ? (
                        <span className="text-xs text-vt4">You</span>
                      ) : (
                        <>
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
                    ["staff", "Staff", "Live rooms + data entry"],
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
            {PERMS.map(([l, a, b]) => (
              <div key={l} className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2.5 border-b border-vbd py-3 text-sm">
                <span className="text-vt2">{l}</span>
                <span className="flex justify-center">
                  <Icon d={a ? I.check : I.x} size={18} stroke={2} color={a ? T.green[0] : off} />
                </span>
                <span className="flex justify-center">
                  <Icon d={b ? I.check : I.x} size={18} stroke={2} color={b ? T.green[0] : off} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
