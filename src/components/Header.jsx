import { useEffect, useState } from "react";
import { I, Icon, Logo, tabStyle } from "./ui";
import { initials, pad2 } from "../lib/logic";
import { PERMISSIONS } from "../lib/config";

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="tnum flex items-center gap-[9px] whitespace-nowrap rounded-full border border-vbd bg-vcard px-4 py-2 text-[13px] text-vt2">
      <span className="h-[7px] w-[7px] animate-vpulse rounded-full bg-[#10b981] shadow-[0_0_10px_#10b981]" />
      Live · {pad2(now.getHours())}:{pad2(now.getMinutes())}:{pad2(now.getSeconds())}
    </div>
  );
}

export default function Header({ theme, onToggleTheme, user, isAdmin, can, current, onNavigate, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const light = theme === "light";
  // Admin-only pages that live in the profile menu instead of the tab bar.
  const menuLinks = isAdmin
    ? [
        ["team", "Team", I.users],
        ["settings", "Settings", I.gear],
      ]
    : [];
  // [screen, label, icon, permission needed]
  const tabs = [
    ["home", "Live Rooms", I.live, "live_rooms"],
    ["reports", "AI Reports", I.ai, "ai_reports"],
    ["harvests", "Harvests", I.cal, "harvests"],
    ["entry", "Data Entry", I.sheet, "data_entry"],
  ].filter((t) => can(t[3]));
  const access = PERMISSIONS.filter(([k]) => can(k)).map(([, label]) => label);

  return (
    <header className="sticky top-0 z-40 border-b border-vbd bg-vnav backdrop-blur-[40px]">
      {/* Same max width as the pages, so the bar lines up with the content on large screens. */}
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-6 px-10 py-[18px]">
      <div className="flex items-center gap-3">
        <Logo />
        <div>
          <div className="text-[17px] font-bold tracking-[-0.02em]">
            Vera <span className="grad-text">Yield Tracker</span>
          </div>
          <div className="text-[11px] font-semibold tracking-[0.02em] text-vt3">Every Room, Every Yield, One View.</div>
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-1 rounded-full border border-vbd bg-vcard p-1">
        {tabs.map(([k, label, icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onNavigate(k);
            }}
            style={tabStyle(current === k, light)}
            className="flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-[9px] text-sm font-semibold transition-all duration-200 hover:!text-vt1"
          >
            <Icon d={icon} />
            {label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex flex-wrap items-center gap-2.5">
        <Clock />
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2.5 whitespace-nowrap rounded-full border border-vbd bg-vcard py-[5px] pl-[5px] pr-3.5 text-vt1 hover:border-[rgba(16,185,129,0.35)]"
          >
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-gradient-to-br from-[#10b981] to-[#22d3ee] text-xs font-extrabold text-[#04140f]">
              {initials(user.name)}
            </span>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[13px] font-semibold">{user.name}</span>
              <span className="text-[11px] font-bold" style={{ color: isAdmin ? "var(--vaccent)" : "var(--vcyan)" }}>
                {isAdmin ? "Admin" : "Staff"}
              </span>
            </span>
            <Icon d={I.chevDown} size={14} className="text-vt3" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-[54px] z-[60] w-[270px] rounded-[20px] border border-vbd2 bg-vpop p-2 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)]">
              <div className="border-b border-vbd px-3 pb-3.5 pt-2.5">
                <div className="text-[15px] font-bold">{user.name}</div>
                <div className="mt-0.5 text-xs text-vt3">{user.email}</div>
                <div className="mt-2.5 text-xs leading-normal text-vt3">
                  {isAdmin
                    ? "Full access: live rooms, AI reports, harvest history, data entry, team and harvest cycle settings."
                    : access.length
                    ? "Your access: " + access.join(", ") + "."
                    : "No features turned on yet. Ask an admin for access."}
                </div>
              </div>
              {menuLinks.map(([k, label, icon]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigate(k);
                  }}
                  className="mt-1.5 flex w-full items-center gap-2.5 rounded-xl px-3 py-[11px] text-left text-sm font-semibold hover:bg-vsoft2"
                  style={{ color: current === k ? "var(--vaccent)" : "var(--vt1)" }}
                >
                  <Icon d={icon} />
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={onToggleTheme}
                className="mt-1.5 flex w-full items-center gap-2.5 rounded-xl px-3 py-[11px] text-left text-sm font-semibold text-vt1 hover:bg-vsoft2"
              >
                <Icon d={light ? I.moon : I.sun} />
                {light ? "Dark theme" : "Light theme"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onSignOut();
                }}
                className="mt-1.5 flex w-full items-center gap-2.5 rounded-xl border-t border-vbd px-3 py-[11px] text-left text-sm font-semibold text-vt1 hover:bg-vsoft2"
              >
                <Icon d={I.logout} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </header>
  );
}
