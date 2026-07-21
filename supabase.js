/* =========================
   CONEXIÓN CON SUPABASE
========================= */

const SUPABASE_URL = "https://gkzeqqxpmagliyjbfjsr.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_OqmuukeemUf_UGNBnkDYHg_ulqjXUzi";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
console.log("Supabase conectado");