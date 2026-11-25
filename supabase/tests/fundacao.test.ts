/** Fase 0: cadastro, RLS de leitura, trava em cascata e auditoria. */
import { beforeAll, describe, expect, it } from "vitest";
import { criarBanco, type Banco } from "./banco";

const PENDENTE = "99999999-0000-0000-0000-000000000000";
let b: Banco;
let DIRETORA: string;
let SECRETARIA: string;

beforeAll(async () => {
  b = await criarBanco();
  DIRETORA = await b.criarUsuario({ email: "dir@teste.com", nome: "Ana Diretora", papel: "diretor" });
  SECRETARIA = await b.criarUsuario({ email: "sec@teste.com", nome: "Bia Secretaria", papel: "secretaria" });
  // Pedido de Administrador no cadastro deve virar Professor pendente.
  await b.db.query("insert into auth.users values ($1, 'pend@teste.com', $2)", [
    PENDENTE,
    JSON.stringify({ papel_solicitado: "administrador" }),
  ]);
}, 60_000);

describe("cadastro", () => {
  it("cria perfil pendente e nunca aceita pedido de Administrador", async () => {
    const r = await b.db.query("select papel, status from public.perfis where id = $1", [PENDENTE]);
    expect(r.rows[0]).toEqual({ papel: "professor", status: "pendente" });
  });
});

describe("RLS de leitura", () => {
  it("usuário pendente não vê turmas, só o próprio perfil", async () => {
    expect(await b.como(PENDENTE, () => b.contar("select * from public.turmas"))).toBe(0);
    expect(await b.como(PENDENTE, () => b.contar("select * from public.perfis"))).toBe(1);
  });

  it("usuário ativo vê as turmas", async () => {
    expect(await b.como(SECRETARIA, () => b.contar("select * from public.turmas"))).toBe(8);
  });

  it("só o Administrador lê o log de auditoria", async () => {
    expect(await b.como(DIRETORA, () => b.contar("select * from public.log_auditoria"))).toBe(0);
    expect(await b.contar("select * from public.log_auditoria")).toBeGreaterThan(0);
  });

  it("o navegador não altera tabelas diretamente (sem política de escrita)", async () => {
    await b.db.exec("grant update on public.turmas to authenticated");
    await b.como(DIRETORA, () => b.db.query("update public.turmas set nome = 'X' where nome = 'Berçário'"));
    expect(await b.contar("select * from public.turmas where nome = 'Berçário'")).toBe(1);
  });
});

describe("trava em cascata", () => {
  it("Secretaria não altera turma definida pelo Diretor, com a mensagem da especificação", async () => {
    const jardim = await b.id("turmas", "Jardim 1");
    const ei = await b.id("etapas", "Educação Infantil");
    await b.rpc(DIRETORA, "salvar_turma", { p_id: jardim, p_etapa: ei, p_nome: "Jardim 1 A", p_turno: "matutino" });
    const r = await b.db.query<{ definido_por_nivel: number }>(
      "select definido_por_nivel from public.turmas where id = $1",
      [jardim],
    );
    expect(r.rows[0]?.definido_por_nivel).toBe(40);

    await expect(
      b.rpc(SECRETARIA, "salvar_turma", { p_id: jardim, p_etapa: ei, p_nome: "Y", p_turno: "matutino" }),
    ).rejects.toThrow(/definida por Ana Diretora \(Diretor\) em \d{2}\/\d{2}\/\d{4}\. Apenas um Diretor pode alterá-la/);
  });

  it("Secretaria altera o que ainda não foi travado", async () => {
    const maternal = await b.id("turmas", "Maternal");
    const ei = await b.id("etapas", "Educação Infantil");
    await b.rpc(SECRETARIA, "salvar_turma", { p_id: maternal, p_etapa: ei, p_nome: "Maternal B", p_turno: "matutino" });
    expect(await b.contar("select * from public.turmas where nome = 'Maternal B' and definido_por_nivel = 30")).toBe(1);
  });

  it("toda alteração vai para a auditoria", async () => {
    expect(await b.contar("select * from public.log_auditoria where tabela = 'turmas' and acao = 'UPDATE'")).toBe(2);
  });
});
