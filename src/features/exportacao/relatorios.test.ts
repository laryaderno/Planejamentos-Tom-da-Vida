import { describe, expect, it } from "vitest";
import type { Tabela } from "./modelo";
import { montarConteudo, montarRelatorio } from "./relatorios";

const texto = (c: { paragrafos: { texto: string }[][] }) => c.paragrafos.map((p) => p.map((x) => x.texto).join("")).join(" / ");

describe("conteúdo programático", () => {
  it("agrupa por disciplina em ordem alfabética, com data, conteúdo e objetivos", () => {
    const d = montarConteudo({
      turma: "Jardim 1", etapa: "Educação Infantil", rotuloPeriodo: "Novembro de 2026", inicio: "2026-11-01", fim: "2026-11-30",
      geradoEm: new Date(),
      itens: [
        { data: "2026-11-23", disciplina: "Polivalente (Regente)", professor: "Marina", conteudo: "Cores", objetivos: "Nomear cores", habilidades: ["espacial"] },
        { data: "2026-11-24", disciplina: "Inglês", professor: "Lucas", conteudo: "Colors", objetivos: "", habilidades: [] },
      ],
    });
    expect(d.blocos.filter((b) => b.tipo === "titulo").map((b) => (b as { texto: string }).texto)).toEqual(["Inglês", "Polivalente (Regente)"]);
    const tabela = d.blocos[3] as Tabela;
    expect(tabela.linhas[0]!.celulas.map(texto)).toEqual(["23/11/2026", "Cores", "Múltiplas inteligências: Espacial / Nomear cores"]);
  });
});

describe("relatório de entregas", () => {
  it("ordena por professor e soma a linha de total", () => {
    const d = montarRelatorio({
      escopo: "Escola toda", inicio: "2026-01-01", fim: "2026-12-31", geradoEm: new Date(),
      linhas: [
        { professor: "Marina Alves", turmas: "Jardim 1", antecipado: 2, no_prazo: 1, atrasado: 0, nao_entregue: 1 },
        { professor: "Beatriz Lima", turmas: "1º Ano A", antecipado: 0, no_prazo: 3, atrasado: 1, nao_entregue: 0 },
      ],
    });
    const tb = d.blocos[0] as Tabela;
    expect(tb.linhas.map((l) => texto(l.celulas[0]!))).toEqual(["Beatriz Lima", "Marina Alves", "Total"]);
    expect(tb.linhas[2]!.celulas.slice(1).map(texto)).toEqual(["2", "4", "1", "1", "8"]);
  });
});
