/** Tipos das telas que ainda usam dados de exemplo (ver src/mocks/dados.ts). */

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
