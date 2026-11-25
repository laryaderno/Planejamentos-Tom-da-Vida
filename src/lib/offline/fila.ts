import { bancoLocal, chavePendencia, type Pendencia } from "./banco-local";

/**
 * Fila de alterações gravada no navegador (IndexedDB). Toda edição entra aqui
 * ANTES de ir para o servidor e só sai depois de confirmada — assim nada se
 * perde se a internet cair, a aba fechar ou o computador travar (§7).
 */

function iguais(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Registra campos alterados de um bloco (acumula com o que já estava pendente). */
export async function registrarAlteracao(usuarioId: string, blocoId: number, versaoBase: number, campos: Record<string, unknown>) {
  const chave = chavePendencia(usuarioId, blocoId);
  await bancoLocal.transaction("rw", bancoLocal.pendencias, async () => {
    const atual = await bancoLocal.pendencias.get(chave);
    const agora = Date.now();
    await bancoLocal.pendencias.put({
      chave,
      usuarioId,
      blocoId,
      campos: { ...(atual?.campos ?? {}), ...campos },
      versaoBase: atual?.versaoBase ?? versaoBase,
      criadaEm: atual?.criadaEm ?? agora,
      atualizadaEm: agora,
      tentativas: atual?.tentativas ?? 0,
      // nova edição: tenta de novo mesmo que antes tenha dado erro
      erro: undefined,
    });
  });
}

export function lerPendencia(usuarioId: string, blocoId: number): Promise<Pendencia | undefined> {
  return bancoLocal.pendencias.get(chavePendencia(usuarioId, blocoId));
}

export function pendenciasDoUsuario(usuarioId: string): Promise<Pendencia[]> {
  return bancoLocal.pendencias.where("usuarioId").equals(usuarioId).toArray();
}

/**
 * Confirmação do servidor: remove só os campos enviados que não mudaram desde
 * o envio (o que foi digitado durante o envio continua na fila).
 */
export async function confirmarEnvio(chave: string, enviados: Record<string, unknown>, novaVersao: number) {
  await bancoLocal.transaction("rw", bancoLocal.pendencias, async () => {
    const atual = await bancoLocal.pendencias.get(chave);
    if (!atual) return;
    const restantes = Object.fromEntries(
      Object.entries(atual.campos).filter(([campo, valor]) => !(campo in enviados && iguais(valor, enviados[campo]))),
    );
    if (Object.keys(restantes).length === 0) {
      await bancoLocal.pendencias.delete(chave);
    } else {
      await bancoLocal.pendencias.put({ ...atual, campos: restantes, versaoBase: novaVersao, tentativas: 0, erro: undefined });
    }
  });
}

export async function registrarFalha(chave: string, erroDefinitivo?: string) {
  await bancoLocal.transaction("rw", bancoLocal.pendencias, async () => {
    const atual = await bancoLocal.pendencias.get(chave);
    if (!atual) return;
    await bancoLocal.pendencias.put({ ...atual, tentativas: atual.tentativas + 1, erro: erroDefinitivo });
  });
}

/** Descarta alterações (só por decisão do usuário, ex.: bloco arquivado). */
export function descartarPendencia(chave: string) {
  return bancoLocal.pendencias.delete(chave);
}
