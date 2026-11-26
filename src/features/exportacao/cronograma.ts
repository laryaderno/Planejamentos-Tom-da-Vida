import { celula, nomeDeArquivo, paragrafos, t, type Bloco, type Documento, type Linha, type Paragrafo } from "./modelo";
import { dataModelo } from "./planejamento";

/** Cronograma de Avaliação no formato do modelo da escola (DATA | DISCIPLINA | CONTEÚDO, com anexos). */
export interface ItemCronograma {
  data: string;
  disciplina: string;
  /** Professor da disciplina (vazio para a regente, que já está no cabeçalho). */
  professor: string;
  conteudo: string;
  material: string;
  orientacoes: string;
}

export interface DadosCronograma {
  turma: string;
  /** Professor(a) regente (cabeçalho "TURMA 1º ANO A – Prof(a) …"). */
  regente: string;
  tipo: "mensal" | "bimestral";
  bimestre: number;
  ano: number;
  itens: ItemCronograma[];
}

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export function diaPorExtenso(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return DIAS[new Date(a!, m! - 1, d!).getDay()]!;
}

export function montarCronograma(d: DadosCronograma): Documento {
  const itens = [...d.itens].sort((a, b) => a.data.localeCompare(b.data) || a.disciplina.localeCompare(b.disciplina));
  const comAnexo = itens.filter((i) => i.orientacoes.trim());
  const numeroAnexo = new Map(comAnexo.map((i, n) => [i, n + 1]));

  const linhas: Linha[] = itens.map((i, n) => {
    const primeiraDoDia = n === 0 || itens[n - 1]!.data !== i.data;
    const disciplina: Paragrafo[] = [[t(i.disciplina.toUpperCase(), { negrito: true })]];
    if (i.professor) disciplina.push([t(`Prof(a) ${i.professor}`)]);
    const conteudo: Paragrafo[] = [
      ...(i.conteudo.trim() ? paragrafos(i.conteudo) : [[t("Conteúdo ainda não cadastrado.", { italico: true })]]),
      ...(i.material.trim() ? [[t("Material de apoio:", { negrito: true })], ...paragrafos(i.material)] : []),
      ...(numeroAnexo.has(i) ? [[t(`Seguir orientações do Anexo ${numeroAnexo.get(i)}.`, { negrito: true })]] : []),
    ];
    return {
      celulas: [
        primeiraDoDia ? celula([[t(dataModelo(i.data), { negrito: true })], [t(diaPorExtenso(i.data))]]) : celula(""),
        { paragrafos: disciplina },
        { paragrafos: conteudo },
      ],
    };
  });

  const anexos: Bloco[] = comAnexo.flatMap((i): Bloco[] => [
    {
      tipo: "titulo",
      texto: `ANEXO ${numeroAnexo.get(i)} – ${i.disciplina.toUpperCase()}${i.professor ? ` – PROF(A) ${i.professor.toUpperCase()}` : ""}`,
    },
    { tipo: "texto", paragrafos: [[t("ORIENTAÇÕES", { negrito: true })], ...paragrafos(i.orientacoes)] },
  ]);

  const marca = (sim: boolean) => (sim ? "( x )" : "(   )");
  return {
    nomeArquivo: nomeDeArquivo("Cronograma", d.turma, d.tipo === "mensal" ? "Mensal" : "Bimestral", `${d.bimestre}o bimestre`, String(d.ano)),
    orientacao: "retrato",
    titulo: "CRONOGRAMA",
    informacoes: [
      { rotulo: "AVALIAÇÃO", valor: `${marca(d.tipo === "mensal")} MENSAL – ${marca(d.tipo === "bimestral")} BIMESTRAL` },
      { rotulo: "", valor: `${d.bimestre}º BIMESTRE - ${d.ano}` },
      { rotulo: "TURMA", valor: `${d.turma.toUpperCase()}${d.regente ? ` – Prof(a) ${d.regente}` : ""}` },
    ],
    blocos: [
      itens.length
        ? { tipo: "tabela", larguras: [16, 22, 62], cabecalho: ["DATA", "DISCIPLINA", "CONTEÚDO"], linhas }
        : { tipo: "texto", paragrafos: [[t("Nenhuma avaliação agendada.", { italico: true })]] },
      ...anexos,
    ],
  };
}
