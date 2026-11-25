/**
 * Testa a migração de fundação em um Postgres em memória (PGlite), sem Docker.
 * O esquema `auth` do Supabase é simulado com o mínimo necessário.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const SUPABASE = join(import.meta.dirname, "..");
const DIRETORA = "00000000-0000-0000-0000-000000000001";
const SECRETARIA = "00000000-0000-0000-0000-000000000002";
const PENDENTE = "00000000-0000-0000-0000-000000000003";

let db: PGlite;

async function como<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

async function contar(sql: string): Promise<number> {
  const r = await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) x`);
  return r.rows[0]!.n;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated;
  `);
  const migracoes = readdirSync(join(SUPABASE, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const m of migracoes) await db.exec(readFileSync(join(SUPABASE, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(SUPABASE, "seed.sql"), "utf8"));
  await db.exec(`grant select, insert, update on all tables in schema public to authenticated;`);

  await db.exec(`
    insert into auth.users values
      ('${DIRETORA}',   'dir@teste.com',  '{"nome": "Ana Diretora", "papel_solicitado": "diretor"}'),
      ('${SECRETARIA}', 'sec@teste.com',  '{"nome": "Bia Secretaria", "papel_solicitado": "secretaria"}'),
      ('${PENDENTE}',   'pend@teste.com', '{"papel_solicitado": "administrador"}');
    update public.perfis set status = 'ativo' where id in ('${DIRETORA}', '${SECRETARIA}');
  `);
}, 60_000);

describe("cadastro", () => {
  it("cria perfil pendente e nunca aceita pedido de Administrador", async () => {
    const r = await db.query<{ papel: string; status: string }>(
      `select papel, status from public.perfis where id = '${PENDENTE}'`,
    );
    expect(r.rows[0]).toEqual({ papel: "professor", status: "pendente" });
  });
});

describe("RLS de leitura", () => {
  it("usuário pendente não vê turmas, só o próprio perfil", async () => {
    expect(await como(PENDENTE, () => contar("select * from public.turmas"))).toBe(0);
    expect(await como(PENDENTE, () => contar("select * from public.perfis"))).toBe(1);
  });

  it("usuário ativo vê as turmas", async () => {
    expect(await como(SECRETARIA, () => contar("select * from public.turmas"))).toBe(8);
  });

  it("só o Administrador lê o log de auditoria", async () => {
    expect(await como(DIRETORA, () => contar("select * from public.log_auditoria"))).toBe(0);
    expect(await contar("select * from public.log_auditoria")).toBeGreaterThan(0);
  });

  it("navegador não consegue alterar turmas nesta fase (sem política de escrita)", async () => {
    await como(DIRETORA, () => db.query(`update public.turmas set nome = 'X' where nome = 'Berçário'`));
    expect(await contar(`select * from public.turmas where nome = 'Berçário'`)).toBe(1);
  });
});

describe("trava em cascata", () => {
  beforeAll(async () => {
    // Política temporária só para exercitar o gatilho da trava.
    await db.exec(`create policy teste_update on public.turmas for update to authenticated using (true);`);
  });

  it("registra o nível de quem definiu", async () => {
    await como(DIRETORA, () => db.query(`update public.turmas set nome = 'Jardim 1 A' where nome = 'Jardim 1'`));
    const r = await db.query<{ definido_por_nivel: number }>(
      `select definido_por_nivel from public.turmas where nome = 'Jardim 1 A'`,
    );
    expect(r.rows[0]?.definido_por_nivel).toBe(40);
  });

  it("Secretaria não altera o que o Diretor definiu, com a mensagem da especificação", async () => {
    await expect(
      como(SECRETARIA, () => db.query(`update public.turmas set nome = 'Y' where nome = 'Jardim 1 A'`)),
    ).rejects.toThrow(/definida por Ana Diretora \(Diretor\) em \d{2}\/\d{2}\/\d{4}\. Apenas um Diretor pode alterá-la/);
  });

  it("Secretaria altera o que ainda não foi travado", async () => {
    await como(SECRETARIA, () => db.query(`update public.turmas set nome = 'Maternal B' where nome = 'Maternal'`));
    expect(await contar(`select * from public.turmas where nome = 'Maternal B' and definido_por_nivel = 30`)).toBe(1);
  });

  it("toda alteração vai para a auditoria", async () => {
    expect(await contar(`select * from public.log_auditoria where tabela = 'turmas' and acao = 'UPDATE'`)).toBe(2);
  });
});
