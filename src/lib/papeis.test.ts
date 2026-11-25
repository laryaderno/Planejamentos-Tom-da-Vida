import { describe, expect, it } from "vitest";
import { NIVEL, PAPEIS, podeAlterarConfiguracao, podeGerenciar } from "./papeis";

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
    expect(podeGerenciar("diretor", "secretaria")).toBe(true);
  });

  it("nível inferior não sobrescreve configuração de nível superior", () => {
    expect(podeAlterarConfiguracao("secretaria", NIVEL.diretor)).toBe(false);
    expect(podeAlterarConfiguracao("coordenador", NIVEL.secretaria)).toBe(false);
    expect(podeAlterarConfiguracao("secretaria", NIVEL.secretaria)).toBe(true);
    expect(podeAlterarConfiguracao("diretor", NIVEL.secretaria)).toBe(true);
  });
});
