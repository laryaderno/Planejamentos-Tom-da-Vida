/** Cronograma de Avaliação: agenda (gestão) e cadastro do conteúdo (professor). */
import { beforeAll, describe, expect, it } from "vitest";
import { criarBanco, type Banco } from "./banco";

let b: Banco;
const u: Record<string, string> = {};
let JARDIM1 = 0;
let ANO1 = 0;
let POLIVALENTE = 0;
let INGLES = 0;
let AV = 0;

async function valor<T>(uid: string, sql: string, params: unknown[] = []): Promise<T> {
  const r = await b.como(uid, () => b.db.query<{ v: T }>(`select ${sql} as v`, params));
  return r.rows[0]!.v;
}
const agendar = (uid: string, turma: number, disc: number, data: string, id: number | null = null, tipo = "bimestral") =>
  valor<number>(uid, "public.agendar_avaliacao($1, $2, $3::smallint, $4, 3::smallint, 2026::smallint, $5)", [id, turma, disc, tipo, data]);
const cadastrar = (uid: string, id: number, conteudo: string) =>
  valor(uid, "public.cadastrar_avaliacao($1, $2, $3, $4)", [id, conteudo, "https://youtu.be/x", "Trazer cartaz"]);

beforeAll(async () => {
  b = await criarBanco();
  const EI = await b.id("etapas", "Educação Infantil");
  const F1 = await b.id("etapas", "Ensino Fundamental I");
  JARDIM1 = await b.id("turmas", "Jardim 1");
  ANO1 = await b.id("turmas", "1º Ano A");
  POLIVALENTE = await b.id("disciplinas", "Polivalente (Regente)");
  INGLES = await b.id("disciplinas", "Inglês");
  const vincular = (usuario: string, etapa: number, turma: number | null, disc: number | null, regente = false) =>
    b.db.query("insert into public.vinculos (usuario_id, etapa_id, turma_id, disciplina_id, regente) values ($1, $2, $3, $4, $5)",
      [usuario, etapa, turma, disc, regente]);

  u.secretaria = await b.criarUsuario({ email: "sec@t.com", nome: "Secretaria", papel: "secretaria" });
  u.coordEI = await b.criarUsuario({ email: "coord@t.com", nome: "Coord EI", papel: "coordenador" });
  await vincular(u.coordEI, EI, null, null);
  u.girlaine = await b.criarUsuario({ email: "gi@t.com", nome: "Girlaine", papel: "professor" });
  await vincular(u.girlaine, F1, ANO1, POLIVALENTE, true);
  u.camila = await b.criarUsuario({ email: "ca@t.com", nome: "Camila", papel: "professor" });
  await vincular(u.camila, F1, ANO1, INGLES);
  u.marina = await b.criarUsuario({ email: "ma@t.com", nome: "Marina", papel: "professor" });
  await vincular(u.marina, EI, JARDIM1, POLIVALENTE, true);
  await b.db.exec("grant select on public.avaliacoes to authenticated");
}, 60_000);

describe("agenda das avaliações", () => {
  it("Secretaria agenda a data; uma por disciplina, tipo e bimestre", async () => {
    AV = Number(await agendar(u.secretaria!, ANO1, INGLES, "2026-09-17"));
    await expect(agendar(u.secretaria!, ANO1, INGLES, "2026-09-18")).rejects.toThrow(/já tem avaliação agendada/);
    // A mensal do mesmo bimestre é outra avaliação
    expect(Number(await agendar(u.secretaria!, ANO1, INGLES, "2026-08-20", null, "mensal"))).toBeGreaterThan(0);
  });

  it("mudar a data mantém o conteúdo", async () => {
    await cadastrar(u.camila!, AV, "My school - pages 100 to 115");
    await agendar(u.secretaria!, ANO1, INGLES, "2026-09-16", AV);
    const r = await b.db.query<{ data: string; conteudo: string }>("select data::text as data, conteudo from public.avaliacoes where id = $1", [AV]);
    expect(r.rows[0]).toEqual({ data: "2026-09-16", conteudo: "My school - pages 100 to 115" });
  });

  it("só disciplina com professor vinculado à turma", async () => {
    await expect(agendar(u.secretaria!, JARDIM1, INGLES, "2026-09-17")).rejects.toThrow(/não tem professor vinculado/);
  });

  it("Coordenação só agenda na sua etapa; professor não agenda", async () => {
    expect(Number(await agendar(u.coordEI!, JARDIM1, POLIVALENTE, "2026-09-14"))).toBeGreaterThan(0);
    await expect(agendar(u.coordEI!, ANO1, POLIVALENTE, "2026-09-14")).rejects.toThrow(/permissão/);
    await expect(agendar(u.girlaine!, ANO1, POLIVALENTE, "2026-09-14")).rejects.toThrow(/Secretaria, a Coordenação ou a Direção/);
  });
});

