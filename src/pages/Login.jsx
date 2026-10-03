import { useState } from "react";
import { cx, Logo } from "../components/ui";
import { ThemeToggle } from "../components/Header";

export default function Login({ theme, onToggleTheme, onSignIn, authError }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const shownErr = err || authError;

  const submit = async () => {
    const em = email.trim().toLowerCase();
    if (!em) return setErr("Enter your email.");
    if (!pw) return setErr("Enter your password.");
    setBusy(true);
    const e = await onSignIn(em, pw);
    setBusy(false);
    if (e) setErr(e);
  };

  return (
    <div className="relative grid min-h-screen grid-cols-[repeat(auto-fit,minmax(min(100%,520px),1fr))]">
      {/* Brand panel */}
      <div className="relative flex min-h-[640px] flex-col justify-between gap-14 overflow-hidden border-r border-vbd bg-[linear-gradient(160deg,rgba(16,185,129,0.10)_0%,transparent_60%)] px-14 py-12">
        <div className="absolute left-1/2 top-[-10%] h-[120%] w-1 -translate-x-1/2 bg-[linear-gradient(180deg,transparent,#10b981_25%,#22d3ee_70%,transparent)] opacity-55 blur-[8px] shadow-[0_0_60px_#10b981,0_0_120px_rgba(34,211,238,0.5)]" />
        {[
          [340, 0.18, "0s"],
          [560, 0.13, "1s"],
          [800, 0.08, "2s"],
        ].map(([s, o, delay]) => (
          <div
            key={s}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-vpulse3 rounded-full border"
            style={{ width: s, height: s, borderColor: `rgba(16,185,129,${o})`, animationDelay: delay }}
          />
        ))}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,var(--vb)_82%)]" />

        <div className="relative flex items-center gap-3">
          <Logo />
          <div className="text-lg font-bold tracking-[-0.02em]">
            Vera <span className="grad-text">Yield Tracker</span>
          </div>
        </div>

        <div className="relative max-w-[520px]">
          <div className={cx.eyebrow}>Cultivation Intelligence</div>
          <div className="mt-[18px] text-[54px] font-bold leading-[1.04] tracking-[-0.03em]">
            Every Room, <span className="grad-text">One Calm View.</span>
          </div>
          <div className="mt-[18px] text-lg leading-relaxed text-vt2">
            Climate from SkySpark, root zone from Aroya and the grow team's leachate log — together in one place for the people who run the rooms.
          </div>
          <div className="mt-[26px] flex flex-wrap gap-2.5">
            <span className="whitespace-nowrap rounded-full border border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.08)] px-3.5 py-2 text-[13px] font-semibold text-vaccent">SkySpark</span>
            <span className="whitespace-nowrap rounded-full border border-[rgba(34,211,238,0.3)] bg-[rgba(34,211,238,0.08)] px-3.5 py-2 text-[13px] font-semibold text-vcyan">Aroya</span>
            <span className="whitespace-nowrap rounded-full border border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.08)] px-3.5 py-2 text-[13px] font-semibold text-vamber">Google Sheets</span>
          </div>
        </div>
        <div className="relative text-[13px] text-vt4">Every room streaming · one Supabase store</div>
      </div>

      {/* Sign-in form */}
      <div className="relative flex flex-col justify-center gap-5 px-10 pb-12 pt-7">
        <div className="self-end">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} compact />
        </div>
        <div className="w-full max-w-[440px] self-center rounded-[28px] border border-vbd bg-vcard p-9 shadow-v backdrop-blur-xl">
          <div className="text-[30px] font-bold tracking-[-0.02em]">Sign in</div>
          <div className="mt-2 text-[15px] text-vt3">Enter your email and password to continue.</div>

          <div className="mt-[22px] flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className={cx.label}>Email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErr("");
                }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="name@company.com"
                className={cx.input}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className={cx.label}>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={pw}
                onChange={(e) => {
                  setPw(e.target.value);
                  setErr("");
                }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Enter password"
                className={cx.input}
              />
            </label>
            {shownErr && (
              <div className="rounded-[14px] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.10)] px-3.5 py-[11px] text-[13px] text-vt1">{shownErr}</div>
            )}
            <button type="button" onClick={submit} disabled={busy} className={cx.btnPrimary + " mt-1 w-full py-[15px] text-[15px]"}>
              {busy ? "Signing in…" : "Sign In"}
            </button>
            <div className="text-center text-xs leading-normal text-vt4">Accounts are created by an admin. Ask them if you need access or a new password.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
