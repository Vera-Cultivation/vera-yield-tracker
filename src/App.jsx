import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/Header";
import { cx, EmptyState } from "./components/ui";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Room from "./pages/Room";
import Reports from "./pages/Reports";
import RoomReport from "./pages/RoomReport";
import Harvests from "./pages/Harvests";
import DataEntry from "./pages/DataEntry";
import Team from "./pages/Team";
import Settings from "./pages/Settings";
import * as api from "./lib/api";
import { buildCycles } from "./lib/logic";

// Each page has its own URL, so refresh, back/forward and bookmarks keep you where you were.
const PATHS = { home: "/", reports: "/reports", harvests: "/harvests", entry: "/data-entry", team: "/team", settings: "/settings", targets: "/settings/targets" };

/** "/rooms/room2" -> { screen: "room", room: "room2" }; unknown paths go to Live Rooms. */
function parseRoute(path) {
  const m = path.match(/^\/(rooms|reports)\/([^/]+)\/?$/);
  if (m) return { screen: m[1] === "rooms" ? "room" : "roomReport", room: decodeURIComponent(m[2]) };
  const p = path.replace(/\/+$/, "") || "/";
  const screen = Object.keys(PATHS).find((k) => PATHS[k] === p) || "home";
  return { screen, room: null };
}

function pathOf({ screen, room }) {
  if (screen === "room") return "/rooms/" + encodeURIComponent(room);
  if (screen === "roomReport") return "/reports/" + encodeURIComponent(room);
  return PATHS[screen] || "/";
}

const ADMIN_SCREENS = ["reports", "harvests", "team", "roomReport", "settings", "targets"];
const CYCLE_SCREENS = ["reports", "roomReport", "harvests", "entry"];

