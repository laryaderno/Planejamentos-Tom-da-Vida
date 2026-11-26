/** Horários de PL (entrega fora do PL) e períodos de entrega personalizados por turma. */
import { beforeAll, describe, expect, it } from "vitest";
import { criarBanco, type Banco } from "./banco";

let b: Banco;
const u: Record<string, string> = {};
let EI = 0;
let F1 = 0;
let JARDIM1 = 0;
let JARDIM2 = 0;
let ANO1 = 0;

async function valor<T>(uid: string, sql: string, params: unknown[] = []): Promise<T> {
  const r = await b.como(uid, () => b.db.query<{ v: T }>(`select ${sql} as v`, params));
  return r.rows[0]!.v;
}
const vale = async (periodo: number, turma: number) =>
  (await b.db.query<{ v: boolean }>("select public.periodo_vale_para_turma($1, $2) as v", [periodo, turma])).rows[0]!.v;
const salvarPeriodo = (uid: string, inicio: string, fim: string, prazo: string, etapa: number | null, turmas: string | null) =>
  valor<number>(uid, "public.salvar_periodo(null, $1, $2, $3, $4, $5::bigint[])", [inicio, fim, prazo, etapa, turmas]);

beforeAll(async () => {
  b = await criarBanco();
  EI = await b.id("etapas", "Educação Infantil");
  F1 = await b.id("etapas", "Ensino Fundamental I");
  JARDIM1 = await b.id("turmas", "Jardim 1");
  JARDIM2 = await b.id("turmas", "Jardim 2");
  ANO1 = await b.id("turmas", "1º Ano A");
  const POLIVALENTE = await b.id("disciplinas", "Polivalente (Regente)");
  const vincular = (usuario: string, etapa: number, turma: number | null, disc: number | null, regente = false) =>
    b.db.query("insert into public.vinculos (usuario_id, etapa_id, turma_id, disciplina_id, regente) values ($1, $2, $3, $4, $5)",
      [usuario, etapa, turma, disc, regente]);

  u.secretaria = await b.criarUsuario({ email: "sec@t.com", nome: "Secretaria", papel: "secretaria" });
  u.coordEI = await b.criarUsuario({ email: "coord@t.com", nome: "Coord EI", papel: "coordenador" });
  await vincular(u.coordEI, EI, null, null);
  u.coordF1 = await b.criarUsuario({ email: "coordf1@t.com", nome: "Coord F1", papel: "coordenador" });
  await vincular(u.coordF1, F1, null, null);
  u.marina = await b.criarUsuario({ email: "marina@t.com", nome: "Marina Alves", papel: "professor" });
  await vincular(u.marina, EI, JARDIM1, POLIVALENTE, true);
  u.beatriz = await b.criarUsuario({ email: "beatriz@t.com", nome: "Beatriz Lima", papel: "professor" });
  await vincular(u.beatriz, F1, ANO1, POLIVALENTE, true);
}, 60_000);

