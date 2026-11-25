import { describe, expect, it } from "vitest";
import { dataPorExtenso, inicioDaSemana, somarDias, statusDoDia } from "./dominio";

describe("status do dia (D1)", () => {
  it("verde só quando todos os blocos estão verdes", () => {
    expect(statusDoDia([{ status: "verde" }, { status: "verde" }])).toBe("verde");
    expect(statusDoDia([{ status: "verde" }, { status: "cinza" }])).toBe("amarelo");
  });
  it("cinza quando nada começou ou não há blocos", () => {
    expect(statusDoDia([])).toBe("cinza");
    expect(statusDoDia([{ status: "cinza" }])).toBe("cinza");
  });
});

describe("datas", () => {
  it("semana começa na segunda-feira", () => {
    expect(inicioDaSemana("2026-11-25")).toBe("2026-11-23"); // quarta → segunda
    expect(inicioDaSemana("2026-11-29")).toBe("2026-11-23"); // domingo → segunda anterior
    expect(inicioDaSemana("2026-11-23")).toBe("2026-11-23");
  });
  it("data por extenso só com a primeira letra maiúscula", () => {
    expect(dataPorExtenso("2026-11-25")).toBe("Quarta-feira, 25 de novembro de 2026");
  });
  it("soma dias atravessando o mês", () => {
    expect(somarDias("2026-11-30", 1)).toBe("2026-12-01");
  });
});
