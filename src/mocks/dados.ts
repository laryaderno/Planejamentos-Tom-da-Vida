/**
 * Dados de exemplo para as telas que ainda não têm banco (Banco de atividades).
 * Saem quando os módulos correspondentes forem implementados — não acrescente
 * lógica de negócio aqui. Os ids de turma seguem a ordem do supabase/seed.sql.
 */
import type { PastaAtividades, PlanejamentoResumo } from "@/types/dominio";

/** Planejamentos de professores já removidos que foram mantidos (decisão D6). */
export const PLANEJAMENTOS_ARQUIVADOS: PlanejamentoResumo[] = [
  { id: 1, professorNome: "Sofia Ramos", turmaId: 3, data: "18/11/2026", turno: "Matutino", conteudo: "Cores primárias com tinta guache", arquivadoEm: "21/11/2026" },
  { id: 2, professorNome: "Sofia Ramos", turmaId: 3, data: "19/11/2026", turno: "Matutino", conteudo: "Contação de história: A Lagarta Comilona", arquivadoEm: "21/11/2026" },
  { id: 3, professorNome: "Sofia Ramos", turmaId: 4, data: "19/11/2026", turno: "Vespertino", conteudo: "Formas geométricas no cotidiano", arquivadoEm: "21/11/2026" },
];

// Repositório de atividades aprovadas por turma (protótipo v1), organizado em pastas por tema.
// Chave = id da turma em supabase/seed.sql.
export const ATIVIDADES_POR_TURMA: Record<number, { pastas: PastaAtividades[] }> = {
  3: {
    pastas: [
      {
        tema: "Rotina e Acolhida",
        atividades: [
          { titulo: "Roda de conversa com caixa surpresa", propostaPor: "Marina Alves", aprovadaPor: "Coord. Renata Prado", data: "12/08/2026" },
          { titulo: "Música de boas-vindas com instrumentos", propostaPor: "Marina Alves", aprovadaPor: "Adm. Rodolfo Santos", data: "03/07/2026" },
        ],
      },
      {
        tema: "Linguagem e Comunicação",
        atividades: [
          { titulo: "Contação de história com fantoches", propostaPor: "Marina Alves", aprovadaPor: "Coord. Renata Prado", data: "20/08/2026" },
        ],
      },
      {
        tema: "Matemática e Raciocínio Lógico",
        atividades: [
          { titulo: "Classificação de blocos por cor e tamanho", propostaPor: "Marina Alves", aprovadaPor: "Coord. Renata Prado", data: "05/08/2026" },
          { titulo: "Contagem com sementes e potinhos", propostaPor: "Marina Alves", aprovadaPor: "Adm. Rodolfo Santos", data: "22/07/2026" },
        ],
      },
      { tema: "Artes e Expressão", atividades: [] },
    ],
  },
  5: {
    pastas: [
      {
        tema: "Língua Portuguesa",
        atividades: [
          { titulo: "Produção de texto coletivo sobre o final de semana", propostaPor: "Beatriz Lima", aprovadaPor: "Coord. Renata Prado", data: "18/08/2026" },
        ],
      },
      {
        tema: "Matemática",
        atividades: [
          { titulo: "Problemas de adição com material dourado", propostaPor: "Beatriz Lima", aprovadaPor: "Adm. Rodolfo Santos", data: "10/08/2026" },
        ],
      },
    ],
  },
};

export function totalAtividadesAprovadas(): number {
  return Object.values(ATIVIDADES_POR_TURMA)
    .flatMap((t) => t.pastas)
    .reduce((sum, pasta) => sum + pasta.atividades.length, 0);
}
