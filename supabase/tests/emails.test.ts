/** Fase 5: lembretes ao professor e alerta à Coordenação (fila de e-mails e notificações). */
import { beforeAll, describe, expect, it } from "vitest";
import { criarBanco, type Banco } from "./banco";

let b: Banco;
const u: Record<string, string> = {};
let EI = 0;
let F1 = 0;
let JARDIM1 = 0;
let JARDIM2 = 0;
let ANO1 = 0;
let POLIVALENTE = 0;

async function vincular(usuario: string, etapa: number, turma: number | null, disciplina: number | null, regente = false) {
  await b.db.query(
    "insert into public.vinculos (usuario_id, etapa_id, turma_id, disciplina_id, regente) values ($1, $2, $3, $4, $5)",
    [usuario, etapa, turma, disciplina, regente],
  );
}

/** Roda a preparação como o servidor (sem usuário logado) para o dia informado. */
async function preparar(hoje: string): Promise<number> {
  const r = await b.db.query<{ n: number }>("select public.preparar_envios($1::date) as n", [hoje]);
  return r.rows[0]!.n;
}

const emails = (sql = "true", params: unknown[] = []) =>
  b.db.query<{ tipo: string; assunto: string; texto: string; email: string }>(
    `select tipo, assunto, texto, email from public.emails where ${sql} order by id`, params,
  ).then((r) => r.rows);

beforeAll(async () => {
  b = await criarBanco();
  await b.db.exec("grant select on all tables in schema public to authenticated");
  EI = await b.id("etapas", "Educação Infantil");
  F1 = await b.id("etapas", "Ensino Fundamental I");
  JARDIM1 = await b.id("turmas", "Jardim 1");
  JARDIM2 = await b.id("turmas", "Jardim 2");
  ANO1 = await b.id("turmas", "1º Ano A");
  POLIVALENTE = await b.id("disciplinas", "Polivalente (Regente)");

  u.secretaria = await b.criarUsuario({ email: "sec@t.com", nome: "Secretaria", papel: "secretaria" });
  u.coordEI = await b.criarUsuario({ email: "coord.ei@t.com", nome: "Coord EI", papel: "coordenador" });
  await vincular(u.coordEI, EI, null, null);
  u.marina = await b.criarUsuario({ email: "marina@t.com", nome: "Marina Alves", papel: "professor" });
  await vincular(u.marina, EI, JARDIM1, POLIVALENTE, true);
  await vincular(u.marina, EI, JARDIM2, POLIVALENTE, true);
  u.beatriz = await b.criarUsuario({ email: "beatriz@t.com", nome: "Beatriz Lima", papel: "professor" });
  await vincular(u.beatriz, F1, ANO1, POLIVALENTE, true);

  // Período da Educação Infantil: 07 a 11/12, prazo sexta 04/12; do Fundamental I: prazo 04/12 também
  await b.db.query("insert into public.periodos_entrega (inicio, fim, prazo, etapa_id) values ('2026-12-07', '2026-12-11', '2026-12-04', $1)", [EI]);
  await b.db.query("insert into public.periodos_entrega (inicio, fim, prazo, etapa_id) values ('2026-12-07', '2026-12-18', '2026-12-04', $1)", [F1]);
}, 60_000);

