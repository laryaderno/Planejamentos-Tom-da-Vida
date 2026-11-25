export const ETAPAS = [
  "Educação Infantil",
  "Ensino Fundamental I",
  "Ensino Fundamental II",
  "Ensino Médio",
] as const;
export type Etapa = (typeof ETAPAS)[number];

export const TURNOS = ["Matutino", "Vespertino"] as const;
export type Turno = (typeof TURNOS)[number];

export interface Turma {
  id: number;
  etapa: Etapa;
  nome: string;
  turno: Turno;
  professores: number;
}

export interface Professor {
  id: number;
  nome: string;
  turmas: string;
  email: string;
}

/** Planejamento (resumo) de um professor, usado no protótipo. */
export interface PlanejamentoResumo {
  id: number;
  professorId: number;
  professorNome: string;
  turmaId: number;
  data: string;
  turno: Turno;
  conteudo: string;
  /** Preenchido quando o professor foi removido e o planejamento foi mantido. */
  arquivadoEm?: string;
  /**
   * Preenchido quando o professor foi removido com "Excluir": some das telas,
   * mas continua no conteúdo programático e no relatório de entregas.
   */
  excluidoEm?: string;
}

export type DestinoPlanejamentos = "manter" | "excluir";

export interface Solicitacao {
  nome: string;
  perfil: string;
  escopo: string;
  data: string;
}

export interface Atividade {
  titulo: string;
  propostaPor: string;
  aprovadaPor: string;
  data: string;
}

export interface PastaAtividades {
  tema: string;
  atividades: Atividade[];
}
