/** Grade horária: permissões, validações, vigência e regra de entrega com a grade. */
import { beforeAll, describe, expect, it } from "vitest";
import { criarBanco, type Banco } from "./banco";

let b: Banco;
const u: Record<string, string> = {};
let EI = 0;
let F1 = 0;
let JARDIM1 = 0;
let JARDIM2 = 0;
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

const aula = (dia: number, ini: string, fim: string, disciplina: number, professor: string) => ({
  dia_semana: dia, hora_inicio: ini, hora_fim: fim, disciplina_id: disciplina, professor_id: professor,
});

async function concluir(prof: string, data: string, disciplina: number, ini: string, fim: string) {
  const plan = Number(await valor(prof, `public.abrir_planejamento($1, '${data}', 'matutino')`, [JARDIM1]));
  const bloco = Number(await valor(prof, `public.criar_bloco($1, $2, '${ini}', '${fim}')`, [plan, disciplina]));
  await valor(prof, "public.salvar_bloco($1, null, $2)", [
    bloco,
    JSON.stringify({ conteudo: "Aula", linguagens_amor: ["presentes"], status: "verde" }),
  ]);
}

beforeAll(async () => {
  b = await criarBanco();
  await b.db.exec("grant select on all tables in schema public to authenticated");
  EI = await b.id("etapas", "Educação Infantil");
  F1 = await b.id("etapas", "Ensino Fundamental I");
  JARDIM1 = await b.id("turmas", "Jardim 1");
  JARDIM2 = await b.id("turmas", "Jardim 2");
  POLIVALENTE = await b.id("disciplinas", "Polivalente (Regente)");
  INGLES = await b.id("disciplinas", "Inglês");

  u.diretor = await b.criarUsuario({ email: "d@t.com", nome: "Diretora", papel: "diretor" });
  u.coordEI = await b.criarUsuario({ email: "c@t.com", nome: "Coord EI", papel: "coordenador" });
  await vincular(u.coordEI, EI, null, null);
  u.coordF1 = await b.criarUsuario({ email: "cf@t.com", nome: "Coord F1", papel: "coordenador" });
  await vincular(u.coordF1, F1, null, null);
  u.regente = await b.criarUsuario({ email: "r@t.com", nome: "Marina", papel: "professor" });
  await vincular(u.regente, EI, JARDIM1, POLIVALENTE, true);
  u.ingles = await b.criarUsuario({ email: "i@t.com", nome: "Lucas", papel: "professor" });
  await vincular(u.ingles, EI, JARDIM1, INGLES);
  await vincular(u.ingles, EI, JARDIM2, INGLES);
}, 60_000);

