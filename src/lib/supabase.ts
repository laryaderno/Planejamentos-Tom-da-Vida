import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** As variáveis de ambiente estão preenchidas? (ver .env.example e README) */
export const supabaseConfigurado = Boolean(url && anonKey);

/** Tempo máximo de espera de uma consulta antes de considerar "sem conexão". */
const TEMPO_LIMITE_MS = 12_000;

/**
 * Consultas e funções do banco (/rest/v1) desistem depois de 12 s: com rede
 * ruim a requisição pode ficar pendurada, e o sistema precisa cair para o modo
 * offline (fila e cópia local) em vez de esperar indefinidamente.
 * Envio de arquivos e login não têm esse limite.
 */
const fetchComTempoLimite: typeof fetch = (entrada, opcoes) => {
  const endereco = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  if (!endereco.includes("/rest/v1/")) return fetch(entrada, opcoes);
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(new TypeError("Failed to fetch (tempo esgotado)")), TEMPO_LIMITE_MS);
  const sinal = opcoes?.signal ? AbortSignal.any([opcoes.signal, controle.signal]) : controle.signal;
  return fetch(entrada, { ...opcoes, signal: sinal }).finally(() => clearTimeout(timer));
};

/**
 * Cliente Supabase tipado com o esquema do banco (src/lib/database.types.ts,
 * gerado por `npm run db:types`).
 */
export const supabase = createClient<Database>(url ?? "http://configure-o-supabase.invalid", anonKey ?? "ausente", {
  global: { fetch: fetchComTempoLimite },
});
