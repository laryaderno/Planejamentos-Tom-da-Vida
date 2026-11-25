/** Fase 2: planejamentos, blocos, status, Linguagem do Amor, histórico, notas e D6. */
import { beforeAll, describe, expect, it } from "vitest";
import { criarBanco, type Banco } from "./banco";

let b: Banco;
const u: Record<string, string> = {};
let EI = 0;
let F1 = 0;
let JARDIM1 = 0;
let ANO1 = 0;
let POLIVALENTE = 0;
let INGLES = 0;

async function valor<T>(uid: string, sql: string, params: unknown[] = []): Promise<T> {
  const r = await b.como(uid, () => b.db.query<{ v: T }>(`select ${sql} as v`, params));
  return r.rows[0]!.v;
}

async function vincular(usuario: string, etapa: number, turma: number | null, disciplina: number | null, regente = false) {
  await b.db.query(
    "insert into public.vinculos (usuario_id, etapa_id, turma_id, disciplina_id, regente) values ($1, $2, $3, $4, $5)",
    [usuario, etapa, turma, disciplina, regente],
  );
}

beforeAll(async () => {
  b = await criarBanco();
  EI = await b.id("etapas", "Educação Infantil");
  F1 = await b.id("etapas", "Ensino Fundamental I");
  JARDIM1 = await b.id("turmas", "Jardim 1");
  ANO1 = await b.id("turmas", "1º Ano A");
  POLIVALENTE = await b.id("disciplinas", "Polivalente (Regente)");
  INGLES = await b.id("disciplinas", "Inglês");

  u.secretaria = await b.criarUsuario({ email: "sec@t.com", nome: "Secretaria", papel: "secretaria" });
  u.coordEI = await b.criarUsuario({ email: "coord@t.com", nome: "Coord EI", papel: "coordenador" });
  await vincular(u.coordEI, EI, null, null);
  u.coordF1 = await b.criarUsuario({ email: "coordf1@t.com", nome: "Coord F1", papel: "coordenador" });
  await vincular(u.coordF1, F1, null, null);
  u.regente = await b.criarUsuario({ email: "reg@t.com", nome: "Regente Jardim", papel: "professor" });
  await vincular(u.regente, EI, JARDIM1, POLIVALENTE, true);
  u.ingles = await b.criarUsuario({ email: "ing@t.com", nome: "Prof Inglês", papel: "professor" });
  await vincular(u.ingles, EI, JARDIM1, INGLES);
  u.outro = await b.criarUsuario({ email: "outro@t.com", nome: "Prof 1º Ano", papel: "professor" });
  await vincular(u.outro, F1, ANO1, POLIVALENTE, true);
}, 60_000);

let PLAN = 0;
let BLOCO_REG = 0;
let BLOCO_ING = 0;

describe("abrir planejamento e criar blocos", () => {
  it("professor abre o planejamento da sua turma (uma vez por turma, data e turno)", async () => {
    PLAN = Number(await valor(u.regente!, "public.abrir_planejamento($1, '2026-12-01', 'matutino')", [JARDIM1]));
    const denovo = Number(await valor(u.ingles!, "public.abrir_planejamento($1, '2026-12-01', 'matutino')", [JARDIM1]));
    expect(denovo).toBe(PLAN);
  });

  it("professor não abre planejamento de turma em que não leciona", async () => {
    await expect(valor(u.outro!, "public.abrir_planejamento($1, '2026-12-01', 'matutino')", [JARDIM1])).rejects.toThrow(/não tem acesso/);
  });

  it("cada professor cria o bloco da sua disciplina; ninguém cria bloco de outra disciplina", async () => {
    BLOCO_REG = Number(await valor(u.regente!, "public.criar_bloco($1, $2, '07:30', '09:30')", [PLAN, POLIVALENTE]));
    BLOCO_ING = Number(await valor(u.ingles!, "public.criar_bloco($1, $2, '09:30', '10:20')", [PLAN, INGLES]));
    expect(BLOCO_REG).toBeGreaterThan(0);
    // §4.2: o Regente nunca preenche o bloco do especialista
    await expect(valor(u.regente!, "public.criar_bloco($1, $2, '10:30', '11:00')", [PLAN, INGLES])).rejects.toThrow(/disciplinas que leciona/);
  });

  it("gestores não criam planejamento (editar é só do professor)", async () => {
    const id = await valor<number | null>(u.secretaria!, "public.abrir_planejamento($1, '2026-12-02', 'matutino')", [JARDIM1]);
    expect(id).toBeNull();
  });
});

