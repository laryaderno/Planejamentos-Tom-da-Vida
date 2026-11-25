/**
 * Apoio aos testes do banco: sobe um Postgres em memória (PGlite) com um
 * esquema `auth` mínimo, aplica todas as migrações e o seed base.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SUPABASE = join(import.meta.dirname, "..");

export type PapelTeste = "administrador" | "diretor" | "secretaria" | "coordenador" | "professor";

export interface NovoUsuario {
  email: string;
  nome: string;
  papel: PapelTeste;
  status?: "pendente" | "ativo";
  etapa?: string;
}

export interface Banco {
  db: PGlite;
  /** Executa `fn` autenticado como `uid` (role `authenticated`). */
  como<T>(uid: string, fn: () => Promise<T>): Promise<T>;
  /** Chama uma função RPC como `uid`. */
  rpc(uid: string, fn: string, args: Record<string, unknown>): Promise<void>;
  contar(sql: string, params?: unknown[]): Promise<number>;
  criarUsuario(u: NovoUsuario): Promise<string>;
  id(tabela: "etapas" | "turmas" | "disciplinas", nome: string): Promise<number>;
}

const PREPARO_AUTH = [
  "create role anon",
  "create role authenticated",
  "create role service_role",
  "create schema auth",
  "create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb)",
  "create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid'",
  "grant usage on schema public, auth to authenticated",
  // Armazenamento de arquivos do Supabase (mínimo para as políticas)
  "create schema storage",
  "create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[])",
  "create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid)",
  "create function storage.foldername(name text) returns text[] language sql immutable as 'select (string_to_array(name, ''/''))[1:array_length(string_to_array(name, ''/''), 1) - 1]'",
  "alter table storage.objects enable row level security",
  "grant usage on schema storage to authenticated",
  "grant select, insert, delete on storage.objects to authenticated",
].join(";\n");

export async function criarBanco(): Promise<Banco> {
  const db = new PGlite();
  await db.exec(PREPARO_AUTH);
  const migracoes = readdirSync(join(SUPABASE, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const m of migracoes) await db.exec(readFileSync(join(SUPABASE, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(SUPABASE, "seed.sql"), "utf8"));
  await db.exec("grant select on all tables in schema public to authenticated");

  let n = 0;

  const banco: Banco = {
    db,
    async como(uid, fn) {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
      await db.exec("set role authenticated");
      try {
        return await fn();
      } finally {
        await db.exec("reset role");
        await db.query("select set_config('request.jwt.claim.sub', '', false)");
      }
    },
    async rpc(uid, fn, args) {
      const nomes = Object.keys(args);
      const params = nomes.map((k, i) => `${k} => $${i + 1}`).join(", ");
      const valores = nomes.map((k) => {
        const v = args[k];
        return typeof v === "object" && v !== null ? JSON.stringify(v) : v;
      });
      await banco.como(uid, () => db.query(`select public.${fn}(${params})`, valores));
    },
    async contar(sql, params = []) {
      const r = await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) x`, params);
      return r.rows[0]!.n;
    },
    async criarUsuario({ email, nome, papel, status = "ativo", etapa }) {
      n += 1;
      const id = `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
      const etapaId = etapa ? await banco.id("etapas", etapa) : null;
      await db.query("insert into auth.users values ($1, $2, $3)", [
        id,
        email,
        JSON.stringify({ nome, papel_solicitado: papel, etapa_id: etapaId }),
      ]);
      await db.query("update public.perfis set papel = $2, status = $3 where id = $1", [id, papel, status]);
      return id;
    },
    async id(tabela, nome) {
      const r = await db.query<{ id: number }>(`select id from public.${tabela} where nome = $1`, [nome]);
      if (!r.rows[0]) throw new Error(`${tabela} não encontrada: ${nome}`);
      return Number(r.rows[0].id);
    },
  };
  return banco;
}
