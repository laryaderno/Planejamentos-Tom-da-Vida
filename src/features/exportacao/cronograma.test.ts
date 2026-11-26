import { describe, expect, it } from "vitest";
import { diaPorExtenso, montarCronograma } from "./cronograma";
import type { Tabela, Texto, Titulo } from "./modelo";

const texto = (p: { texto: string }[][]) => p.map((l) => l.map((x) => x.texto).join("")).join("\n");

describe("cronograma de avaliação", () => {
  const doc = montarCronograma({
    turma: "1º Ano A",
    regente: "Girlaine",
    tipo: "bimestral",
    bimestre: 3,
    ano: 2026,
    itens: [
      { data: "2026-09-15", disciplina: "Educação Física", professor: "Luciana", conteudo: "Jogos de ocupação de espaço", material: "", orientacoes: "Cartaz de pesquisa" },
      { data: "2026-09-14", disciplina: "Língua Portuguesa", professor: "", conteudo: "Gênero textual: cartaz\nFrase", material: "https://youtu.be/a", orientacoes: "" },
      { data: "2026-09-15", disciplina: "Geografia", professor: "", conteudo: "", material: "", orientacoes: "" },
    ],
  });

  it("cabeçalho como no modelo", () => {
    expect(doc.titulo).toBe("CRONOGRAMA");
    expect(doc.informacoes.map((i) => i.valor)).toEqual(["(   ) MENSAL – ( x ) BIMESTRAL", "3º BIMESTRE - 2026", "1º ANO A – Prof(a) Girlaine"]);
  });

  it("ordena por data, mostra a data só na primeira disciplina do dia e o professor do especialista", () => {
    const tabela = doc.blocos[0] as Tabela;
    expect(tabela.cabecalho).toEqual(["DATA", "DISCIPLINA", "CONTEÚDO"]);
    const col = (n: number, c: number) => texto(tabela.linhas[n]!.celulas[c]!.paragrafos);
    expect(col(0, 0)).toBe("14/09/2026\nsegunda-feira");
    expect(col(0, 2)).toBe("Gênero textual: cartaz\nFrase\nMaterial de apoio:\nhttps://youtu.be/a");
    expect(col(1, 0)).toBe("15/09/2026\nterça-feira");
    expect(col(1, 1)).toBe("EDUCAÇÃO FÍSICA\nProf(a) Luciana");
    expect(col(1, 2)).toContain("Seguir orientações do Anexo 1.");
    expect(col(2, 0)).toBe("");
    expect(col(2, 2)).toBe("Conteúdo ainda não cadastrado.");
  });

  it("orientações viram anexos numerados", () => {
    expect((doc.blocos[1] as Titulo).texto).toBe("ANEXO 1 – EDUCAÇÃO FÍSICA – PROF(A) LUCIANA");
    expect(texto((doc.blocos[2] as Texto).paragrafos)).toBe("ORIENTAÇÕES\nCartaz de pesquisa");
  });

  it("dia da semana por extenso", () => {
    expect(diaPorExtenso("2026-08-17")).toBe("segunda-feira");
  });
});
