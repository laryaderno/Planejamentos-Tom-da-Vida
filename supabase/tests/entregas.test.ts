/** Prazos, entregas (antecipado / no prazo / atrasado) e notificações. */
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

/** Cria e conclui (verde) um bloco do professor no dia. */
async function concluirDia(prof: string, turma: number, disciplina: number, data: string, inicio = "07:30", fim = "11:30") {
  const plan = Number(await valor(prof, `public.abrir_planejamento($1, '${data}', 'matutino')`, [turma]));
  const bloco = Number(await valor(prof, `public.criar_bloco($1, $2, '${inicio}', '${fim}')`, [plan, disciplina]));
  const campos: Record<string, unknown> = { conteudo: "Aula", status: "verde" };
  if (turma === JARDIM1) campos.linguagens_amor = ["presentes"];
  await valor(prof, "public.salvar_bloco($1, null, $2)", [bloco, JSON.stringify(campos)]);
  return bloco;
}

const notificacoesDe = (uid: string) => b.como(uid, () => b.contar("select * from public.notificacoes"));

beforeAll(async () => {
  b = await criarBanco();
  await b.db.exec("grant select on all tables in schema public to authenticated");
  EI = await b.id("etapas", "Educação Infantil");
  F1 = await b.id("etapas", "Ensino Fundamental I");
  JARDIM1 = await b.id("turmas", "Jardim 1");
  ANO1 = await b.id("turmas", "1º Ano A");
  POLIVALENTE = await b.id("disciplinas", "Polivalente (Regente)");
  INGLES = await b.id("disciplinas", "Inglês");

  u.diretor = await b.criarUsuario({ email: "dir@t.com", nome: "Diretora", papel: "diretor" });
  u.secretaria = await b.criarUsuario({ email: "sec@t.com", nome: "Secretaria", papel: "secretaria" });
  u.coordEI = await b.criarUsuario({ email: "cei@t.com", nome: "Coord EI", papel: "coordenador" });
  await vincular(u.coordEI, EI, null, null);
  u.coordF1 = await b.criarUsuario({ email: "cf1@t.com", nome: "Coord F1", papel: "coordenador" });
  await vincular(u.coordF1, F1, null, null);
  u.regente = await b.criarUsuario({ email: "reg@t.com", nome: "Marina", papel: "professor" });
  await vincular(u.regente, EI, JARDIM1, POLIVALENTE, true);
  u.ingles = await b.criarUsuario({ email: "ing@t.com", nome: "Lucas", papel: "professor" });
  await vincular(u.ingles, EI, JARDIM1, INGLES);
  u.reg1ano = await b.criarUsuario({ email: "r1@t.com", nome: "Beatriz", papel: "professor" });
  await vincular(u.reg1ano, F1, ANO1, POLIVALENTE, true);
}, 60_000);

describe("situação da entrega (dias úteis)", () => {
  // prazo numa sexta-feira, 2026-11-27
  it.each([
    ["2026-11-25", "antecipado"], // quarta: quinta e sexta = 2 dias úteis antes
    ["2026-11-26", "no_prazo"], // quinta: véspera
    ["2026-11-27", "no_prazo"], // no dia
    ["2026-11-28", "atrasado"], // sábado depois
  ])("entregue em %s → %s", async (data, esperado) => {
    const r = await b.db.query<{ s: string }>("select public.situacao_da_entrega($1::date, '2026-11-27') as s", [data]);
    expect(r.rows[0]!.s).toBe(esperado);
  });

  it("fim de semana não conta como dia útil de antecedência", async () => {
    // prazo segunda 30/11; entregue sexta 27/11: só a segunda é dia útil → no prazo
    const r = await b.db.query<{ s: string }>("select public.situacao_da_entrega('2026-11-27', '2026-11-30') as s");
    expect(r.rows[0]!.s).toBe("no_prazo");
  });
});

describe("períodos", () => {
  it("só Direção e Secretaria cadastram; não pode sobrepor outro período", async () => {
    await expect(b.rpc(u.coordEI!, "salvar_periodo", { p_id: null, p_inicio: "2026-12-07", p_fim: "2026-12-11", p_prazo: "2026-12-04" }))
      .rejects.toThrow(/Direção ou a Secretaria/);
    await b.rpc(u.diretor!, "salvar_periodo", { p_id: null, p_inicio: "2026-12-07", p_fim: "2026-12-11", p_prazo: "2099-12-31" });
    await expect(b.rpc(u.secretaria!, "salvar_periodo", { p_id: null, p_inicio: "2026-12-10", p_fim: "2026-12-18", p_prazo: "2026-12-09" }))
      .rejects.toThrow(/cobre parte dessas datas/);
  });

  it("Secretaria não altera período definido pelo Diretor (trava em cascata)", async () => {
    const id = Number((await b.db.query<{ id: number }>("select id from public.periodos_entrega where inicio = '2026-12-07'")).rows[0]!.id);
    await expect(b.rpc(u.secretaria!, "salvar_periodo", { p_id: id, p_inicio: "2026-12-07", p_fim: "2026-12-11", p_prazo: "2026-12-05" }))
      .rejects.toThrow(/Apenas um Diretor/);
  });
});