describe("edição dos blocos", () => {
  it("professor salva o próprio bloco e a versão avança", async () => {
    const r = await valor<{ versao: number; conflito: boolean }>(u.regente!, "public.salvar_bloco($1, 1, $2)", [
      BLOCO_REG,
      JSON.stringify({ conteudo: "Cores primárias", habilidades: ["espacial", "linguistica"], status: "amarelo" }),
    ]);
    expect(r).toMatchObject({ versao: 2, conflito: false });
  });

  it("professor não edita o bloco do colega", async () => {
    await expect(
      valor(u.ingles!, "public.salvar_bloco($1, null, $2)", [BLOCO_REG, JSON.stringify({ conteudo: "x" })]),
    ).rejects.toThrow(/professor responsável/);
  });

  it("versão desatualizada: grava (última vale) e avisa conflito", async () => {
    const r = await valor<{ versao: number; conflito: boolean }>(u.regente!, "public.salvar_bloco($1, 1, $2)", [
      BLOCO_REG,
      JSON.stringify({ recursos: "Guache" }),
    ]);
    expect(r).toMatchObject({ versao: 3, conflito: true });
  });

  it("Educação Infantil: não conclui (verde) sem a Linguagem do Amor", async () => {
    await expect(
      valor(u.regente!, "public.salvar_bloco($1, null, $2)", [BLOCO_REG, JSON.stringify({ status: "verde" })]),
    ).rejects.toThrow(/Linguagem do Amor/);
    await valor(u.regente!, "public.salvar_bloco($1, null, $2)", [
      BLOCO_REG,
      JSON.stringify({ linguagem_amor: "tempo_qualidade", status: "verde" }),
    ]);
    expect(await b.contar("select * from public.blocos where id = $1 and status = 'verde'", [BLOCO_REG])).toBe(1);
  });

  it("fora da Educação Infantil a Linguagem do Amor não existe", async () => {
    const plan = Number(await valor(u.outro!, "public.abrir_planejamento($1, '2026-12-01', 'matutino')", [ANO1]));
    const bloco = Number(await valor(u.outro!, "public.criar_bloco($1, $2, '07:30', '11:30')", [plan, POLIVALENTE]));
    await expect(
      valor(u.outro!, "public.salvar_bloco($1, null, $2)", [bloco, JSON.stringify({ linguagem_amor: "presentes" })]),
    ).rejects.toThrow(/só é registrada em turmas da Educação Infantil/);
    await valor(u.outro!, "public.salvar_bloco($1, null, $2)", [bloco, JSON.stringify({ status: "verde" })]);
  });

  it("histórico guarda cada campo alterado, com autor", async () => {
    const n = await b.contar("select * from public.historico_blocos where bloco_id = $1 and autor_id = $2", [BLOCO_REG, u.regente]);
    // conteudo, habilidades, status(amarelo), recursos, linguagem_amor, status(verde)
    expect(n).toBe(6);
  });

  it("bloco com conteúdo não pode ser removido", async () => {
    await expect(valor(u.regente!, "public.remover_bloco($1)", [BLOCO_REG])).rejects.toThrow(/bloco vazio/);
  });
});

describe("visibilidade", () => {
  it("Coordenador vê os blocos da sua etapa, não os de outra", async () => {
    expect(await b.como(u.coordEI!, () => b.contar("select * from public.blocos where planejamento_id = $1", [PLAN]))).toBe(2);
    expect(await b.como(u.coordF1!, () => b.contar("select * from public.blocos where planejamento_id = $1", [PLAN]))).toBe(0);
  });

  it("professor de outra turma não vê o planejamento", async () => {
    expect(await b.como(u.outro!, () => b.contar("select * from public.planejamentos where id = $1", [PLAN]))).toBe(0);
  });

  it("quem vê o planejamento adiciona nota; quem não vê, não", async () => {
    await b.db.exec("grant insert on public.notas to authenticated");
    await b.como(u.coordEI!, () =>
      b.db.query("insert into public.notas (planejamento_id, texto) values ($1, 'Ótima sequência!')", [PLAN]),
    );
    await expect(
      b.como(u.coordF1!, () => b.db.query("insert into public.notas (planejamento_id, texto) values ($1, 'x')", [PLAN])),
    ).rejects.toThrow(/row-level security/);
    expect(await b.como(u.regente!, () => b.contar("select * from public.notas where planejamento_id = $1", [PLAN]))).toBe(1);
  });
});

describe("remoção de professor (D6)", () => {
  it("Manter: blocos arquivados, visíveis e somente leitura", async () => {
    await b.rpc(u.secretaria!, "remover_usuario", { p_usuario: u.ingles, p_destino: "manter" });
    expect(await b.contar("select * from public.blocos where id = $1 and arquivado_em is not null", [BLOCO_ING])).toBe(1);
    expect(await b.como(u.coordEI!, () => b.contar("select * from public.blocos where id = $1", [BLOCO_ING]))).toBe(1);
  });

  it("Excluir: blocos somem das telas, mas continuam guardados", async () => {
    await b.rpc(u.secretaria!, "remover_usuario", { p_usuario: u.regente, p_destino: "excluir" });
    expect(await b.como(u.coordEI!, () => b.contar("select * from public.blocos where id = $1", [BLOCO_REG]))).toBe(0);
    expect(await b.contar("select * from public.blocos where id = $1 and excluido_em is not null and conteudo = 'Cores primárias'", [BLOCO_REG])).toBe(1);
  });
});
