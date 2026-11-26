/** Fase 4: rotina na grade, disciplinas, prazos por etapa, conteúdo programático e relatório de entregas. */
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

async function linhas<T>(uid: string, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await b.como(uid, () => b.db.query<T>(sql, params))).rows;
}

async function vincular(usuario: string, etapa: number, turma: number | null, disciplina: number | null, regente = false) {
  await b.db.query(
    "insert into public.vinculos (usuario_id, etapa_id, turma_id, disciplina_id, regente) values ($1, $2, $3, $4, $5)",
    [usuario, etapa, turma, disciplina, regente],
  );
}

async function concluir(prof: string, turma: number, data: string, disciplina: number, conteudo: string, extra: Record<string, unknown> = {}) {
  const plan = Number(await valor(prof, `public.abrir_planejamento($1, '${data}', 'matutino')`, [turma]));
  const bloco = Number(await valor(prof, "public.criar_bloco($1, $2, '07:30', '11:30')", [plan, disciplina]));
  await valor(prof, "public.salvar_bloco($1, null, $2)", [bloco, JSON.stringify({ conteudo, status: "verde", ...extra })]);
  return bloco;
}

beforeAll(async () => {
  b = await criarBanco();
  await b.db.exec("grant select on all tables in schema public to authenticated");
  EI = await b.id("etapas", "Educação Infantil");
  F1 = await b.id("etapas", "Ensino Fundamental I");
  JARDIM1 = await b.id("turmas", "Jardim 1");
  ANO1 = await b.id("turmas", "1º Ano A");
  POLIVALENTE = await b.id("disciplinas", "Polivalente (Regente)");
  INGLES = await b.id("disciplinas", "Inglês");

  u.diretor = await b.criarUsuario({ email: "d@t.com", nome: "Diretora", papel: "diretor" });
  u.secretaria = await b.criarUsuario({ email: "s@t.com", nome: "Secretaria", papel: "secretaria" });
  u.coordEI = await b.criarUsuario({ email: "c@t.com", nome: "Coord EI", papel: "coordenador" });
  await vincular(u.coordEI, EI, null, null);
  u.coordF1 = await b.criarUsuario({ email: "cf@t.com", nome: "Coord F1", papel: "coordenador" });
  await vincular(u.coordF1, F1, null, null);
  u.marina = await b.criarUsuario({ email: "m@t.com", nome: "Marina", papel: "professor" });
  await vincular(u.marina, EI, JARDIM1, POLIVALENTE, true);
  u.lucas = await b.criarUsuario({ email: "l@t.com", nome: "Lucas", papel: "professor" });
  await vincular(u.lucas, EI, JARDIM1, INGLES);
  u.beatriz = await b.criarUsuario({ email: "b@t.com", nome: "Beatriz", papel: "professor" });
  await vincular(u.beatriz, F1, ANO1, POLIVALENTE, true);
}, 60_000);

describe("fuso horário da escola (Campo Grande, UTC-4)", () => {
  it("uma entrega às 23h30 de Campo Grande conta no próprio dia, não no seguinte", async () => {
    // 23h30 em Campo Grande = 03h30 UTC do dia seguinte
    const r = await b.db.query<{ dia: string }>(
      "select (timestamptz '2026-11-28 03:30:00+00' at time zone public.fuso_escola())::date::text as dia",
    );
    expect(r.rows[0]!.dia).toBe("2026-11-27");
  });
});

describe("rotina na grade", () => {
  it("aceita momentos de rotina sem professor junto com as aulas", async () => {
    await b.rpc(u.coordEI!, "salvar_grade", {
      p_turma: JARDIM1,
      p_vigente_desde: "2026-12-01",
      p_aulas: [
        { dia_semana: 1, hora_inicio: "07:30", hora_fim: "08:20", disciplina_id: POLIVALENTE, professor_id: u.marina },
        { dia_semana: 1, hora_inicio: "08:20", hora_fim: "08:40", rotulo: "Lanche" },
        { dia_semana: 1, hora_inicio: "11:00", hora_fim: "11:15", rotulo: "Saída" },
      ],
    });
    expect(await b.contar("select * from public.horarios where turma_id = $1 and rotulo is not null", [JARDIM1])).toBe(2);
  });

  it("momento de rotina não pode ter professor", async () => {
    await expect(b.rpc(u.coordEI!, "salvar_grade", {
      p_turma: JARDIM1, p_vigente_desde: "2026-12-01",
      p_aulas: [{ dia_semana: 2, hora_inicio: "08:20", hora_fim: "08:40", rotulo: "Lanche", professor_id: u.marina, disciplina_id: POLIVALENTE }],
    })).rejects.toThrow(/rotina não tem professor/);
  });
});

