// Data layer. Everything is read from and written to Supabase.
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_TARGETS } from "./config";
import { captureDay, mean, num } from "./logic";
import { supabase, isConfigured } from "./supabase";

export { isConfigured };

/* ------------------------------------------------------------------ mappers */
// harvest_cycles has one row per room per cycle. The app groups rows with the same year and name
// into one cycle ("2026 · Cycle 3"); `key` is that group, `ids` maps room id -> harvest_cycles.id.
const cycleKeyOf = (c) => c.harvest_year + "|" + c.name;
let cycleKeyById = {};

// "12.4 kg" / "850 g" / "3 lb" / "850" -> grams. harvest_reports stores weights as text.
function grams(v) {
  const n = num(v);
  if (n == null) return null;
  const t = String(v).toLowerCase();
  return t.includes("kg") ? n * 1000 : t.includes("lb") ? n * 453.592 : n;
}

const fromHarvest = (h) => ({
  roomId: h.room_id,
  cycleKey: cycleKeyById[h.cycle_id] || "",
  date: h.harvested_on,
  plants: h.plants,
  wetG: grams(h.wet_weight),
  dryG: grams(h.dry_weight),
  notes: h.note || "",
});
const fromMember = (m) => ({
  id: m.id,
  name: m.full_name,
  email: m.email,
  role: m.role,
  active: m.is_active,
  createdAt: m.created_at,
});
const str = (v) => (v == null ? "" : String(v));
const fromLeach = (x) => ({
  id: x.id,
  cycleKey: cycleKeyById[x.cycle_id] || "",
  roomId: x.room_id,
  date: x.capture_date,
  stage: x.stage || "",
  dur: x.duration || "",
  strain: x.strain || "",
  ph: str(x.ph),
  ec: str(x.ec),
  vol: str(x.volume_ml),
  p1: str(x.pct_p1),
  notes: x.notes || "",
  savedBy: x.saved_by,
  createdAt: x.saved_at,
});
const toLeach = (r, cycleId, user) => ({
  cycle_id: cycleId,
  room_id: r.roomId,
  capture_date: captureDay(r.date),
  stage: r.stage || null,
  duration: r.dur || null,
  strain: r.strain,
  ph: num(r.ph),
  ec: num(r.ec),
  volume_ml: num(r.vol) == null ? null : Math.round(num(r.vol)),
  pct_p1: num(r.p1),
  notes: r.notes || null,
  saved_by: user.id,
});

const fail = (error) => {
  if (error) throw new Error(error.message);
};

/* --------------------------------------------------------------------- auth */
// Logins live in Supabase Auth; the `profiles` table says who is on the team, their role and
// whether they're active. A login without an active profile is signed straight back out.

async function loadProfile(uid) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "This login isn't on the team. Ask an admin to add you." };
  if (!data.is_active) return { error: "This account is disabled. Ask an admin to turn it back on." };
  return { user: fromMember(data) };
}

/** Reports the saved session once at start-up. cb(user | null, error?) */
export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event !== "INITIAL_SESSION" && event !== "SIGNED_OUT") return;
    // Supabase asks that other calls not run inside this callback, so load the profile right after it.
    setTimeout(async () => {
      if (!session) return cb(null);
      const { user, error } = await loadProfile(session.user.id);
      if (error) await supabase.auth.signOut();
      cb(user || null, error);
    }, 0);
  });
  return () => data.subscription.unsubscribe();
}

/** Returns { user } on success, { error } otherwise. */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: /invalid login/i.test(error.message) ? "Incorrect email or password." : error.message };
  const res = await loadProfile(data.user.id);
  if (res.error) await supabase.auth.signOut();
  return res;
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** Quick round trip used at start-up to confirm the project is reachable. */
export async function checkConnection() {
  const { error } = await supabase.auth.getSession();
  if (error) return error.message;
  try {
    const res = await fetch(import.meta.env.VITE_SUPABASE_URL + "/auth/v1/health", {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    });
    return res.ok ? null : "Supabase answered " + res.status + " " + res.statusText;
  } catch (e) {
    return "Can't reach Supabase: " + e.message;
  }
}

/* -------------------------------------------------------------------- rooms */
// Current values come from environment_current (temp, rh, co2) and rootzone_current (vwc, ec, rzt),
// one row per room per metric. Targets: room_targets for the room's running cycle (set by admins
// in Settings) first, then any targets the sync wrote, then DEFAULT_TARGETS.
//   env.temp = [current, setpoint, targetLow, targetHigh, driftMargin]
//   rz.vwc   = [current, targetLow, targetHigh, driftMargin]
function reading(rows, targets, k) {
  const r = rows.find((x) => x.metric === k) || {};
  const t = targets.find((x) => x.metric === k) || {};
  const [sp, lo, hi, m] = DEFAULT_TARGETS[k];
  return [
    r.value ?? null,
    t.setpoint ?? r.setpoint ?? sp,
    t.target_low ?? r.target_low ?? lo,
    t.target_high ?? r.target_high ?? hi,
    t.drift_margin ?? r.drift_margin ?? m,
  ];
}

