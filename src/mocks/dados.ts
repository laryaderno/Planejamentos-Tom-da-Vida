/**
 * Dados de exemplo do protótipo. Serão substituídos por consultas ao Supabase
 * a partir da Fase 1 — não acrescente lógica de negócio aqui.
 */
import type { PastaAtividades, PlanejamentoResumo, Professor, Solicitacao, Turma } from "@/types/dominio";

export const TURMAS_INICIAIS: Turma[] = [
  { id: 1, etapa: "Educação Infantil", nome: "Berçário", turno: "Matutino", professores: 2 },
  { id: 2, etapa: "Educação Infantil", nome: "Maternal", turno: "Matutino", professores: 2 },
  { id: 3, etapa: "Educação Infantil", nome: "Jardim 1", turno: "Matutino", professores: 3 },
  { id: 4, etapa: "Educação Infantil", nome: "Jardim 2", turno: "Vespertino", professores: 3 },
  { id: 5, etapa: "Ensino Fundamental I", nome: "1º Ano A", turno: "Matutino", professores: 4 },
  { id: 6, etapa: "Ensino Fundamental I", nome: "2º Ano A", turno: "Matutino", professores: 4 },
  { id: 7, etapa: "Ensino Fundamental II", nome: "6º Ano A", turno: "Vespertino", professores: 6 },
  { id: 8, etapa: "Ensino Médio", nome: "1ª Série A", turno: "Vespertino", professores: 7 },
];

export const PROFESSORES: Professor[] = [
  { id: 1, nome: "Marina Alves", turmas: "Jardim 1", email: "marina.alves@escolatomdavida.com.br" },
  { id: 2, nome: "Carlos Eduardo Souza", turmas: "Jardim 2, Maternal", email: "carlos.souza@escolatomdavida.com.br" },
  { id: 3, nome: "Beatriz Lima", turmas: "1º Ano A", email: "beatriz.lima@escolatomdavida.com.br" },
  { id: 4, nome: "Renata Prado", turmas: "6º Ano A (Inglês)", email: "renata.prado@escolatomdavida.com.br" },
];

export const PLANEJAMENTOS_INICIAIS: PlanejamentoResumo[] = [
  { id: 1, professorId: 1, professorNome: "Marina Alves", turmaId: 3, data: "18/11/2026", turno: "Matutino", conteudo: "Cores primárias com tinta guache" },
  { id: 2, professorId: 1, professorNome: "Marina Alves", turmaId: 3, data: "19/11/2026", turno: "Matutino", conteudo: "Contação de história: A Lagarta Comilona" },
  { id: 3, professorId: 1, professorNome: "Marina Alves", turmaId: 3, data: "20/11/2026", turno: "Matutino", conteudo: "Circuito motor no pátio" },
  { id: 4, professorId: 2, professorNome: "Carlos Eduardo Souza", turmaId: 4, data: "18/11/2026", turno: "Vespertino", conteudo: "Formas geométricas no cotidiano" },
  { id: 5, professorId: 2, professorNome: "Carlos Eduardo Souza", turmaId: 2, data: "19/11/2026", turno: "Matutino", conteudo: "Sons dos animais" },
  { id: 6, professorId: 3, professorNome: "Beatriz Lima", turmaId: 5, data: "18/11/2026", turno: "Matutino", conteudo: "Sílabas simples: BA-BE-BI-BO-BU" },
  { id: 7, professorId: 4, professorNome: "Renata Prado", turmaId: 7, data: "19/11/2026", turno: "Vespertino", conteudo: "Simple present: daily routine" },
];

export const SOLICITACOES_PENDENTES: Solicitacao[] = [
  { nome: "Renata Prado", perfil: "Coordenador", escopo: "Educação Infantil", data: "28/08/2026" },
  { nome: "João Silva", perfil: "Professor", escopo: "2º Ano A — Ensino Fundamental I", data: "30/08/2026" },
];

// Repositório de atividades aprovadas por turma (protótipo v1), organizado em pastas por tema.
// Chave = id da turma em TURMAS_INICIAIS.
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
