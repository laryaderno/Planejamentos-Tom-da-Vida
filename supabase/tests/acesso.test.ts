/** Fase 1: aprovação, remoção, vínculos, turmas e escopo do Coordenador. */
import { beforeAll, describe, expect, it } from "vitest";
import { criarBanco, type Banco } from "./banco";

let b: Banco;
const u: Record<string, string> = {};
let EI = 0;
let F1 = 0;
let MEDIO = 0;
let JARDIM1 = 0;
let ANO1 = 0;
let POLIVALENTE = 0;
let INGLES = 0;

beforeAll(async () => {
  b = await criarBanco();
  EI = await b.id("etapas", "Educação Infantil");
  F1 = await b.id("etapas", "Ensino Fundamental I");
  MEDIO = await b.id("etapas", "Ensino Médio");
  JARDIM1 = await b.id("turmas", "Jardim 1");
  ANO1 = await b.id("turmas", "1º Ano A");
  POLIVALENTE = await b.id("disciplinas", "Polivalente (Regente)");
  INGLES = await b.id("disciplinas", "Inglês");

  u.admin = await b.criarUsuario({ email: "adm@t.com", nome: "Adm", papel: "administrador" });
  u.diretor = await b.criarUsuario({ email: "dir@t.com", nome: "Ana Diretora", papel: "diretor" });
  u.secretaria = await b.criarUsuario({ email: "sec@t.com", nome: "Bia", papel: "secretaria" });
  u.coordEI = await b.criarUsuario({ email: "coord@t.com", nome: "Coord EI", papel: "coordenador" });
  await b.db.query(
    "insert into public.vinculos (usuario_id, etapa_id) values ($1, $2)",
    [u.coordEI, EI],
  );
  u.profF1 = await b.criarUsuario({ email: "pf1@t.com", nome: "Prof F1", papel: "professor" });
  await b.db.query(
    "insert into public.vinculos (usuario_id, etapa_id, turma_id, disciplina_id, regente) values ($1, $2, $3, $4, true)",
    [u.profF1, F1, ANO1, POLIVALENTE],
  );

  u.pendProfEI = await b.criarUsuario({ email: "p1@t.com", nome: "Pend EI", papel: "professor", status: "pendente", etapa: "Educação Infantil" });
  u.pendProfF1 = await b.criarUsuario({ email: "p2@t.com", nome: "Pend F1", papel: "professor", status: "pendente", etapa: "Ensino Fundamental I" });
  u.pendCoord = await b.criarUsuario({ email: "p3@t.com", nome: "Pend Coord", papel: "coordenador", status: "pendente", etapa: "Ensino Fundamental I" });
  u.pendDiretor = await b.criarUsuario({ email: "p4@t.com", nome: "Pend Dir", papel: "diretor", status: "pendente" });
  u.pendAdmin = await b.criarUsuario({ email: "p5@t.com", nome: "Futuro Adm", papel: "professor", status: "pendente" });
}, 60_000);

const vincProf = (etapa: number, turma: number, disciplina: number, regente = false) => [
  { etapa_id: etapa, turma_id: turma, disciplina_id: disciplina, regente },
];

