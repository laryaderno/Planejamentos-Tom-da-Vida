import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Cliente Supabase. Fica `null` enquanto as variáveis de ambiente não estiverem
 * configuradas (ver .env.example), permitindo rodar o protótipo só com dados de exemplo.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const supabaseConfigurado = supabase !== null;
