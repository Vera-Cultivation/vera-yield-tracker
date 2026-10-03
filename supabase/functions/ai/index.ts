// Supabase Edge Function: `ai`
// Called by the app's "Regenerate" buttons. Verifies the caller is on the Vera Yield Tracker team,
// sends the prompt to Claude and returns { text }.
//
// Deploy:  supabase functions deploy ai
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Only signed-in team members may use the model.
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: auth } = await sb.auth.getUser();
  const { data: profile } = auth.user
    ? await sb.from("profiles").select("is_active").eq("id", auth.user.id).maybeSingle()
    : { data: null };
  if (!profile?.is_active) return json({ error: "Not on the Vera Yield Tracker team." }, 403);

  let prompt: unknown;
  try {
    ({ prompt } = await req.json());
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 20000) {
    return json({ error: "prompt must be a non-empty string under 20,000 characters." }, 400);
  }

  try {
    const response = await anthropic.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // Short, factual summaries — low effort keeps latency and cost down.
      output_config: { effort: "low" },
      // If a safety classifier declines, the API re-runs the request on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        "You are the cultivation analyst for an indoor cannabis facility. Base every statement on the data you are given, " +
        "never invent figures, and reply in exactly the format the user asks for, with no markdown.",
      messages: [{ role: "user", content: prompt }],
    });

    if (response.stop_reason === "refusal") return json({ error: "Claude declined to write this report." }, 422);

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();
    return json({ text });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "Rate limited — try again shortly." }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: e.message }, e.status ?? 502);
    return json({ error: String(e) }, 500);
  }
});