describe("aprovação de cadastro (§4.1)", () => {
  it("Coordenador vê só as solicitações de professor da sua etapa", async () => {
    const vistos = await b.como(u.coordEI!, () =>
      b.contar("select * from public.perfis where status = 'pendente'"),
    );
    expect(vistos).toBe(1);
  });

  it("Coordenador não aprova professor de outra etapa", async () => {
    await expect(
      b.rpc(u.coordEI!, "aprovar_usuario", { p_usuario: u.pendProfF1, p_papel: "professor", p_vinculos: vincProf(F1, ANO1, INGLES) }),
    ).rejects.toThrow(/etapas que coordena|permissão/);
  });

  it("professor precisa de turma e disciplina", async () => {
    await expect(
      b.rpc(u.coordEI!, "aprovar_usuario", { p_usuario: u.pendProfEI, p_papel: "professor", p_vinculos: [] }),
    ).rejects.toThrow(/ao menos uma turma e uma disciplina/);
  });

  it("Coordenador aprova professor da sua etapa com disciplina e regência", async () => {
    await b.rpc(u.coordEI!, "aprovar_usuario", {
      p_usuario: u.pendProfEI,
      p_papel: "professor",
      p_vinculos: vincProf(EI, JARDIM1, POLIVALENTE, true),
    });
    expect(await b.contar("select * from public.perfis where id = $1 and status = 'ativo'", [u.pendProfEI])).toBe(1);
    expect(
      await b.contar("select * from public.vinculos where usuario_id = $1 and regente and definido_por_nivel = 20", [u.pendProfEI]),
    ).toBe(1);
  });

  it("Coordenador não aprova Coordenador; Secretaria não aprova Diretor", async () => {
    await expect(
      b.rpc(u.coordEI!, "aprovar_usuario", { p_usuario: u.pendCoord, p_papel: "coordenador", p_vinculos: [{ etapa_id: EI }] }),
    ).rejects.toThrow(/permissão/);
    await expect(
      b.rpc(u.secretaria!, "aprovar_usuario", { p_usuario: u.pendDiretor, p_papel: "diretor" }),
    ).rejects.toThrow(/permissão/);
  });

  it("Secretaria aprova Coordenador com etapa; Diretor aprova Diretor", async () => {
    await b.rpc(u.secretaria!, "aprovar_usuario", { p_usuario: u.pendCoord, p_papel: "coordenador", p_vinculos: [{ etapa_id: F1 }] });
    await b.rpc(u.diretor!, "aprovar_usuario", { p_usuario: u.pendDiretor, p_papel: "diretor" });
    expect(await b.contar("select * from public.perfis where id in ($1, $2) and status = 'ativo'", [u.pendCoord, u.pendDiretor])).toBe(2);
  });

  it("só o Administrador cria outro Administrador", async () => {
    await expect(
      b.rpc(u.diretor!, "aprovar_usuario", { p_usuario: u.pendAdmin, p_papel: "administrador" }),
    ).rejects.toThrow(/permissão/);
    await b.rpc(u.admin!, "aprovar_usuario", { p_usuario: u.pendAdmin, p_papel: "administrador" });
    expect(await b.contar("select * from public.perfis where id = $1 and papel = 'administrador'", [u.pendAdmin])).toBe(1);
  });
});

describe("remoção de usuários (§3)", () => {
  it("Secretaria não remove Diretor; Diretor não remove Diretor", async () => {
    await expect(b.rpc(u.secretaria!, "remover_usuario", { p_usuario: u.pendDiretor })).rejects.toThrow(/permissão/);
    await expect(b.rpc(u.diretor!, "remover_usuario", { p_usuario: u.pendDiretor })).rejects.toThrow(/permissão/);
  });

  it("Administrador remove Diretor", async () => {
    await b.rpc(u.admin!, "remover_usuario", { p_usuario: u.pendDiretor });
    expect(await b.contar("select * from public.perfis where id = $1 and status = 'removido'", [u.pendDiretor])).toBe(1);
  });

  it("Coordenador não remove professor de outra etapa", async () => {
    await expect(
      b.rpc(u.coordEI!, "remover_usuario", { p_usuario: u.profF1, p_destino: "manter" }),
    ).rejects.toThrow(/permissão/);
  });

  it("remover professor exige escolher o destino dos planejamentos (D6)", async () => {
    await expect(b.rpc(u.secretaria!, "remover_usuario", { p_usuario: u.profF1 })).rejects.toThrow(/mantidos ou excluídos/);
  });

  it("remoção desativa vínculos mesmo travados por nível superior e registra o destino", async () => {
    // vínculo redefinido pela Diretora (nível 40)
    await b.rpc(u.diretor!, "alterar_vinculos", { p_usuario: u.profF1, p_vinculos: vincProf(F1, ANO1, INGLES) });
    await b.rpc(u.secretaria!, "remover_usuario", { p_usuario: u.profF1, p_destino: "excluir" });
    expect(await b.contar("select * from public.vinculos where usuario_id = $1 and ativo", [u.profF1])).toBe(0);
    expect(await b.contar("select * from public.vinculos where usuario_id = $1", [u.profF1])).toBeGreaterThan(0);
    expect(
      await b.contar("select * from public.perfis where id = $1 and status = 'removido' and destino_planejamentos = 'excluir'", [u.profF1]),
    ).toBe(1);
  });

  it("ninguém remove a si mesmo", async () => {
    await expect(b.rpc(u.admin!, "remover_usuario", { p_usuario: u.admin })).rejects.toThrow(/permissão/);
  });
});