describe("montar a grade", () => {
  it("Coordenador monta a grade da sua etapa; de outra etapa, não", async () => {
    await b.rpc(u.coordEI!, "salvar_grade", {
      p_turma: JARDIM1,
      p_vigente_desde: "2026-12-01",
      p_aulas: [
        aula(1, "07:30", "09:30", POLIVALENTE, u.regente!), aula(1, "09:30", "10:20", INGLES, u.ingles!),
        aula(2, "07:30", "11:30", POLIVALENTE, u.regente!),
        aula(3, "07:30", "11:30", POLIVALENTE, u.regente!), aula(4, "07:30", "11:30", POLIVALENTE, u.regente!),
        aula(5, "07:30", "11:30", POLIVALENTE, u.regente!),
      ],
    });
    expect(await b.contar("select * from public.horarios where turma_id = $1", [JARDIM1])).toBe(6);
    await expect(b.rpc(u.coordF1!, "salvar_grade", { p_turma: JARDIM1, p_vigente_desde: "2026-12-01", p_aulas: [] }))
      .rejects.toThrow(/permissão/);
  });

  it("recusa professor sem vínculo com a disciplina na turma", async () => {
    await expect(b.rpc(u.coordEI!, "salvar_grade", {
      p_turma: JARDIM2, p_vigente_desde: "2026-12-01", p_aulas: [aula(1, "07:30", "08:20", POLIVALENTE, u.regente!)],
    })).rejects.toThrow(/não leciona essa disciplina/);
  });

  it("recusa horários sobrepostos na turma e o mesmo professor em duas turmas ao mesmo tempo", async () => {
    await expect(b.rpc(u.coordEI!, "salvar_grade", {
      p_turma: JARDIM2, p_vigente_desde: "2026-12-01",
      p_aulas: [aula(2, "08:00", "09:00", INGLES, u.ingles!), aula(2, "08:30", "09:30", INGLES, u.ingles!)],
    })).rejects.toThrow(/sobrepostos/);
    await expect(b.rpc(u.coordEI!, "salvar_grade", {
      p_turma: JARDIM2, p_vigente_desde: "2026-12-01", p_aulas: [aula(1, "09:45", "10:30", INGLES, u.ingles!)],
    })).rejects.toThrow(/Lucas já tem aula em Jardim 1/);
  });

  it("nova versão vale a partir da data; a anterior termina na véspera", async () => {
    await b.rpc(u.diretor!, "salvar_grade", {
      p_turma: JARDIM2, p_vigente_desde: "2026-12-01", p_aulas: [aula(2, "07:30", "08:20", INGLES, u.ingles!)],
    });
    await b.rpc(u.diretor!, "salvar_grade", {
      p_turma: JARDIM2, p_vigente_desde: "2027-02-01", p_aulas: [aula(3, "07:30", "08:20", INGLES, u.ingles!)],
    });
    const r = await b.db.query<{ dia_semana: number; vigente_ate: string | null }>(
      "select dia_semana, vigente_ate::text from public.horarios where turma_id = $1 order by vigente_desde", [JARDIM2],
    );
    expect(r.rows).toEqual([{ dia_semana: 2, vigente_ate: "2027-01-31" }, { dia_semana: 3, vigente_ate: null }]);
  });

  it("Coordenador não altera grade definida pela Direção", async () => {
    await expect(b.rpc(u.coordEI!, "salvar_grade", { p_turma: JARDIM2, p_vigente_desde: "2027-03-01", p_aulas: [] }))
      .rejects.toThrow(/Apenas um Diretor/);
  });

  it("professor vê a grade completa das turmas em que leciona; outra etapa não vê", async () => {
    // Jardim 1 (6 aulas) + Jardim 2 (2 versões)
    expect(await b.como(u.ingles!, () => b.contar("select * from public.horarios"))).toBe(8);
    expect(await b.como(u.coordF1!, () => b.contar("select * from public.horarios"))).toBe(0);
  });
});

describe("entrega com a grade", () => {
  it("especialista só entrega quando conclui todas as aulas previstas na grade", async () => {
    // período de 07 a 11/12: Lucas tem Inglês só na segunda (07/12) no Jardim 1
    await b.rpc(u.diretor!, "salvar_periodo", { p_id: null, p_inicio: "2026-12-07", p_fim: "2026-12-11", p_prazo: "2099-01-01" });
    await concluir(u.ingles!, "2026-12-07", INGLES, "09:30", "10:20");
    expect(await b.contar("select * from public.entregas where professor_id = $1", [u.ingles])).toBe(1);
  });

  it("Regente com grade precisa de todos os dias previstos (descontados os dias sem aula)", async () => {
    await valor(u.diretor!, "public.salvar_dia_sem_aula(null, '2026-12-11', 'Recesso')");
    for (const d of ["2026-12-07", "2026-12-08", "2026-12-09"]) {
      await concluir(u.regente!, d, POLIVALENTE, d === "2026-12-07" ? "07:30" : "07:30", d === "2026-12-07" ? "09:30" : "11:30");
    }
    expect(await b.contar("select * from public.entregas where professor_id = $1", [u.regente])).toBe(0);
    await concluir(u.regente!, "2026-12-10", POLIVALENTE, "07:30", "11:30");
    expect(await b.contar("select * from public.entregas where professor_id = $1", [u.regente])).toBe(1);
  });
});