describe("disciplinas", () => {
  it("Secretaria cadastra; Coordenação não; nome repetido é recusado", async () => {
    expect(Number(await valor(u.secretaria!, "public.salvar_disciplina(null, 'Música')"))).toBeGreaterThan(0);
    await expect(valor(u.coordEI!, "public.salvar_disciplina(null, 'Teatro')")).rejects.toThrow(/Direção ou a Secretaria/);
    await expect(valor(u.secretaria!, "public.salvar_disciplina(null, ' Robótica ')")).rejects.toThrow(/Já existe/);
  });
});

describe("prazos por etapa", () => {
  it("etapas diferentes podem ter períodos nas mesmas datas; a mesma etapa não", async () => {
    await b.rpc(u.secretaria!, "salvar_periodo", { p_id: null, p_inicio: "2026-12-07", p_fim: "2026-12-11", p_prazo: "2099-01-01", p_etapa: EI });
    await b.rpc(u.secretaria!, "salvar_periodo", { p_id: null, p_inicio: "2026-12-07", p_fim: "2026-12-18", p_prazo: "2026-11-01", p_etapa: F1 });
    await expect(
      b.rpc(u.secretaria!, "salvar_periodo", { p_id: null, p_inicio: "2026-12-09", p_fim: "2026-12-10", p_prazo: "2026-12-01", p_etapa: EI }),
    ).rejects.toThrow(/já tem um período de entrega/);
  });

  it("a entrega usa só o período da etapa da turma", async () => {
    // Beatriz (Fundamental I) conclui 07/12: o período do F1 vai até 18/12, então ainda não entregou
    await concluir(u.beatriz!, ANO1, "2026-12-07", POLIVALENTE, "Adição");
    expect(await b.contar("select * from public.entregas where professor_id = $1", [u.beatriz])).toBe(0);
  });
});

describe("remoção de professor com Excluir", () => {
  it("os planejamentos continuam no banco (relatórios usam o histórico)", async () => {
    await concluir(u.lucas!, JARDIM1, "2026-12-07", INGLES, "Colors", { linguagens_amor: ["tempo_qualidade"] });
    await concluir(u.marina!, JARDIM1, "2026-12-08", POLIVALENTE, "Formas geométricas", { linguagens_amor: ["presentes"] });
    await b.rpc(u.diretor!, "remover_usuario", { p_usuario: u.lucas, p_destino: "excluir" });
    expect(await b.contar("select * from public.blocos where professor_id = $1 and excluido_em is not null", [u.lucas])).toBeGreaterThan(0);
  });
});

describe("relatório de entregas", () => {
  it("conta por professor e marca não entregue quando o prazo venceu", async () => {
    const r = await linhas<{ professor: string; antecipado: number; nao_entregue: number }>(
      u.diretor!, "select professor, antecipado, nao_entregue from public.relatorio_entregas('2026-01-01', '2099-12-31')",
    );
    // Lucas foi removido e não aparece; Beatriz tem o período do F1 vencido (prazo 01/11) sem entrega
    expect(r.map((x) => x.professor)).toEqual(["Beatriz", "Marina"]);
    expect(r.find((x) => x.professor === "Beatriz")).toMatchObject({ nao_entregue: 1 });
    expect(r.find((x) => x.professor === "Marina")).toMatchObject({ nao_entregue: 0 });
  });

  it("Coordenação vê só a sua etapa; professor não acessa", async () => {
    const r = await linhas<{ professor: string }>(u.coordEI!, "select professor from public.relatorio_entregas('2026-01-01', '2099-12-31')");
    expect(r.map((x) => x.professor)).toEqual(["Marina"]);
    await expect(linhas(u.marina!, "select * from public.relatorio_entregas('2026-01-01', '2099-12-31')")).rejects.toThrow(/gestão escolar/);
  });
});