describe("lembretes ao professor", () => {
  it("3 dias antes: um e-mail por professor, listando as turmas pendentes", async () => {
    expect(await preparar("2026-12-01")).toBe(2);
    const doDia = await emails("tipo = 'lembrete'");
    expect(doDia.map((e) => e.email).sort()).toEqual(["beatriz@t.com", "marina@t.com"]);
    const marina = doDia.find((e) => e.email === "marina@t.com")!;
    expect(marina.assunto).toBe("Prazo de entrega do planejamento em 3 dias");
    expect(marina.texto).toMatch(/Faltam 3 dias para entregar o planejamento de Jardim 1, Jardim 2/);
  });

  it("rodar de novo no mesmo dia não duplica", async () => {
    expect(await preparar("2026-12-01")).toBe(0);
    expect(await b.contar("select * from public.emails")).toBe(2);
  });

  it("dia que não está na configuração não gera lembrete", async () => {
    expect(await preparar("2026-12-02")).toBe(0);
  });

  it("quem já entregou não recebe; no dia do prazo o texto muda", async () => {
    const periodoEI = Number((await b.db.query<{ id: number }>("select id from public.periodos_entrega where etapa_id = $1", [EI])).rows[0]!.id);
    await b.db.query(
      "insert into public.entregas (periodo_id, professor_id, turma_id, entregue_em, situacao) values ($1, $2, $3, now(), 'antecipado')",
      [periodoEI, u.marina, JARDIM1],
    );
    expect(await preparar("2026-12-04")).toBe(2);
    const hoje = await emails("tipo = 'lembrete' and assunto like '%hoje'");
    const marina = hoje.find((e) => e.email === "marina@t.com")!;
    expect(marina.texto).toMatch(/^Hoje é o último dia para entregar o planejamento de Jardim 2 \(/);
  });

  it("cada e-mail também vira notificação no sistema", async () => {
    expect(await b.contar("select * from public.notificacoes where usuario_id = $1 and tipo = 'lembrete'", [u.marina])).toBe(2);
  });
});

describe("alerta à Coordenação", () => {
  it("no dia seguinte ao prazo, com o assunto da especificação", async () => {
    await preparar("2026-12-05");
    const alertas = await emails("tipo = 'alerta_coordenacao'");
    // Marina/Jardim 2 sem entrega → Coordenação da EI; Beatriz (F1, sem Coordenação) → Secretaria
    expect(alertas.map((a) => [a.email, a.assunto])).toEqual(
      expect.arrayContaining([
        ["coord.ei@t.com", "TURMA JARDIM 2 DE PROFESSOR MARINA ALVES – PLANEJAMENTO NÃO IDENTIFICADO"],
        ["sec@t.com", "TURMA 1º ANO A DE PROFESSOR BEATRIZ LIMA – PLANEJAMENTO NÃO IDENTIFICADO"],
      ]),
    );
    expect(alertas).toHaveLength(2); // Jardim 1 foi entregue
  });

  it("não repete nos dias seguintes e recupera se a rotina falhou no dia certo", async () => {
    expect(await preparar("2026-12-06")).toBe(0);
    // Novo período vencido há 3 dias, nunca processado: o alerta sai mesmo assim
    await b.db.query("insert into public.periodos_entrega (inicio, fim, prazo, etapa_id) values ('2026-12-14', '2026-12-18', '2026-12-03', $1)", [EI]);
    expect(await preparar("2026-12-06")).toBeGreaterThan(0);
  });

  it("desligar os e-mails para a fila", async () => {
    await b.db.query("update public.config_notificacoes set emails_ativos = false");
    await b.db.query("insert into public.periodos_entrega (inicio, fim, prazo, etapa_id) values ('2026-12-21', '2026-12-23', '2026-12-18', $1)", [EI]);
    expect(await preparar("2026-12-15")).toBe(0);
    await b.db.query("update public.config_notificacoes set emails_ativos = true");
  });
});

describe("permissões", () => {
  it("professor e Coordenação não disparam a rotina nem leem o histórico de outros", async () => {
    await expect(b.como(u.coordEI!, () => b.db.query("select public.preparar_envios()"))).rejects.toThrow(/permission denied/);
    expect(await b.como(u.marina!, () => b.contar("select * from public.emails where destinatario_id <> $1", [u.marina]))).toBe(0);
    expect(await b.como(u.secretaria!, () => b.contar("select * from public.emails"))).toBeGreaterThan(3);
  });

  it("só Direção e Secretaria mudam a configuração", async () => {
    await expect(b.rpc(u.coordEI!, "salvar_config_notificacoes", { p_ativos: true, p_dias: "{5,0}", p_alerta: true }))
      .rejects.toThrow(/Direção ou a Secretaria/);
    await b.rpc(u.secretaria!, "salvar_config_notificacoes", { p_ativos: true, p_dias: "{0,5,5}", p_alerta: false });
    const r = await b.db.query<{ d: string; a: boolean }>("select lembrete_dias::text as d, alerta_coordenacao as a from public.config_notificacoes");
    expect(r.rows[0]).toEqual({ d: "{5,0}", a: false });
  });
});
