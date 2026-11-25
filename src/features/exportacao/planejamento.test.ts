import { describe, expect, it } from "vitest";
import type { Documento, Linha, Tabela } from "./modelo";
import { horaModelo, montarPlanejamento, type BlocoExport, type DadosPlanejamento } from "./planejamento";

const bloco = (extra: Partial<BlocoExport>): BlocoExport => ({
  hora_inicio: "07:30:00", hora_fim: "08:20:00", disciplina: "Polivalente (Regente)",
  conteudo: "", objetivos: "", habilidades: [], estrategias: "", atividades: "", avaliacao: "", recursos: "", linguagens_amor: [],
  ...extra,
});

function base(extra: Partial<DadosPlanejamento> = {}): DadosPlanejamento {
  return {
    turma: "Jardim 1", etapa: "Educação Infantil", exigeLinguagemAmor: true, turnoPadrao: "matutino",
    inicio: "2026-08-24", fim: "2026-08-28",
    planejamentos: [], grade: [], diasSemAula: [], geradoEm: new Date(2026, 7, 20, 10, 0),
    ...extra,
  };
}

const tabelas = (d: Documento) => d.blocos.filter((b): b is Tabela => b.tipo === "tabela");
const textoDaLinha = (l: Linha) => l.celulas.map((c) => c.paragrafos.map((p) => p.map((x) => x.texto).join("")).join(" / "));

describe("planejamento no formato dos modelos", () => {
  it("formata horas como nos modelos", () => {
    expect(horaModelo("07:30:00")).toBe("7h30");
    expect(horaModelo("08:00:00")).toBe("8h");
    expect(horaModelo("13:00")).toBe("13h");
  });

  it("cabeçalho com turma e período; 8ª coluna de Linguagens do Amor só na Educação Infantil", () => {
    const ei = montarPlanejamento(base({ planejamentos: [{ data: "2026-08-24", turno: "matutino", blocos: [bloco({ conteudo: "Acolhida" })] }] }));
    expect(ei.titulo).toBe("PLANEJAMENTO DE AULA");
    expect(ei.informacoes).toContainEqual({ rotulo: "TURMA", valor: "JARDIM 1" });
    expect(ei.informacoes).toContainEqual({ rotulo: "PERÍODO", valor: "24/08/2026 a 28/08/2026" });
    expect(tabelas(ei)[0]!.cabecalho).toHaveLength(8);
    const f1 = montarPlanejamento(base({ exigeLinguagemAmor: false, planejamentos: [{ data: "2026-08-24", turno: "matutino", blocos: [bloco({})] }] }));
    expect(tabelas(f1)[0]!.cabecalho).toHaveLength(7);
  });

  it("junta aulas, rotina e aulas da grade ainda não planejadas, em ordem de horário", () => {
    const d = montarPlanejamento(
      base({
        planejamentos: [
          {
            data: "2026-08-24",
            turno: "matutino",
            blocos: [
              bloco({ hora_inicio: "07:30:00", conteudo: "Acolhida", habilidades: ["intrapessoal", "musical"], linguagens_amor: ["tempo_qualidade"] }),
              bloco({ hora_inicio: "09:00:00", conteudo: "Pistas e comandos" }),
            ],
          },
        ],
        grade: [
          { dia_semana: 1, hora_inicio: "08:20:00", hora_fim: "08:40:00", vigente_desde: "2026-01-01", vigente_ate: null, rotulo: "Lanche", disciplina: null },
          { dia_semana: 1, hora_inicio: "07:50:00", hora_fim: "08:20:00", vigente_desde: "2026-01-01", vigente_ate: null, rotulo: null, disciplina: "Inglês" },
          { dia_semana: 1, hora_inicio: "11:00:00", hora_fim: "11:15:00", vigente_desde: "2026-01-01", vigente_ate: null, rotulo: "Saída", disciplina: null },
        ],
      }),
    );
    const linhas = tabelas(d)[0]!.linhas;
    expect(linhas.map((l) => textoDaLinha(l)[1])).toEqual(["Acolhida", "Inglês", "Lanche", "Pistas e comandos", "Saída"]);
    // primeira linha traz data, turno, dia da semana e hora
    expect(textoDaLinha(linhas[0]!)[0]).toBe("24/08/2026 / Matutino / Segunda-feira / 7h30");
    expect(textoDaLinha(linhas[1]!)[0]).toBe("7h50");
    // inteligências na coluna de objetivos; linguagens na 8ª coluna
    expect(textoDaLinha(linhas[0]!)[2]).toBe("Múltiplas inteligências: / Intrapessoal / Musical");
    expect(textoDaLinha(linhas[0]!)[7]).toBe("Tempo de Qualidade");
    // rotina e aula prevista com "-" nas demais colunas
    expect(linhas[2]!.estilo).toBe("rotina");
    expect(textoDaLinha(linhas[1]!).slice(2)).toEqual(["-", "-", "-", "-", "-", "-"]);
  });

  it("dia sem aula vira uma linha só; fins de semana e dias vazios não aparecem", () => {
    const d = montarPlanejamento(
      base({
        diasSemAula: [{ data: "2026-08-26", descricao: "Feriado municipal" }],
        planejamentos: [{ data: "2026-08-24", turno: "matutino", blocos: [bloco({ conteudo: "A" })] }],
        fim: "2026-08-30",
      }),
    );
    const t = tabelas(d);
    expect(t).toHaveLength(2);
    expect(textoDaLinha(t[1]!.linhas[0]!)[1]).toBe("SEM AULA — Feriado municipal");
  });

  it("especialista aparece com o nome da disciplina no conteúdo", () => {
    const d = montarPlanejamento(
      base({ planejamentos: [{ data: "2026-08-24", turno: "matutino", blocos: [bloco({ disciplina: "Inglês", conteudo: "Colors" })] }] }),
    );
    expect(textoDaLinha(tabelas(d)[0]!.linhas[0]!)[1]).toBe("Inglês / Colors");
  });
});
