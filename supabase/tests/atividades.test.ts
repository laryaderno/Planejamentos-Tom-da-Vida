/** Banco de atividades: anexar, aprovar/recusar, visibilidade por etapa, arquivos e notificações. */
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
let BLOCO = 0;

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

/** Simula o envio do arquivo ao armazenamento, como o navegador faz. */
async function enviarArquivo(prof: string, nome: string) {
  const caminho = `${prof}/${nome}`;
  await b.como(prof, () => b.db.query("insert into storage.objects (bucket_id, name) values ('atividades', $1)", [caminho]));
  return caminho;
}

async function propor(prof: string, bloco: number, titulo: string, tema: string, caminho: string, tipo = "application/pdf", tamanho = 1000) {
  return Number(await valor(prof, "public.propor_atividade($1, $2, $3, $4, 'arquivo.pdf', $5, $6)", [bloco, titulo, tema, caminho, tipo, tamanho]));
}

const contarComo = (uid: string, sql: string, params: unknown[] = []) => b.como(uid, () => b.contar(sql, params));

beforeAll(async () => {
  b = await criarBanco();
  await b.db.exec("grant select on all tables in schema public to authenticated");
  EI = await b.id("etapas", "Educação Infantil");
  F1 = await b.id("etapas", "Ensino Fundamental I");
  JARDIM1 = await b.id("turmas", "Jardim 1");
  JARDIM2 = await b.id("turmas", "Jardim 2");
  ANO1 = await b.id("turmas", "1º Ano A");
  POLIVALENTE = await b.id("disciplinas", "Polivalente (Regente)");

  u.secretaria = await b.criarUsuario({ email: "s@t.com", nome: "Secretaria", papel: "secretaria" });
  u.coordEI = await b.criarUsuario({ email: "c@t.com", nome: "Coord EI", papel: "coordenador" });
  await vincular(u.coordEI, EI, null, null);
  u.coordF1 = await b.criarUsuario({ email: "cf@t.com", nome: "Coord F1", papel: "coordenador" });
  await vincular(u.coordF1, F1, null, null);
  u.marina = await b.criarUsuario({ email: "m@t.com", nome: "Marina", papel: "professor" });
  await vincular(u.marina, EI, JARDIM1, POLIVALENTE, true);
  u.colegaEI = await b.criarUsuario({ email: "j2@t.com", nome: "Colega Jardim 2", papel: "professor" });
  await vincular(u.colegaEI, EI, JARDIM2, POLIVALENTE, true);
  u.profF1 = await b.criarUsuario({ email: "f@t.com", nome: "Prof F1", papel: "professor" });
  await vincular(u.profF1, F1, ANO1, POLIVALENTE, true);

  const plan = Number(await valor(u.marina!, "public.abrir_planejamento($1, '2026-12-01', 'matutino')", [JARDIM1]));
  BLOCO = Number(await valor(u.marina!, "public.criar_bloco($1, $2, '07:30', '11:30')", [plan, POLIVALENTE]));
}, 60_000);

let PENDENTE = 0;

