import type { Database } from "@/lib/database.types";

type Enums = Database["public"]["Enums"];
export type StatusBloco = Enums["status_bloco"];
export type Inteligencia = Enums["inteligencia"];
export type LinguagemAmor = Enums["linguagem_amor"];

export const STATUS: Record<StatusBloco, { rotulo: string; descricao: string; cor: string; fundo: string }> = {
  cinza: { rotulo: "Não iniciado", descricao: "Cinza", cor: "#5E6866", fundo: "#E7E6E1" },
  amarelo: { rotulo: "Em andamento", descricao: "Amarelo", cor: "#8A6512", fundo: "#F6E7BF" },
  verde: { rotulo: "Concluído", descricao: "Verde", cor: "#3F6136", fundo: "#DDEAD7" },
};

export const INTELIGENCIAS: Record<Inteligencia, string> = {
  linguistica: "Linguística",
  logico_matematica: "Lógico-matemática",
  espacial: "Espacial",
  corporal_cinestesica: "Corporal-cinestésica",
  musical: "Musical",
  interpessoal: "Interpessoal",
  intrapessoal: "Intrapessoal",
  naturalista: "Naturalista",
};

export const LINGUAGENS_AMOR: Record<LinguagemAmor, string> = {
  palavras_afirmacao: "Palavras de Afirmação",
  tempo_qualidade: "Tempo de Qualidade",
  presentes: "Presentes",
  atos_servico: "Atos de Serviço",
  toque_fisico: "Toque Físico",
};

/** Campos de texto do bloco, na ordem dos modelos da escola (§6). */
export const CAMPOS_TEXTO = [
  { chave: "conteudo", rotulo: "Conteúdo" },
  { chave: "objetivos", rotulo: "Objetivos de Aprendizagem (Habilidades)" },
  { chave: "estrategias", rotulo: "Estratégias de Ensino" },
  { chave: "atividades", rotulo: "Atividades Propostas" },
  { chave: "avaliacao", rotulo: "Avaliação" },
  { chave: "recursos", rotulo: "Recursos" },
] as const;
export type CampoTexto = (typeof CAMPOS_TEXTO)[number]["chave"];

export const ROTULO_CAMPO: Record<string, string> = {
  ...Object.fromEntries(CAMPOS_TEXTO.map((c) => [c.chave, c.rotulo])),
  hora_inicio: "Início",
  hora_fim: "Fim",
  habilidades: "Inteligências trabalhadas",
  linguagem_amor: "Linguagem do Amor",
  linguagens_amor: "Linguagens do Amor",
  status: "Status",
  arquivado_em: "Arquivado",
  excluido_em: "Excluído",
};

/** Status do dia, derivado dos blocos (decisão D1). */
export function statusDoDia(blocos: { status: StatusBloco }[]): StatusBloco {
  if (blocos.length > 0 && blocos.every((b) => b.status === "verde")) return "verde";
  if (blocos.some((b) => b.status !== "cinza")) return "amarelo";
  return "cinza";
}

// ---------------------------------------------------------------------------
// Datas (sempre no fuso local; o banco guarda só a data, sem hora)
// ---------------------------------------------------------------------------
export function paraISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function deISO(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a!, m! - 1, d!);
}

export function somarDias(iso: string, dias: number): string {
  const d = deISO(iso);
  d.setDate(d.getDate() + dias);
  return paraISO(d);
}

/** Segunda-feira da semana da data. */
export function inicioDaSemana(iso: string): string {
  const d = deISO(iso);
  const desloc = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - desloc);
  return paraISO(d);
}

export function hojeISO(): string {
  return paraISO(new Date());
}

/** "Quarta-feira, 25 de novembro de 2026" */
export function dataPorExtenso(iso: string): string {
  const t = deISO(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function dataCurta(iso: string): string {
  return deISO(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

/** "07:30:00" → "07:30" */
export function hora(h: string): string {
  return h.slice(0, 5);
}
