import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** As variáveis de ambiente estão preenchidas? (ver .env.example e README) */
export const supabaseConfigurado = Boolean(url && anonKey);

/**
 * Cliente Supabase tipado com o esquema do banco (src/lib/database.types.ts,
 * gerado por `npm run db:types`).
 */
export const supabase = createClient<Database>(url ?? "http://configure-o-supabase.invalid", anonKey ?? "ausente");
