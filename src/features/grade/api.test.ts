import { describe, expect, it } from "vitest";
import { diaDaSemana, ordenarAulas, vigenteEm } from "./api";

describe("grade", () => {
  it("dia da semana no padrão do banco (1 = segunda)", () => {
    expect(diaDaSemana("2026-11-23")).toBe(1);
    expect(diaDaSemana("2026-11-27")).toBe(5);
    expect(diaDaSemana("2026-11-29")).toBe(7);
  });

  it("vigência inclui as duas pontas", () => {
    const h = { vigente_desde: "2026-12-01", vigente_ate: "2027-01-31" };
    expect(vigenteEm(h, "2026-12-01")).toBe(true);
    expect(vigenteEm(h, "2027-01-31")).toBe(true);
    expect(vigenteEm(h, "2027-02-01")).toBe(false);
    expect(vigenteEm({ vigente_desde: "2026-12-01", vigente_ate: null }, "2030-01-01")).toBe(true);
  });

  it("ordena por dia e horário", () => {
    const r = ordenarAulas([
      { dia_semana: 2, hora_inicio: "07:30" },
      { dia_semana: 1, hora_inicio: "09:30" },
      { dia_semana: 1, hora_inicio: "07:30" },
    ]);
    expect(r.map((a) => `${a.dia_semana} ${a.hora_inicio}`)).toEqual(["1 07:30", "1 09:30", "2 07:30"]);
  });
});