describe("entrega do período", () => {
  it("Regente só entrega quando todos os dias úteis do período estão concluídos", async () => {
    for (const dia of ["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10"]) {
      await concluirDia(u.regente!, JARDIM1, POLIVALENTE, dia);
    }
    expect(await b.contar("select * from public.entregas where professor_id = $1", [u.regente])).toBe(0);
    await concluirDia(u.regente!, JARDIM1, POLIVALENTE, "2026-12-11");
    expect(await b.contar("select * from public.entregas where professor_id = $1 and situacao = 'antecipado'", [u.regente])).toBe(1);
  });

  it("notifica o professor, a Coordenação da etapa e a Direção — não a Secretaria nem outra Coordenação", async () => {
    expect(await notificacoesDe(u.regente!)).toBe(1);
    expect(await notificacoesDe(u.coordEI!)).toBe(1);
    expect(await notificacoesDe(u.diretor!)).toBe(1);
    expect(await notificacoesDe(u.secretaria!)).toBe(0);
    expect(await notificacoesDe(u.coordF1!)).toBe(0);
    const msg = await valor<string>(u.coordEI!, "(select mensagem from public.notificacoes limit 1)");
    expect(msg).toMatch(/Marina entregou o planejamento de Jardim 1 \(07\/12 a 11\/12\) com antecedência/);
  });

  it("especialista entrega quando conclui todos os blocos que criou no período", async () => {
    await concluirDia(u.ingles!, JARDIM1, INGLES, "2026-12-09", "09:30", "10:20");
    expect(await b.contar("select * from public.entregas where professor_id = $1", [u.ingles])).toBe(1);
  });

  it("voltar para amarelo e concluir de novo não gera nova entrega nem nova notificação", async () => {
    const bloco = Number((await b.db.query<{ id: number }>(
      "select b.id from public.blocos b join public.planejamentos p on p.id = b.planejamento_id where b.professor_id = $1 and p.data = '2026-12-08'",
      [u.regente],
    )).rows[0]!.id);
    await valor(u.regente!, "public.salvar_bloco($1, null, $2)", [bloco, JSON.stringify({ status: "amarelo" })]);
    await valor(u.regente!, "public.salvar_bloco($1, null, $2)", [bloco, JSON.stringify({ status: "verde" })]);
    expect(await b.contar("select * from public.entregas where professor_id = $1", [u.regente])).toBe(1);
    expect(await notificacoesDe(u.regente!)).toBe(1);
  });

  it("período cadastrado depois registra entrega já concluída, com atraso, sem notificar de novo", async () => {
    await concluirDia(u.reg1ano!, ANO1, POLIVALENTE, "2026-12-14");
    await b.rpc(u.secretaria!, "salvar_periodo", { p_id: null, p_inicio: "2026-12-14", p_fim: "2026-12-14", p_prazo: "2026-01-01" });
    expect(await b.contar("select * from public.entregas where professor_id = $1 and situacao = 'atrasado'", [u.reg1ano])).toBe(1);
    expect(await notificacoesDe(u.reg1ano!)).toBe(0);
  });

  it("período com entregas não pode ser removido", async () => {
    const id = Number((await b.db.query<{ id: number }>("select id from public.periodos_entrega where inicio = '2026-12-07'")).rows[0]!.id);
    await expect(b.rpc(u.diretor!, "remover_periodo", { p_id: id })).rejects.toThrow(/entregas registradas/);
  });
});

describe("notificações", () => {
  it("cada um marca só as próprias como lidas", async () => {
    await b.rpc(u.coordEI!, "marcar_notificacoes_lidas", {});
    expect(await b.contar("select * from public.notificacoes where usuario_id = $1 and lida_em is null", [u.coordEI])).toBe(0);
    expect(await b.contar("select * from public.notificacoes where usuario_id = $1 and lida_em is null", [u.diretor])).toBe(2); // Marina e Lucas
  });

  it("professor vê as entregas das turmas em que leciona (etiqueta Atrasado, §8.3), não as de outras", async () => {
    // Lucas leciona no Jardim 1: vê a própria entrega e a da Marina
    expect(await b.como(u.ingles!, () => b.contar("select * from public.entregas"))).toBe(2);
    // Beatriz (1º Ano A) não vê as entregas do Jardim 1
    expect(await b.como(u.reg1ano!, () => b.contar("select * from public.entregas where turma_id = $1", [JARDIM1]))).toBe(0);
    expect(await b.como(u.coordEI!, () => b.contar("select * from public.entregas"))).toBe(2);
    expect(await b.como(u.coordF1!, () => b.contar("select * from public.entregas"))).toBe(1);
  });
});
