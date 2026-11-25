/** Dias sem aula: feriados nacionais, permissões e efeito nas entregas. */
import { beforeAll, describe, expect, it } from "vitest";
import { criarBanco, type Banco } from "./banco";

let b: Banco;
const u: Record<string, string> = {};
let EI = 0;
let JARDIM1 = 0;
let POLIVALENTE = 0;

async function valor<T>(uid: string, sql: string, params: unknown[] = []): Promise<T> {
  const r = await b.como(uid, () => b.db.query<{ v: T }>(`select ${sql} as v`, params));
  return r.rows[0]!.v;
}

async function concluirDia(data: string) {
  const plan = Number(await valor(u.regente!, `public.abrir_planejamento($1, '${data}', 'matutino')`, [JARDIM1]));
  const bloco = Number(await valor(u.regente!, "public.criar_bloco($1, $2, '07:30', '11:30')", [plan, POLIVALENTE]));
  await valor(u.regente!, "public.salvar_bloco($1, null, $2)", [
    bloco,
    JSON.stringify({ conteudo: "Aula", linguagens_amor: ["presentes"], status: "verde" }),
  ]);
}

beforeAll(async () => {
  b = await criarBanco();
  await b.db.exec("grant select on all tables in schema public to authenticated");
  EI = await b.id("etapas", "Educação Infantil");
  JARDIM1 = await b.id("turmas", "Jardim 1");
  POLIVALENTE = await b.id("disciplinas", "Polivalente (Regente)");
  u.diretor = await b.criarUsuario({ email: "dir@t.com", nome: "Diretora", papel: "diretor" });
  u.secretaria = await b.criarUsuario({ email: "sec@t.com", nome: "Secretaria", papel: "secretaria" });
  u.coord = await b.criarUsuario({ email: "c@t.com", nome: "Coord", papel: "coordenador" });
  u.regente = await b.criarUsuario({ email: "r@t.com", nome: "Marina", papel: "professor" });
  await b.db.query(
    "insert into public.vinculos (usuario_id, etapa_id, turma_id, disciplina_id, regente) values ($1, $2, $3, $4, true)",
    [u.regente, EI, JARDIM1, POLIVALENTE],
  );
}, 60_000);

describe("feriados nacionais", () => {
  it("calcula a Páscoa e os feriados móveis", async () => {
    const r = await b.db.query<{ p26: string; p27: string }>("select public.pascoa(2026)::text as p26, public.pascoa(2027)::text as p27");
    expect(r.rows[0]).toEqual({ p26: "2026-04-05", p27: "2027-03-28" });
    const f = await b.db.query<{ data: string }>("select data::text from public.feriados_nacionais(2027) where descricao = 'Corpus Christi'");
    expect(f.rows[0]!.data).toBe("2027-05-27");
  });

  it("só Direção e Secretaria importam; repetir não duplica", async () => {
    await expect(valor(u.coord!, "public.importar_feriados_nacionais(2027)")).rejects.toThrow(/Direção ou a Secretaria/);
    expect(await valor<number>(u.secretaria!, "public.importar_feriados_nacionais(2027)")).toBe(13);
    expect(await valor<number>(u.secretaria!, "public.importar_feriados_nacionais(2027)")).toBe(0);
  });

  it("Secretaria não remove dia cadastrado pela Direção", async () => {
    const id = Number(await valor(u.diretor!, "public.salvar_dia_sem_aula(null, '2026-12-23', 'Recesso')"));
    await expect(valor(u.secretaria!, "public.remover_dia_sem_aula($1)", [id])).rejects.toThrow(/Apenas um Diretor/);
  });
});

describe("efeito nas entregas", () => {
  it("dia sem aula não conta como dia útil de antecedência", async () => {
    // prazo sexta 18/12; entregue quarta 16/12 → quinta e sexta = 2 dias → antecipado
    expect(await valor<string>(u.diretor!, "public.situacao_da_entrega('2026-12-16', '2026-12-18')")).toBe("antecipado");
    await valor(u.diretor!, "public.salvar_dia_sem_aula(null, '2026-12-17', 'Formação de professores')");
    expect(await valor<string>(u.diretor!, "public.situacao_da_entrega('2026-12-16', '2026-12-18')")).toBe("no_prazo");
  });

  it("dia sem aula só da etapa vale para aquela etapa", async () => {
    await valor(u.diretor!, "public.salvar_dia_sem_aula(null, '2026-12-11', 'Festa da Educação Infantil', $1)", [EI]);
    expect(await valor<boolean>(u.diretor!, "public.ha_aula('2026-12-11', $1)", [EI])).toBe(false);
    expect(await valor<boolean>(u.diretor!, "public.ha_aula('2026-12-11', 2::smallint)")).toBe(true);
  });

  it("Regente entrega o período sem planejar o feriado", async () => {
    // semana de 07 a 11/12; 11/12 é dia sem aula da Educação Infantil
    await b.rpc(u.secretaria!, "salvar_periodo", { p_id: null, p_inicio: "2026-12-07", p_fim: "2026-12-11", p_prazo: "2099-01-01" });
    for (const d of ["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10"]) await concluirDia(d);
    expect(await b.contar("select * from public.entregas where professor_id = $1", [u.regente])).toBe(1);
  });

  it("feriado cadastrado depois completa o período (sem notificar)", async () => {
    await b.rpc(u.secretaria!, "salvar_periodo", { p_id: null, p_inicio: "2026-12-14", p_fim: "2026-12-15", p_prazo: "2099-01-01" });
    await concluirDia("2026-12-14");
    expect(await b.contar("select * from public.entregas where professor_id = $1", [u.regente])).toBe(1);
    await valor(u.secretaria!, "public.salvar_dia_sem_aula(null, '2026-12-15', 'Recesso')");
    expect(await b.contar("select * from public.entregas where professor_id = $1", [u.regente])).toBe(2);
  });
});
