/**
 * Modelo intermediário dos documentos exportados. Os montadores (planejamento,
 * conteúdo programático, relatório) produzem este modelo; os renderizadores
 * de PDF e Word o desenham. Assim os dois formatos saem iguais.
 */

export interface Trecho {
  texto: string;
  negrito?: boolean;
  italico?: boolean;
}

/** Um parágrafo é uma sequência de trechos (permite negrito no meio do texto). */
export type Paragrafo = Trecho[];

export interface Celula {
  paragrafos: Paragrafo[];
  /** Ocupa N colunas. */
  colunas?: number;
  alinhamento?: "esquerda" | "centro";
}

export interface Linha {
  celulas: Celula[];
  /** rotina: fundo cinza claro (Lanche, Saída…); total: negrito. */
  estilo?: "rotina" | "total";
}

export interface Tabela {
  tipo: "tabela";
  /** Larguras relativas das colunas (somam qualquer valor). */
  larguras: number[];
  cabecalho: string[];
  linhas: Linha[];
}

export interface Titulo {
  tipo: "titulo";
  texto: string;
}

export interface Texto {
  tipo: "texto";
  paragrafos: Paragrafo[];
}

export type Bloco = Tabela | Titulo | Texto;

export interface Documento {
  /** Nome do arquivo sem extensão. */
  nomeArquivo: string;
  orientacao: "paisagem" | "retrato";
  /** Cabeçalho com o logotipo: título e linhas de informação (ex.: "TURMA: Jardim 1"). */
  titulo: string;
  /** Sem rótulo (""), o valor sai sozinho, em negrito. */
  informacoes: { rotulo: string; valor: string }[];
  blocos: Bloco[];
  rodape?: string;
}

// ---------------------------------------------------------------------------
// Atalhos para montar o modelo
// ---------------------------------------------------------------------------
export const t = (texto: string, extra: Omit<Trecho, "texto"> = {}): Trecho => ({ texto, ...extra });

/** Texto com quebras de linha → parágrafos. */
export function paragrafos(texto: string, extra: Omit<Trecho, "texto"> = {}): Paragrafo[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.trimEnd());
  while (linhas.length && !linhas[linhas.length - 1]) linhas.pop();
  return linhas.length ? linhas.map((l) => [t(l, extra)]) : [];
}

export function celula(texto: string | Paragrafo[], extra: Partial<Celula> = {}): Celula {
  return { paragrafos: typeof texto === "string" ? paragrafos(texto) : texto, ...extra };
}

/** Nome de arquivo seguro: sem acentos, barras ou espaços repetidos. */
export function nomeDeArquivo(...partes: string[]): string {
  return partes
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 _-]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
