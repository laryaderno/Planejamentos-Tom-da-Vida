import { describe, expect, it } from "vitest";
import {
  NIVEL,
  PAPEIS,
  papeisAprovaveis,
  podeAlterarConfiguracao,
  podeAprovar,
  podeEditarEtapa,
  podeGerenciar,
  podeGerenciarUsuario,
  type Ator,
} from "./papeis";

const ator = (papel: Ator["papel"], etapas: number[] = []): Ator => ({ id: "eu", papel, etapasCoordenadas: etapas });

describe("hierarquia de papéis", () => {
  it("ordena os papéis do maior para o menor nível", () => {
    const niveis = PAPEIS.map((p) => NIVEL[p]);
    expect([...niveis].sort((a, b) => b - a)).toEqual(niveis);
  });

  it("ninguém gerencia usuário de nível igual ou superior", () => {
    expect(podeGerenciar("diretor", "administrador")).toBe(false);
    expect(podeGerenciar("diretor", "diretor")).toBe(false);
    expect(podeGerenciar("secretaria", "diretor")).toBe(false);
    expect(podeGerenciar("coordenador", "professor")).toBe(true);
  });

  it("nível inferior não sobrescreve configuração de nível superior", () => {
    expect(podeAlterarConfiguracao("secretaria", NIVEL.diretor)).toBe(false);
    expect(podeAlterarConfiguracao("coordenador", NIVEL.secretaria)).toBe(false);
    expect(podeAlterarConfiguracao("secretaria", NIVEL.secretaria)).toBe(true);
  });
});

describe("aprovação (§4.1)", () => {
  it("segue a matriz de quem aprova quem", () => {
    expect(papeisAprovaveis(ator("administrador"))).toEqual([...PAPEIS]);
    expect(papeisAprovaveis(ator("diretor"))).toEqual(["diretor", "secretaria", "coordenador", "professor"]);
    expect(papeisAprovaveis(ator("secretaria"))).toEqual(["coordenador", "professor"]);
    expect(papeisAprovaveis(ator("coordenador", [1]))).toEqual(["professor"]);
    expect(papeisAprovaveis(ator("professor"))).toEqual([]);
  });

  it("Coordenador só aprova professor da sua etapa", () => {
    expect(podeAprovar(ator("coordenador", [1]), "professor", 1)).toBe(true);
    expect(podeAprovar(ator("coordenador", [1]), "professor", 2)).toBe(false);
  });
});

describe("gerenciar usuários", () => {
  it("Administrador gerencia outro Administrador, mas não a si mesmo", () => {
    expect(podeGerenciarUsuario(ator("administrador"), { id: "outro", papel: "administrador" }, [])).toBe(true);
    expect(podeGerenciarUsuario(ator("administrador"), { id: "eu", papel: "administrador" }, [])).toBe(false);
  });

  it("Coordenador só gerencia professores das suas etapas", () => {
    expect(podeGerenciarUsuario(ator("coordenador", [1]), { id: "p", papel: "professor" }, [1])).toBe(true);
    expect(podeGerenciarUsuario(ator("coordenador", [1]), { id: "p", papel: "professor" }, [2])).toBe(false);
  });

  it("Coordenador edita turmas só nas suas etapas; Secretaria em todas", () => {
    expect(podeEditarEtapa(ator("coordenador", [1]), 1)).toBe(true);
    expect(podeEditarEtapa(ator("coordenador", [1]), 4)).toBe(false);
    expect(podeEditarEtapa(ator("secretaria"), 4)).toBe(true);
  });
});