describe("vínculos e trava em cascata (§3.1)", () => {
  it("Coordenador não desfaz vínculo definido pelo Diretor", async () => {
    await b.rpc(u.diretor!, "alterar_vinculos", {
      p_usuario: u.pendProfEI,
      p_vinculos: [...vincProf(EI, JARDIM1, POLIVALENTE, true), ...vincProf(EI, JARDIM1, INGLES)],
    });
    // o vínculo de Inglês foi criado pela Diretora; o Coordenador tenta retirá-lo
    await expect(
      b.rpc(u.coordEI!, "alterar_vinculos", { p_usuario: u.pendProfEI, p_vinculos: vincProf(EI, JARDIM1, POLIVALENTE, true) }),
    ).rejects.toThrow(/Apenas um Diretor pode alterá-la/);
  });

  it("Coordenador edita só a parte da sua etapa e preserva vínculos de outras etapas", async () => {
    const profDuas = await b.criarUsuario({ email: "duas@t.com", nome: "Prof Duas Etapas", papel: "professor" });
    // um vínculo em cada etapa, sem trava (criados fora da tela)
    await b.db.query(
      "insert into public.vinculos (usuario_id, etapa_id, turma_id, disciplina_id) values ($1, $2, $3, $4), ($1, $5, $6, $4)",
      [profDuas, F1, ANO1, INGLES, EI, JARDIM1],
    );
    // o Coordenador da EI só vê e só envia a parte da EI
    await b.rpc(u.coordEI!, "alterar_vinculos", { p_usuario: profDuas, p_vinculos: vincProf(EI, JARDIM1, POLIVALENTE) });
    const ativos = await b.db.query<{ etapa_id: number; disciplina_id: number }>(
      "select etapa_id, disciplina_id from public.vinculos where usuario_id = $1 and ativo order by etapa_id",
      [profDuas],
    );
    expect(ativos.rows).toEqual([
      { etapa_id: EI, disciplina_id: POLIVALENTE },
      { etapa_id: F1, disciplina_id: INGLES },
    ]);
  });

  it("Coordenador não vincula professor a turma de outra etapa", async () => {
    await expect(
      b.rpc(u.coordEI!, "alterar_vinculos", {
        p_usuario: u.pendProfEI,
        p_vinculos: [...vincProf(EI, JARDIM1, POLIVALENTE, true), ...vincProf(EI, JARDIM1, INGLES), ...vincProf(F1, ANO1, INGLES)],
      }),
    ).rejects.toThrow(/etapas que coordena/);
  });
});

describe("turmas", () => {
  it("Coordenador cadastra turma na sua etapa, mas não em outra", async () => {
    await b.rpc(u.coordEI!, "salvar_turma", { p_id: null, p_etapa: EI, p_nome: "Jardim 3", p_turno: "vespertino" });
    expect(await b.contar("select * from public.turmas where nome = 'Jardim 3'")).toBe(1);
    await expect(
      b.rpc(u.coordEI!, "salvar_turma", { p_id: null, p_etapa: MEDIO, p_nome: "2ª Série", p_turno: "matutino" }),
    ).rejects.toThrow(/permissão/);
  });

  it("não desativa turma com professores vinculados", async () => {
    await expect(b.rpc(u.secretaria!, "desativar_turma", { p_id: JARDIM1 })).rejects.toThrow(/professores vinculados/);
  });

  it("nome repetido na mesma etapa gera mensagem clara", async () => {
    await expect(
      b.rpc(u.secretaria!, "salvar_turma", { p_id: null, p_etapa: EI, p_nome: "Jardim 3", p_turno: "matutino" }),
    ).rejects.toThrow(/Já existe uma turma com esse nome/);
  });
});