describe("horários de PL", () => {
  it("Coordenação da etapa do professor cadastra; de outra etapa, não", async () => {
    await b.rpc(u.coordEI!, "salvar_horarios_pl", {
      p_professor: u.marina,
      p_horarios: JSON.stringify([{ dia_semana: 2, hora_inicio: "13:00", hora_fim: "14:40" }]),
    });
    await expect(
      b.rpc(u.coordF1!, "salvar_horarios_pl", { p_professor: u.marina, p_horarios: "[]" }),
    ).rejects.toThrow(/permissão/);
    expect(await b.contar("select * from public.horarios_pl where usuario_id = $1", [u.marina])).toBe(1);
  });

  it("recusa horários sobrepostos no mesmo dia", async () => {
    await expect(
      b.rpc(u.secretaria!, "salvar_horarios_pl", {
        p_professor: u.marina,
        p_horarios: JSON.stringify([
          { dia_semana: 3, hora_inicio: "13:00", hora_fim: "14:00" },
          { dia_semana: 3, hora_inicio: "13:30", hora_fim: "15:00" },
        ]),
      }),
    ).rejects.toThrow(/sobrepostos/);
  });

  it("entrega dentro do PL, fora do PL e de professor sem PL", async () => {
    const periodo = await salvarPeriodo(u.secretaria!, "2026-12-07", "2026-12-11", "2026-12-04", EI, null);
    // Terça 01/12 às 13:30 (Campo Grande, UTC-4) = 17:30 UTC → dentro do PL
    await b.db.query(
      "insert into public.entregas (periodo_id, professor_id, turma_id, entregue_em, situacao) values ($1, $2, $3, '2026-12-01 17:30+00', 'antecipado')",
      [periodo, u.marina, JARDIM1],
    );
    // Terça 01/12 às 20:00 local → fora do PL
    await b.db.query(
      "insert into public.entregas (periodo_id, professor_id, turma_id, entregue_em, situacao) values ($1, $2, $3, '2026-12-02 00:00+00', 'antecipado')",
      [periodo, u.marina, JARDIM2],
    );
    const r = await b.db.query<{ turma_id: number; fora_do_pl: boolean | null }>(
      "select turma_id, fora_do_pl from public.entregas where periodo_id = $1 order by turma_id", [periodo],
    );
    expect(r.rows.find((x) => Number(x.turma_id) === JARDIM1)!.fora_do_pl).toBe(false);
    expect(r.rows.find((x) => Number(x.turma_id) === JARDIM2)!.fora_do_pl).toBe(true);

    const p2 = await salvarPeriodo(u.secretaria!, "2026-12-07", "2026-12-11", "2026-12-04", F1, null);
    await b.db.query(
      "insert into public.entregas (periodo_id, professor_id, turma_id, entregue_em, situacao) values ($1, $2, $3, now(), 'no_prazo')",
      [p2, u.beatriz, ANO1],
    );
    const sem = await b.db.query<{ f: boolean | null }>("select fora_do_pl as f from public.entregas where professor_id = $1", [u.beatriz]);
    expect(sem.rows[0]!.f).toBeNull();
  });

  it("professor vê só o próprio PL", async () => {
    await b.db.exec("grant select on public.horarios_pl to authenticated");
    expect(await b.como(u.beatriz!, () => b.contar("select * from public.horarios_pl"))).toBe(0);
    expect(await b.como(u.marina!, () => b.contar("select * from public.horarios_pl"))).toBe(1);
  });
});

describe("período personalizado", () => {
  it("vale só para as turmas escolhidas, de etapas diferentes", async () => {
    const p = await salvarPeriodo(u.secretaria!, "2027-02-01", "2027-02-05", "2027-01-29", null, `{${JARDIM1},${ANO1}}`);
    expect(await vale(p, JARDIM1)).toBe(true);
    expect(await vale(p, ANO1)).toBe(true);
    expect(await vale(p, JARDIM2)).toBe(false);
  });

  it("não deixa uma turma ter dois períodos nas mesmas datas", async () => {
    await expect(salvarPeriodo(u.secretaria!, "2027-02-03", "2027-02-10", "2027-02-01", EI, null)).rejects.toThrow(/Jardim 1/);
    // Jardim 2 não está no personalizado: pode ter o seu
    const p = await salvarPeriodo(u.secretaria!, "2027-02-01", "2027-02-05", "2027-01-29", null, `{${JARDIM2}}`);
    expect(await vale(p, JARDIM2)).toBe(true);
  });

  it("precisa de pelo menos uma turma e não mistura com etapa", async () => {
    await expect(salvarPeriodo(u.secretaria!, "2027-03-01", "2027-03-05", "2027-02-26", null, "{}")).rejects.toThrow(/pelo menos uma turma/);
    await expect(salvarPeriodo(u.secretaria!, "2027-03-01", "2027-03-05", "2027-02-26", EI, `{${JARDIM1}}`)).rejects.toThrow(/não tem etapa/);
  });

  it("período sem turmas escolhidas segue a regra da etapa", async () => {
    const p = await salvarPeriodo(u.secretaria!, "2027-04-05", "2027-04-09", "2027-04-02", EI, null);
    expect(await vale(p, JARDIM1)).toBe(true);
    expect(await vale(p, ANO1)).toBe(false);
  });
});