export async function loadRooms() {
  const [rooms, env, rz, tg, running] = await Promise.all([
    supabase.from("rooms").select("*").order("sort_order"),
    supabase.from("environment_current").select("*"),
    supabase.from("rootzone_current").select("*"),
    supabase.from("room_targets").select("*"),
    supabase.from("harvest_cycles").select("id, room_id").eq("status", "current"),
  ]);
  fail(rooms.error || env.error || rz.error);
  const targets = tg.error ? [] : tg.data; // before room-targets.sql is run, defaults apply
  const runningCycle = Object.fromEntries((running.data || []).map((c) => [c.room_id, c.id]));
  return rooms.data.map((r) => {
    const e = env.data.filter((x) => x.room_id === r.id);
    const z = rz.data.filter((x) => x.room_id === r.id);
    const t = targets.filter((x) => x.cycle_id === runningCycle[r.id]);
    const rzOf = (k) => {
      const [v, , lo, hi, m] = reading(z, t, k);
      return [v, lo, hi, m];
    };
    const stamps = [...e, ...z].map((x) => x.measured_at).sort();
    return {
      id: r.id,
      key: r.key || r.id, // used in page URLs: /rooms/room2
      name: r.name,
      stage: r.stage || "",
      cultivar: r.cultivar || "",
      env: { temp: reading(e, t, "temp"), rh: reading(e, t, "rh"), co2: reading(e, t, "co2") },
      rz: { vwc: rzOf("vwc"), ec: rzOf("ec"), rzt: rzOf("rzt") },
      plants: 0,
      veg: false,
      updatedAt: stamps[stamps.length - 1] || r.updated_at,
    };
  });
}

/* ------------------------------------------------------------ room_targets */
// cycleId is a harvest_cycles row, i.e. one room in one cycle.
/** Admin-set targets: [{ cycleId, metric, setpoint, low, high, drift }] (numbers or null). */
export async function loadTargets() {
  const { data, error } = await supabase.from("room_targets").select("*");
  fail(error);
  return data.map((t) => ({ cycleId: t.cycle_id, metric: t.metric, setpoint: t.setpoint, low: t.target_low, high: t.target_high, drift: t.drift_margin }));
}

/** Saves every cycle + metric in `rows`; nulls mean "use the default". */
export async function saveTargets(rows, me) {
  const { error } = await supabase.from("room_targets").upsert(
    rows.map((t) => ({
      cycle_id: t.cycleId,
      metric: t.metric,
      setpoint: t.setpoint,
      target_low: t.low,
      target_high: t.high,
      drift_margin: t.drift,
      updated_by: me.id,
      updated_at: new Date().toISOString(),
    }))
  );
  fail(error);
}

