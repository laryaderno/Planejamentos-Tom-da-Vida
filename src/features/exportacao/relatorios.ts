import { celula, nomeDeArquivo, t, type Documento } from "./modelo";
import { dataModelo } from "./planejamento";

const gerado = (d: Date) => `Escola Tom da Vida — gerado em ${d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`;

// ---------------------------------------------------------------------------
// Relatório de entregas (§9)
// ---------------------------------------------------------------------------
export interface LinhaRelatorio {
  professor: string;
  turmas: string | null;
  antecipado: number;
  no_prazo: number;
  atrasado: number;
  nao_entregue: number;
}

export interface DadosRelatorio {
  escopo: string;
  inicio: string;
  fim: string;
  linhas: LinhaRelatorio[];
  geradoEm: Date;
}

export function montarRelatorio(d: DadosRelatorio): Documento {
  const linhas = [...d.linhas].sort((a, b) => a.professor.localeCompare(b.professor, "pt-BR"));
  const soma = (k: keyof Pick<LinhaRelatorio, "antecipado" | "no_prazo" | "atrasado" | "nao_entregue">) =>
    linhas.reduce((s, l) => s + l[k], 0);
  const n = (v: number) => celula(String(v), { alinhamento: "centro" });
  const total = (l: LinhaRelatorio) => l.antecipado + l.no_prazo + l.atrasado + l.nao_entregue;

  return {
    nomeArquivo: nomeDeArquivo("Relatorio de entregas", d.inicio, "a", d.fim),
    orientacao: "retrato",
    titulo: "RELATÓRIO DE ENTREGAS DE PLANEJAMENTO",
    informacoes: [
      { rotulo: "PRAZOS ENTRE", valor: `${dataModelo(d.inicio)} e ${dataModelo(d.fim)}` },
      { rotulo: "ABRANGÊNCIA", valor: d.escopo },
    ],
    blocos: [
      {
        tipo: "tabela",
        larguras: [26, 26, 12, 10, 10, 11, 8],
        cabecalho: ["Professor", "Turmas", "Com antecedência", "No prazo", "Com atraso", "Não entregues", "Total"],
        linhas: [
          ...linhas.map((l) => ({
            celulas: [celula(l.professor), celula(l.turmas ?? "—"), n(l.antecipado), n(l.no_prazo), n(l.atrasado), n(l.nao_entregue), n(total(l))],
          })),
          {
            estilo: "total" as const,
            celulas: [
              celula("Total", { colunas: 2 }),
              n(soma("antecipado")), n(soma("no_prazo")), n(soma("atrasado")), n(soma("nao_entregue")),
              n(linhas.reduce((s, l) => s + total(l), 0)),
            ],
          },
        ],
      },
      {
        tipo: "texto",
        paragrafos: [
          [t("Como ler: ", { negrito: true }), t("cada linha conta os períodos de entrega com data-limite no intervalo, por turma do professor. Com antecedência = 2 ou mais dias úteis antes da data-limite; no prazo = no dia ou na véspera; com atraso = depois. Período com prazo vencido e sem entrega conta como não entregue; períodos ainda dentro do prazo não entram.")],
        ],
      },
    ],
    rodape: gerado(d.geradoEm),
  };
}
