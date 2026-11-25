import { confirmarEnvio, pendenciasDoUsuario, registrarFalha } from "./fila";
import { bancoLocal } from "./banco-local";

export interface RespostaEnvio {
  versao: number;
  atualizado_em: string;
  conflito: boolean;
}

export type ResultadoEnvio =
  | { tipo: "enviado"; resposta: RespostaEnvio }
  | { tipo: "nada" }
  | { tipo: "sem-conexao" }
  | { tipo: "erro"; mensagem: string };

export interface OpcoesSincronizador {
  /** Envia os campos ao servidor (salvar_bloco). */
  enviar: (blocoId: number, versaoBase: number, campos: Record<string, unknown>) => Promise<RespostaEnvio>;
  /** O erro é de rede (tentar de novo depois)? */
  erroDeRede: (e: unknown) => boolean;
  mensagemDeErro: (e: unknown) => string;
}

/**
 * Envia a fila ao servidor, um bloco por vez (nunca dois envios do mesmo bloco
 * ao mesmo tempo). Erros de rede ficam para depois; erros de regra (ex.: bloco
 * arquivado) ficam marcados e não são reenviados sozinhos.
 */
export function criarSincronizador(op: OpcoesSincronizador) {
  const emAndamento = new Map<string, Promise<ResultadoEnvio>>();
  const ouvintes = new Set<(blocoId: number, r: ResultadoEnvio) => void>();

  async function enviarChave(chave: string): Promise<ResultadoEnvio> {
    const pend = await bancoLocal.pendencias.get(chave);
    if (!pend || Object.keys(pend.campos).length === 0) return { tipo: "nada" };
    const enviados = { ...pend.campos };
    try {
      const resposta = await op.enviar(pend.blocoId, pend.versaoBase, enviados);
      await confirmarEnvio(chave, enviados, resposta.versao);
      return { tipo: "enviado", resposta };
    } catch (e) {
      if (op.erroDeRede(e)) {
        await registrarFalha(chave);
        return { tipo: "sem-conexao" };
      }
      const mensagem = op.mensagemDeErro(e);
      await registrarFalha(chave, mensagem);
      return { tipo: "erro", mensagem };
    }
  }

  /** Envia o que houver para este bloco (espera um envio anterior terminar). */
  async function sincronizar(chave: string, blocoId: number): Promise<ResultadoEnvio> {
    const anterior = emAndamento.get(chave);
    if (anterior) await anterior.catch(() => undefined);
    const atual = enviarChave(chave);
    emAndamento.set(chave, atual);
    try {
      const r = await atual;
      ouvintes.forEach((f) => f(blocoId, r));
      return r;
    } finally {
      if (emAndamento.get(chave) === atual) emAndamento.delete(chave);
    }
  }

  /** Envia tudo o que está pendente do usuário (menos o que tem erro definitivo). */
  async function sincronizarTudo(usuarioId: string): Promise<void> {
    const lista = await pendenciasDoUsuario(usuarioId);
    for (const p of lista) {
      if (p.erro) continue;
      const r = await sincronizar(p.chave, p.blocoId);
      if (r.tipo === "sem-conexao") break; // sem internet: não adianta tentar os outros agora
    }
  }

  function aoSincronizar(f: (blocoId: number, r: ResultadoEnvio) => void): () => void {
    ouvintes.add(f);
    return () => {
      ouvintes.delete(f);
    };
  }

  return { sincronizar, sincronizarTudo, aoSincronizar };
}

export type Sincronizador = ReturnType<typeof criarSincronizador>;