/** Live updates when the SkySpark / Aroya sync writes new current values. */
export function subscribeRooms(onChange) {
  const ch = supabase
    .channel("rooms-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "environment_current" }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "rootzone_current" }, () => onChange())
    .subscribe();
  return () => supabase.removeChannel(ch);
}

/* ------------------------------------------------------- cycles + harvests */
/** Load before harvests, leachate and reports: they look up their cycle here.
 *  While a cycle is running, end_date holds its estimated end; closing it sets the actual end. */
export async function loadCycles() {
  const { data, error } = await supabase.from("harvest_cycles").select("*").order("start_date");
  fail(error);
  cycleKeyById = Object.fromEntries(data.map((c) => [c.id, cycleKeyOf(c)]));
  const groups = new Map();
  for (const c of data) {
    const key = cycleKeyOf(c);
    const g = groups.get(key) || { key, year: c.harvest_year, label: c.name, ids: {}, rows: [] };
    g.ids[c.room_id] = c.id;
    g.rows.push({ id: c.id, roomId: c.room_id, strain: c.strain || "", startDate: c.start_date, endDate: c.end_date, status: c.status });
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter((g) => g.rows.some((r) => r.startDate))
    .map((g) => {
      const starts = g.rows.map((r) => r.startDate).filter(Boolean).sort();
      const ends = g.rows.map((r) => r.endDate).filter(Boolean).sort();
      const open = g.rows.some((r) => r.status === "current");
      return { ...g, open, startDate: starts[0], endDate: ends.at(-1) || null };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/* ------------------------------------------------- cycle settings (admin) */
const todayIso = () => new Date().toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

// Stamp daily_records inside a room's cycle with cycle_id + day_number, and clear stamps
// left outside it after a date change. Running cycles cover start -> today.
async function stampDaily(row) {
  const end = row.status === "current" ? todayIso() : row.endDate;
  const { error: clearError } = await supabase
    .from("daily_records")
    .update({ cycle_id: null, day_number: null })
    .eq("cycle_id", row.id)
    .or(`record_date.lt.${row.startDate},record_date.gt.${end}`);
  fail(clearError);
  const { data, error } = await supabase
    .from("daily_records")
    .select("id, room_id, record_date")
    .eq("room_id", row.roomId)
    .gte("record_date", row.startDate)
    .lte("record_date", end);
  fail(error);
  if (!data.length) return;
  const { error: stampError } = await supabase
    .from("daily_records")
    .upsert(data.map((d) => ({ ...d, cycle_id: row.id, day_number: dayDiff(row.startDate, d.record_date) + 1 })));
  fail(stampError);
}

/** rooms: [{ roomId, strain }] */
export async function createCycle({ name, year, startDate, endDate, rooms }) {
  const { data, error } = await supabase
    .from("harvest_cycles")
    .insert(
      rooms.map((r) => ({
        room_id: r.roomId,
        name,
        harvest_year: year,
        strain: r.strain || null,
        start_date: startDate,
        end_date: endDate,
        status: "current",
      }))
    )
    .select();
  fail(error);
  for (const c of data) await stampDaily({ id: c.id, roomId: c.room_id, startDate: c.start_date, endDate: c.end_date, status: c.status });
  await copyPreviousTargets(data);
}

// Each room in a new cycle starts with the targets of that room's previous cycle.
async function copyPreviousTargets(newRows) {
  const { data: all, error } = await supabase
    .from("harvest_cycles")
    .select("id, room_id, start_date")
    .in("room_id", newRows.map((c) => c.room_id));
  fail(error);
  const prevOf = {}; // new cycle id -> previous cycle id
  for (const c of newRows) {
    const prev = all
      .filter((x) => x.room_id === c.room_id && x.id !== c.id && x.start_date < c.start_date)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .at(-1);
    if (prev) prevOf[c.id] = prev.id;
  }
  const prevIds = Object.values(prevOf);
  if (!prevIds.length) return;
  const { data: old, error: oldError } = await supabase.from("room_targets").select("*").in("cycle_id", prevIds);
  fail(oldError);
  const copies = Object.entries(prevOf).flatMap(([newId, prevId]) =>
    old.filter((t) => t.cycle_id === prevId).map(({ cycle_id, updated_at, ...t }) => ({ ...t, cycle_id: newId }))
  );
  if (!copies.length) return;
  const { error: copyError } = await supabase.from("room_targets").insert(copies);
  fail(copyError);
}

/** Changes name, dates or (with status "complete") closes every room row of a cycle. */
export async function updateCycle(cycle, { name, startDate, endDate, status }) {
  const { data, error } = await supabase
    .from("harvest_cycles")
    .update({ name, start_date: startDate, end_date: endDate, ...(status && { status }) })
    .in("id", cycle.rows.map((r) => r.id))
    .select();
  fail(error);
  for (const c of data) await stampDaily({ id: c.id, roomId: c.room_id, startDate: c.start_date, endDate: c.end_date, status: c.status });
}

export async function loadHarvests() {
  const { data, error } = await supabase.from("harvest_reports").select("*").order("harvested_on");
  fail(error);
  return data.map(fromHarvest);
}

/* ----------------------------------------------------------------- readings */
const PAGE = 1000; // Supabase returns at most 1000 rows per request

async function allRows(query) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query().range(from, from + PAGE - 1);
    fail(error);
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

/** Readings for one room over the last `hours`, averaged into `bucketMin` buckets: [{ ts, temp, rh, co2, vwc, ec, rzt }] */
export async function loadRoomSeries(roomId, hours = 72, bucketMin = 15, untilMs = null) {
  const end = untilMs ?? Date.now();
  const since = new Date(end - hours * 3600000).toISOString();
  const read = (table) => () => {
    let q = supabase.from(table).select("metric, value, measured_at").eq("room_id", roomId).gte("measured_at", since);
    if (untilMs != null) q = q.lte("measured_at", new Date(untilMs).toISOString());
    return q.order("measured_at");
  };
  const rows = (await Promise.all([allRows(read("environment_readings")), allRows(read("rootzone_readings"))])).flat();

  const size = bucketMin * 60000;
  const buckets = new Map();
  for (const r of rows) {
    const t = Math.floor(new Date(r.measured_at).getTime() / size) * size;
    const b = buckets.get(t) || {};
    (b[r.metric] ||= []).push(Number(r.value));
    buckets.set(t, b);
  }
  return [...buckets.keys()]
    .sort((a, b) => a - b)
    .map((t) => {
      const b = buckets.get(t);
      const point = { ts: new Date(t).toISOString() };
      for (const k of ["temp", "rh", "co2", "vwc", "ec", "rzt"]) point[k] = mean(b[k] || []);
      return point;
    });
}

/** Daily averages from daily_records between two YYYY-MM-DD dates; roomId = null for every room. */
export async function loadDailyStats(from, to, roomId = null) {
  let q = supabase.from("daily_records").select("*").gte("record_date", from).lte("record_date", to).order("record_date");
  if (roomId) q = q.eq("room_id", roomId);
  const { data, error } = await q;
  fail(error);
  return data.map((d) => ({ room_id: d.room_id, day: d.record_date, temp: d.temp, rh: d.rh, co2: d.co2, vwc: d.vwc, ec: d.ec, rzt: null }));
}

/* --------------------------------------------------------------------- team */
export async function loadTeam() {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at");
  fail(error);
  return data.map(fromMember);
}

// A second client that doesn't save its session, so creating someone's login
// doesn't sign the admin out of their own.
let signupClient;

/** Admin adds a person: creates their login (email + password), then their profile row. */
export async function addMember({ name, email, password, role }, me) {
  signupClient ||= createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: "vira-signup" },
  });
  const { data: signup, error: signupError } = await signupClient.auth.signUp({ email, password });
  fail(signupError);
  // Supabase returns a user with no identities when the email already has a login.
  if (!signup.user || !signup.user.identities?.length) throw new Error(email + " already has a login.");
  const { data, error } = await supabase
    .from("profiles")
    .insert({ id: signup.user.id, full_name: name, email, role, created_by: me.id })
    .select()
    .single();
  fail(error);
  return fromMember(data);
}

export async function setMemberRole(id, role) {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  fail(error);
}

export async function setMemberActive(id, isActive) {
  const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", id);
  fail(error);
}

/* ------------------------------------------------------------- leachate_log */
export async function loadLeachate() {
  const { data, error } = await supabase.from("leachate_log").select("*").order("saved_at", { ascending: false }).limit(1000);
  fail(error);
  return data.map(fromLeach);
}

/** rows: [{ roomId, date, stage, dur, strain, ph, ec, vol, p1, notes }] for cycle `cy`. */
export async function insertLeachate(rows, cy, user) {
  if (rows.some((r) => !cy.ids[r.roomId])) throw new Error("This room has no row in harvest_cycles for " + cy.name + ".");
  const { data, error } = await supabase
    .from("leachate_log")
    .insert(rows.map((r) => toLeach(r, cy.ids[r.roomId], user)))
    .select();
  fail(error);
  return data.map(fromLeach);
}

/* ------------------------------------------------------------- crop_reports */
/** Latest Claude report per room + cycle: { "<roomId>|<cycleKey>": { headline, text, recs, generatedAt } } */
export async function loadReports() {
  const { data, error } = await supabase.from("crop_reports").select("*").order("created_at");
  fail(error);
  // Oldest first, so the newest report for each room + cycle wins.
  return Object.fromEntries(
    data.map((r) => [
      r.room_id + "|" + (cycleKeyById[r.cycle_id] || r.cycle),
      { headline: r.headline || "", text: r.summary || "", recs: r.recommendations || [], generatedAt: r.created_at },
    ])
  );
}

/** Saves a new report row; the page shows the newest one. */
export async function saveReport(roomId, cy, { headline, text, recs }) {
  const { data, error } = await supabase
    .from("crop_reports")
    .insert({
      room_id: roomId,
      cycle_id: cy.ids[roomId] || null,
      cycle: cy.name,
      generated_on: new Date().toISOString().slice(0, 10),
      headline,
      summary: text,
      recommendations: recs,
      prior_cycles: [],
    })
    .select("created_at")
    .single();
  fail(error);
  return { generatedAt: data.created_at };
}

/** Asks Claude via the `ai` edge function. Throws with a readable message on failure. */
export async function askClaude(prompt) {
  const { data, error } = await supabase.functions.invoke("ai", { body: { prompt } });
  if (error) {
    let msg = error.message;
    try {
      msg = (await error.context.json()).error || msg;
    } catch {
      /* keep the generic message */
    }
    throw new Error(msg);
  }
  return (data && data.text) || "";
}
