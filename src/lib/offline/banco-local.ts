import Dexie, { type EntityTable } from "dexie";

/**
 * Alteração de um bloco ainda não confirmada pelo servidor (ARQUITETURA.md §5).
 * Uma entrada por usuário × bloco; os campos alterados vão se acumulando.
 */
export interface Pendencia {
  /** `${usuarioId}:${blocoId}` */
  chave: string;
  usuarioId: string;
  blocoId: number;
  /** Campos alterados → novo valor. */
  campos: Record<string, unknown>;
  /** Versão do bloco no servidor quando a edição começou (para avisar conflito). */
  versaoBase: number;
  criadaEm: number;
  atualizadaEm: number;
  tentativas: number;
  /** Erro que não se resolve tentando de novo (ex.: bloco arquivado). Não reenvia sozinho. */
  erro?: string;
}

/** Cópia do cache de consultas (para abrir o sistema sem internet). */
export interface ItemCache {
  chave: string;
  valor: string;
}

export const bancoLocal = new Dexie("planejamento-tom-da-vida") as Dexie & {
  pendencias: EntityTable<Pendencia, "chave">;
  cache: EntityTable<ItemCache, "chave">;
};

bancoLocal.version(1).stores({
  pendencias: "chave, usuarioId, blocoId",
  cache: "chave",
});

export function chavePendencia(usuarioId: string, blocoId: number): string {
  return `${usuarioId}:${blocoId}`;
}
