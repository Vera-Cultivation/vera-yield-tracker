import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The app only runs against Supabase; without these it shows a setup screen.
export const isConfigured = Boolean(url && anonKey);
export const supabase = isConfigured ? createClient(url, anonKey) : null;