describe("cadastrar avaliação", () => {
  it("só o professor da disciplina naquela turma cadastra", async () => {
    await expect(cadastrar(u.girlaine!, AV, "x")).rejects.toThrow(/professor da disciplina/);
    await expect(cadastrar(u.marina!, AV, "x")).rejects.toThrow(/professor da disciplina/);
  });

  it("conteúdo é obrigatório", async () => {
    await expect(cadastrar(u.camila!, AV, "   ")).rejects.toThrow(/Informe o conteúdo/);
  });

  it("quem vê a turma vê o cronograma", async () => {
    expect(await b.como(u.girlaine!, () => b.contar("select * from public.avaliacoes where turma_id = $1", [ANO1]))).toBe(2);
    expect(await b.como(u.marina!, () => b.contar("select * from public.avaliacoes where turma_id = $1", [ANO1]))).toBe(0);
  });
});

describe("professores da turma", () => {
  it("professor vê quem leciona cada disciplina na sua turma; de outra turma, não", async () => {
    const r = await b.como(u.camila!, () =>
      b.db.query<{ nome: string; regente: boolean }>("select nome, regente from public.professores_da_turma($1) order by nome", [ANO1]),
    );
    expect(r.rows).toEqual([{ nome: "Camila", regente: false }, { nome: "Girlaine", regente: true }]);
    expect(await b.como(u.marina!, () => b.contar("select * from public.professores_da_turma($1)", [ANO1]))).toBe(0);
  });
});

