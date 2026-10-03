// Pulls every table's schema from the live Supabase project and writes it to supabase/schema.json.
//
// Run:  npm run schema
//
// Reads VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env. Supabase only serves this
// endpoint to the service role key. Keep that key server-side: never prefix it with VITE_, or Vite
// will put it in the browser bundle.
//
// Source: PostgREST's OpenAPI description at /rest/v1/, which lists each exposed table and view
// with its columns, types, defaults, primary keys and foreign keys, plus the callable RPC functions.
import { writeFile } from "node:fs/promises";

const url = (process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OUT = new URL("./schema.json", import.meta.url);

// PostgREST puts key info in the column description: "<pk/>" and "<fk table='rooms' column='id'/>".
function column(name, p, required) {
  const desc = p.description || "";
  const fk = desc.match(/<fk table='([^']+)' column='([^']+)'\/>/);
  const note = desc.replace(/Note:\s*/g, "").replace(/This is a (Primary|Foreign) Key[^<]*<[^>]+>/g, "").trim();
  return {
    name,
    type: p.format || p.type,
    nullable: !required.includes(name),
    ...(p.default !== undefined && { default: p.default }),
    ...(desc.includes("<pk/>") && { primaryKey: true }),
    ...(fk && { references: fk[1] + "." + fk[2] }),
    ...(p.enum && { enum: p.enum }),
    ...(p.maxLength && { maxLength: p.maxLength }),
    ...(note && { description: note }),
  };
}

function tablesOf(spec) {
  return Object.entries(spec.definitions || {})
    .map(([name, def]) => {
      const required = def.required || [];
      const path = spec.paths?.["/" + name] || {};
      return {
        name,
        ...(def.description && { description: def.description }),
        // Views and read-only tables expose GET only.
        operations: ["get", "post", "patch", "delete"].filter((m) => path[m]),
        columns: Object.entries(def.properties || {}).map(([col, p]) => column(col, p, required)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function functionsOf(spec) {
  return Object.entries(spec.paths || {})
    .filter(([p]) => p.startsWith("/rpc/"))
    .map(([p, ops]) => {
      const op = ops.post || ops.get || {};
      const body = (op.parameters || []).find((x) => x.in === "body")?.schema?.properties || {};
      return {
        name: p.slice(5),
        ...(op.summary && { description: op.summary }),
        args: Object.entries(body).map(([n, a]) => ({ name: n, type: a.format || a.type })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  if (!url || !key) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.");
    console.error("The service role key is in Supabase Dashboard -> Project Settings -> API.");
    return 1;
  }

  const res = await fetch(url + "/rest/v1/", {
    headers: { apikey: key, Authorization: "Bearer " + key, Accept: "application/openapi+json" },
  });
  if (!res.ok) {
    console.error(`Supabase answered ${res.status} ${res.statusText}: ${await res.text()}`);
    return 1;
  }
  const spec = await res.json();
  const tables = tablesOf(spec);
  const functions = functionsOf(spec);

  await writeFile(OUT, JSON.stringify({ project: url, fetchedAt: new Date().toISOString(), tables, functions }, null, 2) + "\n");
  console.log(`Wrote ${tables.length} tables and ${functions.length} functions to supabase/schema.json.`);
  for (const t of tables) console.log(`  ${t.name.padEnd(28)} ${t.columns.length} columns`);
  return 0;
}

// Set exitCode instead of calling process.exit(): exiting while fetch holds a socket aborts Node on Windows.
process.exitCode = await main();
