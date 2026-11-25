import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { bancoLocal } from "./banco-local";

/** Quanto tempo a cópia local dos dados vale para abrir o sistema sem internet. */
export const VALIDADE_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

/** Muda quando o formato dos dados muda (descarta cópias antigas). */
export const VERSAO_CACHE = "2026-11-fase3";

/**
 * Guarda as consultas já carregadas no navegador (IndexedDB) para que a tela
 * abra mesmo sem conexão, mostrando o que já tinha sido visto.
 */
export const persistidor = createAsyncStoragePersister({
  storage: {
    getItem: async (chave) => (await bancoLocal.cache.get(chave))?.valor ?? null,
    setItem: async (chave, valor) => {
      await bancoLocal.cache.put({ chave, valor });
    },
    removeItem: async (chave) => {
      await bancoLocal.cache.delete(chave);
    },
  },
  throttleTime: 2000,
});

/** Apaga a cópia local dos dados (ao sair da conta). Não mexe na fila de alterações. */
export async function limparCacheLocal() {
  await bancoLocal.cache.clear();
}
