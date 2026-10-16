# Vera Yield Tracker — React + Tailwind + Supabase

Every Room, Every Yield, One View. A React (JavaScript) + Tailwind CSS app backed by Supabase.

Screens: Login, Live Rooms, Room detail, AI Reports, per-room AI Report (print to PDF), Harvests and Data Entry, plus Team and Settings (harvest cycles, room targets) in the admin's profile menu. Light/dark toggle.

## What lives where

All data comes from the existing Supabase project. There is no seed or dummy data in the app.

| Data | Table | Notes |
|---|---|---|
| Rooms | `rooms` | |
| Current readings | `environment_current` (temp, rh, co2), `rootzone_current` (vwc, ec, rzt) | One row per room per metric, written by the SkySpark/Aroya sync. Targets come from `room_targets` for the room's running cycle (admins set them per room per cycle in **Settings → Targets**; a new cycle copies the previous one), then the sync's own target columns, then `DEFAULT_TARGETS` in `src/lib/config.js` |
| Chart history | `environment_readings`, `rootzone_readings` | Last 72h, averaged into 15-minute points in the browser |
| Daily history | `daily_records` | |
| Harvest cycles | `harvest_cycles` | Managed by admins on the **Settings** page. One row per room; rows with the same `harvest_year` + `name` show as one cycle. Names are Vera's cycle IDs as text, `YY.NN` (26.01 … 26.30), picked from a list so they always keep two digits (26.10, not 26.1). Any number can be open at once in different rooms, as long as a room's cycles don't overlap. An open cycle (`status = current`) is Scheduled until its `start_date`, then In progress; `end_date` is the estimated end and data counts up to today; closing (`status = complete`) sets the actual end. Saving also stamps `daily_records.cycle_id` / `day_number` |
| Harvest records | `harvest_reports` | Weights as text: `12.4 kg`, `850 g` or `3 lb` (plain numbers are grams) |
| Leachate captures | `leachate_log` | Added on Data Entry to a cycle in progress: typed in, pasted from the Google Sheet, or imported from a CSV (Download Sample gives the layout). Export CSV downloads a room's rows for a cycle |
| AI reports | `crop_reports` | Written by Claude through the `ai` Edge Function; the newest per room + cycle is shown |
| Logins | Supabase Auth | Email + password |
| Team, roles, active/disabled, feature access | `profiles` | Admins add people, change roles, disable them and pick each staff member's features (`permissions`: live rooms, room detail, AI reports, harvest history, data entry) on the Team page |

`supabase/schema.json` is the current schema of every table, pulled from the live project (see below).

## Setup

1. Install Node.js 18+.
2. `npm install`
3. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. First admin: create the user in **Authentication → Users → Add user** (tick *Auto Confirm User*), then run `supabase/profiles.sql` in the SQL Editor with that user's id and email, then `supabase/policies.sql`, `supabase/policies-cycles.sql`, `supabase/room-targets.sql` and `supabase/permissions.sql`.
5. **Authentication → Sign In / Providers → Email:** turn off *Confirm email*, so people the admin adds can sign in straight away.
6. `npm run dev` and open http://localhost:5173.

## Pages and URLs

`/` Live Rooms · `/rooms/room2` a room · `/reports` AI Reports · `/reports/room2` a room's report · `/harvests` · `/data-entry` · `/team` · `/settings` harvest cycles · `/settings/targets` room targets.

When hosting, rewrite every path to `index.html` (e.g. a Vercel or Netlify rewrite rule) so refreshing a page doesn't return 404. `npm run dev` and `npm run preview` already do this.

## Table schema

```bash
npm run schema
```

This calls the project's REST API (`/rest/v1/`) and writes every table's columns, types, defaults, primary keys and foreign keys, plus the callable RPC functions, to `supabase/schema.json`. Supabase only serves that endpoint to the **service role key**, so set `SUPABASE_SERVICE_ROLE_KEY` in `.env` first. Never prefix it with `VITE_`, or it ends up in the browser bundle.

## AI reports (optional)

The Generate buttons call the `ai` Edge Function, which calls Claude.

```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase functions deploy ai
```

The function only answers signed-in admins, and staff with AI crop reports access.

## Structure

```
src/
  App.jsx               URL routing, login, shared state
  lib/supabase.js       Supabase client
  lib/api.js            all reads/writes
  lib/logic.js          status, gauges, chart paths, report math
  lib/config.js         price per gram, default targets
  components/           Header, CyclePicker, shared UI
  pages/                Login, Home, Room, Reports, RoomReport, Harvests, DataEntry, Team, Settings (+ Targets tab)
supabase/
  profiles.sql          profiles table, its policies, first admin
  policies.sql          read/write rules for the data tables
  policies-cycles.sql   lets admins manage harvest cycles from Settings
  room-targets.sql      target ranges per room per cycle, set in Settings -> Targets
  permissions.sql       per-staff feature access (profiles.permissions) and the policies that enforce it
  fetch-schema.mjs      `npm run schema`: pulls the table schema from the API
  schema.json           output of the above
  functions/ai/index.ts Claude edge function
```