/** Claude is asked for JSON; fall back to treating the reply as the summary. */
function parseAi(raw) {
  try {
    const o = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);
    const recs = (Array.isArray(o.recs) ? o.recs : [])
      .filter((r) => Array.isArray(r) && r[0])
      .map(([t, p]) => [String(t), ["High", "Medium", "Low"].includes(p) ? p : "Low"])
      .slice(0, 5);
    return { headline: String(o.headline || ""), text: String(o.summary || ""), recs };
  } catch {
    return { headline: "", text: raw.trim(), recs: [] };
  }
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("vira3-theme") || "dark";
    } catch {
      return "dark";
    }
  });
  const [conn, setConn] = useState(api.isConfigured ? "checking" : "missing");
  const [connError, setConnError] = useState("");
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));
  const [rYear, setRYear] = useState(null);
  const [rCycle, setRCycle] = useState(-1);

  const [loaded, setLoaded] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [cycleRows, setCycleRows] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [team, setTeam] = useState([]);
  const [targets, setTargets] = useState([]);
  const [saved, setSaved] = useState([]);
  const [regen, setRegen] = useState({});
  const [loadError, setLoadError] = useState("");
  const regenRef = useRef(regen);
  regenRef.current = regen;

  const cycles = useMemo(() => buildCycles(cycleRows), [cycleRows]);
  // leachate_log stores who saved a row as a profile id; show their name.
  const savedRows = useMemo(
    () => saved.map((x) => ({ ...x, by: (team.find((m) => m.id === x.savedBy) || {}).name || "" })),
    [saved, team]
  );
  const openCycle = cycles.findIndex((c) => c.current);
  const defaultCycle = openCycle >= 0 ? openCycle : cycles.length - 1;

  /* theme */
  useEffect(() => {
    document.documentElement.dataset.vtheme = theme;
    try {
      localStorage.setItem("vira3-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  /* connection check */
  useEffect(() => {
    if (!api.isConfigured) return;
    api.checkConnection().then((err) => {
      setConnError(err || "");
      setConn(err ? "error" : "ok");
    });
  }, []);

  /* auth */
  useEffect(() => {
    if (conn !== "ok") return;
    return api.onAuthChange((u, err) => {
      setUser(u);
      if (err) setAuthError(err);
      setBooting(false);
    });
  }, [conn]);

  /* data */
  const loadAll = useCallback(async () => {
    // Each table loads on its own so one missing table doesn't blank the whole app.
    // Cycles go first: harvests, leachate and reports look up their cycle there.
    const failed = [];
    try {
      setCycleRows(await api.loadCycles());
    } catch (e) {
      failed.push("harvest_cycles (" + e.message + ")");
    }
    const jobs = [
      ["rooms", api.loadRooms, setRooms],
      ["harvest_reports", api.loadHarvests, setHarvests],
      ["profiles", api.loadTeam, setTeam],
      ["room_targets", api.loadTargets, setTargets],
      ["leachate_log", api.loadLeachate, setSaved],
      ["crop_reports", api.loadReports, setRegen],
    ];
    const results = await Promise.allSettled(jobs.map(([, load]) => load()));
    results.forEach((r, i) => {
      if (r.status === "fulfilled") jobs[i][2](r.value);
      else failed.push(jobs[i][0] + " (" + r.reason.message + ")");
    });
    setLoadError(failed.length ? "Couldn't load from Supabase: " + failed.join("; ") : "");
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadAll();
    return api.subscribeRooms(async () => setRooms(await api.loadRooms()));
  }, [user, loadAll]);

  // Point the cycle picker at the open cycle once cycles arrive.
  useEffect(() => {
    if (rCycle < 0 && defaultCycle >= 0) {
      setRCycle(defaultCycle);
      setRYear(cycles[defaultCycle].year);
    }
  }, [rCycle, defaultCycle, cycles]);

  const go = (screen, room = null) => {
    const next = { screen, room };
    if (pathOf(next) !== window.location.pathname) window.history.pushState(null, "", pathOf(next));
    setRoute(next);
    window.scrollTo(0, 0);
  };

  // Browser back / forward.
  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const signIn = async (email, pw) => {
    setAuthError("");
    const { user: u, error } = await api.signIn(email, pw);
    if (error) return error;
    setUser(u); // stay on the page that was asked for
    return null;
  };

  const signOut = async () => {
    await api.signOut();
    setUser(null);
    setLoaded(false);
    go("home");
  };

  /* AI regenerate */
  const regenerate = async (room, cy, R, days) => {
    const key = room.id + "|" + cy.key;
    if ((regenRef.current[key] || {}).loading) return;
    setRegen((g) => ({ ...g, [key]: { ...(g[key] || {}), loading: true, error: "" } }));
    const withData = days.filter((d) => d.temp != null || d.lph != null);
    const prompt =
      "Write the crop report for this room and harvest cycle using only the data below. " +
      'Reply with JSON only, no markdown: {"headline": one sentence, "summary": 2-3 plain sentences on revenue, yield, ' +
      'growth pace and climate, "recs": up to 3 items as [action, "High"|"Medium"|"Low"]}. ' +
      "If a figure is missing, say so rather than guessing.\n\nDATA: " +
      JSON.stringify({
        room: room.name,
        stage: room.stage,
        cultivar: room.cultivar,
        cycle: cy.name,
        cycleStatus: cy.current ? "in progress" : "closed",
        days: cy.days,
        kpis: R.kpis,
        current: cy.current ? { environment: room.env, rootZone: room.rz } : undefined,
        harvest: R.harvest,
        daily: withData.map(({ date, temp, rh, co2, vwc, ec, lph, lec, note }) => ({ date, temp, rh, co2, vwc, ec, leachPh: lph, leachEc: lec, note })),
      });
    try {
      const report = parseAi(await api.askClaude(prompt));
      if (!report.text) throw new Error("Claude returned an empty report.");
      const { generatedAt } = await api.saveReport(room.id, cy, report);
      setRegen((g) => ({ ...g, [key]: { ...report, loading: false, generatedAt } }));
    } catch (e) {
      setRegen((g) => ({ ...g, [key]: { ...(g[key] || {}), loading: false, error: e.message } }));
    }
  };

  /* data entry */
  const saveLeachate = async (rows, cy) => {
    const added = await api.insertLeachate(rows, cy, user);
    setSaved((s) => [...added, ...s]);
  };
  const updateLeachate = async (id, row) => {
    const next = await api.updateLeachate(id, row);
    setSaved((s) => s.map((x) => (x.id === id ? next : x)));
  };

  /* harvest cycles (Settings) — reload everything, since harvests, leachate and reports map onto cycles */
  const createCycle = async (c) => {
    await api.createCycle(c);
    await loadAll();
  };
  const updateCycle = async (cycle, changes) => {
    await api.updateCycle(cycle, changes);
    await loadAll();
  };

  /* room targets (Settings) — reload so rooms pick up the new ranges */
  const saveTargets = async (rows) => {
    await api.saveTargets(rows, user);
    await loadAll();
  };

  /* team */
  const addMember = async (m) => {
    const member = await api.addMember(m, user);
    setTeam((t) => [...t, member]);
  };
  const toggleRole = async (m) => {
    const role = m.role === "admin" ? "staff" : "admin";
    await api.setMemberRole(m.id, role);
    setTeam((t) => t.map((x) => (x.id === m.id ? { ...x, role } : x)));
  };
  const toggleActive = async (m) => {
    await api.setMemberActive(m.id, !m.active);
    setTeam((t) => t.map((x) => (x.id === m.id ? { ...x, active: !m.active } : x)));
  };

  const shell = (children) => (
    <div className="relative min-h-screen bg-vb text-vt1">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(#10b981_0.8px,transparent_0)] bg-[length:64px_64px]"
        style={{ opacity: "var(--vgrid)" }}
      />
      {children}
    </div>
  );
  const centered = (children) => shell(<div className="relative mx-auto flex min-h-screen max-w-[720px] items-center px-6">{children}</div>);

  if (conn === "missing")
    return centered(
      <EmptyState title="Supabase isn't configured" className="w-full">
        Copy <span className="font-mono text-vt1">.env.example</span> to <span className="font-mono text-vt1">.env.local</span>, fill in{" "}
        <span className="font-mono text-vt1">VITE_SUPABASE_URL</span> and <span className="font-mono text-vt1">VITE_SUPABASE_ANON_KEY</span>, then restart{" "}
        <span className="font-mono text-vt1">npm run dev</span>.
      </EmptyState>
    );
  if (conn === "error")
    return centered(
      <EmptyState title="Can't connect to Supabase" className="w-full">
        {connError}
        <br />
        Check the URL and anon key in <span className="font-mono text-vt1">.env.local</span>, then restart <span className="font-mono text-vt1">npm run dev</span>.
      </EmptyState>
    );
  if (conn === "checking" || booting) return shell(<div className="relative flex min-h-screen items-center justify-center text-sm text-vt3">Connecting to Supabase…</div>);
  if (!user) return shell(<Login theme={theme} onToggleTheme={toggleTheme} onSignIn={signIn} authError={authError} />);

  const isAdmin = user.role === "admin";
  const scr = !isAdmin && ADMIN_SCREENS.includes(route.screen) ? "home" : route.screen;
  const navCurrent = { room: "home", roomReport: "reports", targets: "settings" }[scr] || scr;
  // Room from the URL key; an unknown key falls back to the first room.
  const ri = Math.max(0, rooms.findIndex((r) => r.key === route.room));
  const pickerProps = { cycles, year: rYear, cycle: rCycle, onYear: setRYear, onCycle: setRCycle };

  let body;
  if (!loaded) body = <div className="relative flex min-h-[50vh] items-center justify-center text-sm text-vt3">Loading data…</div>;
  else if (scr === "team") body = <Team theme={theme} user={user} team={team} onAdd={addMember} onToggleRole={toggleRole} onToggleActive={toggleActive} />;
  else if (!rooms.length)
    body = (
      <main className="relative mx-auto max-w-[1720px] px-10 pt-11">
        <EmptyState title="No rooms in Supabase yet">
          Rooms come from the <span className="font-mono text-vt1">rooms</span> table, with current readings from the SkySpark and Aroya sync. If rooms exist but don't show, check that signed-in users can read them (see <span className="font-mono text-vt1">supabase/policies.sql</span>).
        </EmptyState>
      </main>
    );
  else if (scr === "settings" || scr === "targets")
    body = (
      <Settings
        tab={scr === "targets" ? "targets" : "cycles"}
        onTab={(t) => go(t === "targets" ? "targets" : "settings")}
        rooms={rooms}
        cycles={cycles}
        targets={targets}
        theme={theme}
        onCreate={createCycle}
        onUpdate={updateCycle}
        onSaveTargets={saveTargets}
      />
    );
  else if (CYCLE_SCREENS.includes(scr) && (!cycles.length || rCycle < 0))
    body = (
      <main className="relative mx-auto max-w-[1720px] px-10 pt-11">
        <EmptyState title="No harvest cycles yet">
          {isAdmin ? "Create the cycle that's running now, with its start date and estimated end. Data dated inside it shows up here." : "An admin needs to create the harvest cycle that's running now before data can be added."}
          {isAdmin && (
            <div className="mt-5">
              <button type="button" className={cx.btnPrimary} onClick={() => go("settings")}>
                Open Settings
              </button>
            </div>
          )}
        </EmptyState>
      </main>
    );
  else if (scr === "home")
    body = (
      <Home
        rooms={rooms}
        theme={theme}
        onOpenRoom={(i) => go("room", rooms[i].key)}
      />
    );
  else if (scr === "room")
    body = (
      <Room
        room={rooms[ri]}
        theme={theme}
        isAdmin={isAdmin}
        saved={savedRows}
        harvests={harvests}
        cycles={cycles}
        onBack={() => go("home")}
        onOpenReport={() => {
          if (defaultCycle >= 0) {
            setRCycle(defaultCycle);
            setRYear(cycles[defaultCycle].year);
          }
          go("roomReport", rooms[ri].key);
        }}
      />
    );
  else if (scr === "reports")
    body = (
      <Reports
        rooms={rooms}
        theme={theme}
        {...pickerProps}
        harvests={harvests}
        saved={savedRows}
        regen={regen}
        onRegenerate={regenerate}
        onOpen={(i) => go("roomReport", rooms[i].key)}
      />
    );
  else if (scr === "roomReport")
    body = (
      <RoomReport
        rooms={rooms}
        ri={ri}
        theme={theme}
        {...pickerProps}
        harvests={harvests}
        saved={savedRows}
        regen={regen}
        onRegenerate={regenerate}
        onBack={() => go("room", rooms[ri].key)}
      />
    );
  else if (scr === "harvests") body = <Harvests rooms={rooms} theme={theme} cycles={cycles} defaultCycle={defaultCycle} harvests={harvests} saved={savedRows} />;
  else if (scr === "entry") body = <DataEntry rooms={rooms} theme={theme} cycles={cycles} openCycle={openCycle} saved={savedRows} onSave={saveLeachate} onUpdate={updateLeachate} />;

  return shell(
    <>
      <Header theme={theme} onToggleTheme={toggleTheme} user={user} isAdmin={isAdmin} current={navCurrent} onNavigate={go} onSignOut={signOut} />
      {loadError && (
        <div className="relative mx-auto mt-6 max-w-[1720px] px-10">
          <div className="rounded-[14px] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.10)] px-4 py-3 text-sm">{loadError}</div>
        </div>
      )}
      {body}
    </>
  );
}