describe("aprovação das avaliações", () => {
  const notif = (uid: string, tipo: string) =>
    b.db.query<{ titulo: string; mensagem: string }>("select titulo, mensagem from public.notificacoes where usuario_id = $1 and tipo = $2 order by id", [uid, tipo]).then((r) => r.rows);
  const aprov = async () =>
    (await b.db.query<{ aprovacao: string | null }>("select aprovacao from public.avaliacoes where id = $1", [AV])).rows[0]!.aprovacao;

  it("gestão não cadastra o conteúdo — só o professor", async () => {
    await expect(cadastrar(u.secretaria!, AV, "x")).rejects.toThrow(/professor da disciplina/);
  });

  it("ao cadastrar, a Coordenação da etapa (ou a Secretaria) é avisada", async () => {
    await cadastrar(u.camila!, AV, "My school - pages 100 to 116");
    // 1º Ano A é do Fundamental I, sem Coordenação aqui: vai para a Secretaria
    const n = (await notif(u.secretaria!, "avaliacao_pendente")).at(-1);
    expect(n!.titulo).toBe("Avaliação para aprovar");
    expect(n!.mensagem).toMatch(/^Camila cadastrou a Inglês · 1º Ano A · avaliação bimestral do 3º bimestre \(16\/09\/2026\)\.$/);
  });

  it("Revisar exige observação e avisa o professor; ao salvar de novo, quem pediu é avisado", async () => {
    await expect(valor(u.secretaria!, "public.avaliar_avaliacao($1, 'revisar', ' ')", [AV])).rejects.toThrow(/precisa revisar/);
    await valor(u.secretaria!, "public.avaliar_avaliacao($1, 'revisar', 'Incluir as páginas.')", [AV]);
    expect(await aprov()).toBe("revisar");
    const [r] = await notif(u.camila!, "avaliacao_revisar");
    expect(r!.mensagem).toMatch(/Incluir as páginas\.$/);
    await cadastrar(u.camila!, AV, "My school - pages 100 to 116 (revisado)");
    expect(await aprov()).toBeNull();
    const [feita] = await notif(u.secretaria!, "avaliacao_revisada");
    expect(feita!.titulo).toBe("Avaliação revisada");
  });

  it("Aprovar avisa o professor; alterar depois volta a aguardar", async () => {
    await valor(u.secretaria!, "public.avaliar_avaliacao($1, 'aprovado', null)", [AV]);
    expect(await aprov()).toBe("aprovado");
    expect(await notif(u.camila!, "avaliacao_aprovada")).toHaveLength(1);
    await cadastrar(u.camila!, AV, "Outra versão");
    expect(await aprov()).toBeNull();
    await valor(u.secretaria!, "public.avaliar_avaliacao($1, 'aprovado', null)", [AV]);
  });

  it("não aprova avaliação sem conteúdo; professor não aprova", async () => {
    const vazia = Number(await agendar(u.secretaria!, ANO1, POLIVALENTE, "2026-09-14"));
    await expect(valor(u.secretaria!, "public.avaliar_avaliacao($1, 'aprovado', null)", [vazia])).rejects.toThrow(/ainda não cadastrou/);
    await expect(valor(u.camila!, "public.avaliar_avaliacao($1, 'aprovado', null)", [AV])).rejects.toThrow(/Coordenação, a Secretaria ou a Direção/);
  });

  it("aprovada aparece no banco para professores da mesma etapa, não de outra", async () => {
    u.outra = await b.criarUsuario({ email: "outra@t.com", nome: "Outra F1", papel: "professor" });
    const F1 = await b.id("etapas", "Ensino Fundamental I");
    const ANO2 = await b.id("turmas", "2º Ano A");
    await b.db.query("insert into public.vinculos (usuario_id, etapa_id, turma_id, disciplina_id, regente) values ($1, $2, $3, $4, true)", [u.outra, F1, ANO2, POLIVALENTE]);
    expect(await b.como(u.outra!, () => b.contar("select * from public.avaliacoes where id = $1", [AV]))).toBe(1);
    expect(await b.como(u.marina!, () => b.contar("select * from public.avaliacoes where id = $1", [AV]))).toBe(0);
  });
});

describe("calendário do ano de uma vez", () => {
  it("cria, muda datas e remove (só as sem conteúdo)", async () => {
    const itens = (data: string | null) => JSON.stringify([
      { disciplina_id: POLIVALENTE, tipo: "mensal", bimestre: 1, data },
      { disciplina_id: INGLES, tipo: "mensal", bimestre: 1, data: "2027-03-16" },
    ]);
    const n = await valor<number>(u.secretaria!, "public.agendar_avaliacoes($1, 2027::smallint, $2)", [ANO1, itens("2027-03-15")]);
    expect(n).toBe(2);
    expect(await valor<number>(u.secretaria!, "public.agendar_avaliacoes($1, 2027::smallint, $2)", [ANO1, itens("2027-03-15")])).toBe(0);
    expect(await valor<number>(u.secretaria!, "public.agendar_avaliacoes($1, 2027::smallint, $2)", [ANO1, itens(null)])).toBe(1);
    expect(await b.contar("select * from public.avaliacoes where turma_id = $1 and ano = 2027", [ANO1])).toBe(1);
  });

  it("Coordenação de outra etapa e professor não agendam", async () => {
    await expect(valor(u.coordEI!, "public.agendar_avaliacoes($1, 2027::smallint, '[]')", [ANO1])).rejects.toThrow(/permissão/);
    await expect(valor(u.camila!, "public.agendar_avaliacoes($1, 2027::smallint, '[]')", [ANO1])).rejects.toThrow(/Secretaria, a Coordenação ou a Direção/);
  });
});
