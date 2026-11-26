/** Aprovação do planejamento (Aprovar / Revisar) e aviso de nova nota. */
import { beforeAll, describe, expect, it } from "vitest";
import { criarBanco, type Banco } from "./banco";

let b: Banco;
const u: Record<string, string> = {};
let JARDIM1 = 0;
let PLAN = 0;
let BLOCO = 0;

async function valor<T>(uid: string, sql: string, params: unknown[] = []): Promise<T> {
  const r = await b.como(uid, () => b.db.query<{ v: T }>(`select ${sql} as v`, params));
  return r.rows[0]!.v;
}
const salvar = (campos: object) => valor(u.regente!, "public.salvar_bloco($1, null, $2)", [BLOCO, JSON.stringify(campos)]);
const avaliar = (uid: string, decisao: string, obs: string | null = null) =>
  valor(uid, "public.avaliar_bloco($1, $2, $3)", [BLOCO, decisao, obs]);
const bloco = async () =>
  (await b.db.query<{ aprovacao: string | null; aprovacao_obs: string | null }>(
    "select aprovacao, aprovacao_obs from public.blocos where id = $1", [BLOCO],
  )).rows[0]!;
const notificacoes = (uid: string, tipo: string) =>
  b.db.query<{ titulo: string; mensagem: string; link: string }>(
    "select titulo, mensagem, link from public.notificacoes where usuario_id = $1 and tipo = $2 order by id", [uid, tipo],
  ).then((r) => r.rows);

beforeAll(async () => {
  b = await criarBanco();
  await b.db.exec("grant select, insert on public.notas to authenticated"); // no Supabase, vem por padrão
  const EI = await b.id("etapas", "Educação Infantil");
  const F1 = await b.id("etapas", "Ensino Fundamental I");
  JARDIM1 = await b.id("turmas", "Jardim 1");
  const POLIVALENTE = await b.id("disciplinas", "Polivalente (Regente)");
  const INGLES = await b.id("disciplinas", "Inglês");
  const vincular = (usuario: string, etapa: number, turma: number | null, disc: number | null, regente = false) =>
    b.db.query("insert into public.vinculos (usuario_id, etapa_id, turma_id, disciplina_id, regente) values ($1, $2, $3, $4, $5)",
      [usuario, etapa, turma, disc, regente]);

  u.diretora = await b.criarUsuario({ email: "dir@t.com", nome: "Helena Duarte", papel: "diretor" });
  u.coordEI = await b.criarUsuario({ email: "coord@t.com", nome: "Renata Prado", papel: "coordenador" });
  await vincular(u.coordEI, EI, null, null);
  u.coordF1 = await b.criarUsuario({ email: "coordf1@t.com", nome: "Coord F1", papel: "coordenador" });
  await vincular(u.coordF1, F1, null, null);
  u.regente = await b.criarUsuario({ email: "reg@t.com", nome: "Marina Alves", papel: "professor" });
  await vincular(u.regente, EI, JARDIM1, POLIVALENTE, true);
  u.ingles = await b.criarUsuario({ email: "ing@t.com", nome: "Lucas Ferreira", papel: "professor" });
  await vincular(u.ingles, EI, JARDIM1, INGLES);

  PLAN = Number(await valor(u.regente, "public.abrir_planejamento($1, '2026-12-01', 'matutino')", [JARDIM1]));
  BLOCO = Number(await valor(u.regente, "public.criar_bloco($1, $2, '07:30', '09:30')", [PLAN, POLIVALENTE]));
  await valor(u.ingles, "public.criar_bloco($1, $2, '09:30', '10:20')", [PLAN, INGLES]);
}, 60_000);

describe("Aprovar e Revisar", () => {
  it("não aprova um planejamento que ainda não foi concluído", async () => {
    await salvar({ conteudo: "Formas geométricas" });
    await expect(avaliar(u.coordEI!, "aprovado")).rejects.toThrow(/concluído/);
  });

  it("Revisar exige o que precisa ser revisto e avisa o professor", async () => {
    await expect(avaliar(u.coordEI!, "revisar", "  ")).rejects.toThrow(/precisa revisar/);
    await avaliar(u.coordEI!, "revisar", "Detalhar a avaliação.");
    expect(await bloco()).toEqual({ aprovacao: "revisar", aprovacao_obs: "Detalhar a avaliação." });
    const [n] = await notificacoes(u.regente!, "planejamento_revisar");
    expect(n!.titulo).toBe("Revisar planejamento de 01/12/2026");
    expect(n!.mensagem).toBe("Jardim 1: Renata Prado pediu revisão. Detalhar a avaliação.");
    expect(n!.link).toBe(`/planejamentos/${JARDIM1}/2026-12-01/matutino`);
  });

  it("quando o professor altera o bloco, volta a aguardar avaliação", async () => {
    await salvar({ avaliacao: "Observação da participação", linguagens_amor: ["tempo_qualidade"], status: "verde" });
    expect((await bloco()).aprovacao).toBeNull();
  });

  it("Aprovar avisa o professor", async () => {
    await avaliar(u.diretora!, "aprovado");
    expect((await bloco()).aprovacao).toBe("aprovado");
    const [n] = await notificacoes(u.regente!, "planejamento_aprovado");
    expect(n!.titulo).toBe("Planejamento de 01/12/2026 aprovado");
    expect(n!.mensagem).toBe("Jardim 1: aprovado por Helena Duarte.");
  });

  it("aparece no histórico do bloco", async () => {
    expect(await b.contar("select * from public.historico_blocos where bloco_id = $1 and campo = 'aprovacao'", [BLOCO])).toBe(3);
  });

  it("professor e Coordenação de outra etapa não avaliam", async () => {
    await expect(avaliar(u.regente!, "aprovado")).rejects.toThrow(/Coordenação, a Secretaria ou a Direção/);
    await expect(avaliar(u.coordF1!, "aprovado")).rejects.toThrow(/desta etapa/);
  });
});

describe("aviso de nova nota", () => {
  it("nota da Coordenação avisa os professores do planejamento", async () => {
    await b.como(u.coordEI!, () => b.db.query("insert into public.notas (planejamento_id, texto) values ($1, 'Ótima ideia a roda de conversa!')", [PLAN]));
    for (const prof of [u.regente!, u.ingles!]) {
      const [n] = await notificacoes(prof, "nota");
      expect(n!.titulo).toBe("Há uma nova nota em Planejamento de 01/12/2026");
      expect(n!.mensagem).toBe("Jardim 1 · Renata Prado: Ótima ideia a roda de conversa!");
    }
  });

  it("quem escreveu a nota não é avisado", async () => {
    await b.como(u.regente!, () => b.db.query("insert into public.notas (planejamento_id, texto) values ($1, 'Obrigada!')", [PLAN]));
    expect(await notificacoes(u.regente!, "nota")).toHaveLength(1);
    expect(await notificacoes(u.ingles!, "nota")).toHaveLength(2);
  });
});