describe("anexar atividade", () => {
  it("professor só envia arquivo para a própria pasta", async () => {
    await expect(
      b.como(u.marina!, () => b.db.query("insert into storage.objects (bucket_id, name) values ('atividades', $1)", [`${u.profF1}/x.pdf`])),
    ).rejects.toThrow(/row-level security/);
  });

  it("recusa tipo de arquivo não aceito e arquivo grande demais", async () => {
    const c = await enviarArquivo(u.marina!, "a.exe");
    await expect(propor(u.marina!, BLOCO, "X", "Y", c, "application/x-msdownload")).rejects.toThrow(/Tipo de arquivo não aceito/);
    await expect(propor(u.marina!, BLOCO, "X", "Y", c, "application/pdf", 30 * 1024 * 1024)).rejects.toThrow(/limite de 20 MB/);
  });

  it("só o professor do bloco anexa", async () => {
    const c = await enviarArquivo(u.colegaEI!, "b.pdf");
    await expect(propor(u.colegaEI!, BLOCO, "X", "Y", c)).rejects.toThrow(/professor responsável/);
  });

  it("anexo fica pendente e avisa a Coordenação da etapa (não a de outra etapa)", async () => {
    const c = await enviarArquivo(u.marina!, "formas.pdf");
    PENDENTE = await propor(u.marina!, BLOCO, "Caça às formas", "Geometria", c);
    expect(await b.contar("select * from public.atividades where id = $1 and status = 'pendente'", [PENDENTE])).toBe(1);
    expect(await contarComo(u.coordEI!, "select * from public.notificacoes where tipo = 'atividade_pendente'")).toBe(1);
    expect(await contarComo(u.coordF1!, "select * from public.notificacoes")).toBe(0);
  });

  it("pendente: colega da etapa não vê; Coordenação da etapa vê; outra etapa não", async () => {
    expect(await contarComo(u.colegaEI!, "select * from public.atividades")).toBe(0);
    expect(await contarComo(u.coordEI!, "select * from public.atividades")).toBe(1);
    expect(await contarComo(u.coordF1!, "select * from public.atividades")).toBe(0);
  });
});

describe("aprovar ou recusar", () => {
  it("Coordenação de outra etapa não aprova", async () => {
    await expect(valor(u.coordF1!, "public.avaliar_atividade($1, true)", [PENDENTE])).rejects.toThrow(/permissão/);
  });

  it("aprovada (com tema ajustado): vai para o banco da etapa e o professor é avisado", async () => {
    await valor(u.coordEI!, "public.avaliar_atividade($1, true, null, 'Matemática e Raciocínio Lógico')", [PENDENTE]);
    const r = await b.db.query<{ tema: string; status: string }>("select tema, status from public.atividades where id = $1", [PENDENTE]);
    expect(r.rows[0]).toEqual({ tema: "Matemática e Raciocínio Lógico", status: "aprovada" });
    expect(await contarComo(u.marina!, "select * from public.notificacoes where tipo = 'atividade_aprovada'")).toBe(1);
  });

  it("aprovada: toda a etapa vê e baixa o arquivo; outra etapa não", async () => {
    expect(await contarComo(u.colegaEI!, "select * from public.atividades")).toBe(1);
    expect(await contarComo(u.colegaEI!, "select * from storage.objects where name like '%formas.pdf'")).toBe(1);
    expect(await contarComo(u.profF1!, "select * from public.atividades")).toBe(0);
    expect(await contarComo(u.profF1!, "select * from storage.objects where name like '%formas.pdf'")).toBe(0);
  });

  it("recusa exige motivo e avisa o professor", async () => {
    const c = await enviarArquivo(u.marina!, "outra.pdf");
    const id = await propor(u.marina!, BLOCO, "Outra", "Tema", c);
    await expect(valor(u.secretaria!, "public.avaliar_atividade($1, false)", [id])).rejects.toThrow(/motivo/);
    await valor(u.secretaria!, "public.avaliar_atividade($1, false, null, null, 'Arquivo ilegível')", [id]);
    expect(await contarComo(u.marina!, "select * from public.notificacoes where tipo = 'atividade_recusada'")).toBe(1);
  });
});

describe("remover", () => {
  it("professor não remove a atividade já aprovada; a Coordenação remove", async () => {
    await expect(valor(u.marina!, "public.remover_atividade($1)", [PENDENTE])).rejects.toThrow(/não pode remover/);
    expect(await contarComo(u.marina!, "select * from storage.objects where name like '%formas.pdf'")).toBe(1);
    await b.como(u.marina!, () => b.db.query("delete from storage.objects where name like '%formas.pdf'"));
    expect(await b.contar("select * from storage.objects where name like '%formas.pdf'")).toBe(1); // a política impediu
    await valor(u.coordEI!, "public.remover_atividade($1)", [PENDENTE]);
    expect(await b.contar("select * from public.atividades where id = $1", [PENDENTE])).toBe(0);
  });
});
