import { useEffect, useRef, useState } from "react";
import { useUsuario } from "@/features/auth/AuthContext";
import { chavePendencia } from "@/lib/offline/banco-local";
import { lerPendencia, registrarAlteracao } from "@/lib/offline/fila";
import { useSincronizacao } from "@/lib/offline/SincronizacaoContext";
import type { Bloco } from "./api";

export type EstadoSalvamento = "salvo" | "pendente" | "salvando" | "erro" | "offline";

const ESPERA_MS = 1500;

/**
 * Salvamento do bloco (§7). Cada alteração vai primeiro para a fila no
 * navegador (IndexedDB) e é enviada 1,5 s depois da última digitação.
 * Se a internet cair ou a aba fechar, a fila é enviada depois — nada se perde.
 */
export function useSalvamento(bloco: Bloco, aoSalvar?: () => void) {
  const eu = useUsuario();
  const { sincronizador, pendencias, online } = useSincronizacao();
  const chave = chavePendencia(eu.id, bloco.id);
  const pendencia = pendencias?.find((p) => p.chave === chave);

  const [salvando, setSalvando] = useState(false);
  const [semConexao, setSemConexao] = useState(false);
  const [salvoEm, setSalvoEm] = useState<string>(bloco.atualizado_em);
  const [conflito, setConflito] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ultimaGravacao = useRef<Promise<void>>(Promise.resolve());
  // Última versão confirmada pelo servidor (a do carregamento pode ficar velha depois de um envio).
  const versao = useRef(bloco.versao);
  const aoSalvarRef = useRef(aoSalvar);
  useEffect(() => {
    aoSalvarRef.current = aoSalvar;
  }, [aoSalvar]);

  // Resultado de qualquer envio deste bloco (daqui ou do envio automático global).
  useEffect(
    () =>
      sincronizador.aoSincronizar((blocoId, r) => {
        if (blocoId !== bloco.id) return;
        setSemConexao(r.tipo === "sem-conexao");
        if (r.tipo === "enviado") {
          versao.current = r.resposta.versao;
          setSalvoEm(r.resposta.atualizado_em);
          if (r.resposta.conflito) setConflito(true);
          aoSalvarRef.current?.();
        }
      }),
    [sincronizador, bloco.id],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  async function salvarAgora() {
    clearTimeout(timer.current);
    setSalvando(true);
    try {
      await ultimaGravacao.current; // garante que a última tecla já está na fila
      const r = await sincronizador.sincronizar(chave, bloco.id);
      // Algo foi digitado durante o envio: manda de novo em seguida.
      const resto = await lerPendencia(eu.id, bloco.id);
      if (r.tipo === "enviado" && resto && !resto.erro) {
        timer.current = setTimeout(() => void salvarAgora(), ESPERA_MS);
      }
    } finally {
      setSalvando(false);
    }
  }

  /** Registra uma alteração (já fica guardada no navegador) e agenda o envio. */
  function alterar(campo: string, valor: unknown) {
    ultimaGravacao.current = registrarAlteracao(eu.id, bloco.id, versao.current, { [campo]: valor });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void salvarAgora(), ESPERA_MS);
  }

  const estado: EstadoSalvamento = !pendencia
    ? salvando
      ? "salvando"
      : "salvo"
    : pendencia.erro
      ? "erro"
      : salvando
        ? "salvando"
        : !online || semConexao
          ? "offline"
          : "pendente";

  return {
    alterar,
    salvarAgora: () => salvarAgora(),
    estado,
    erro: pendencia?.erro ?? null,
    salvoEm,
    conflito,
    fecharConflito: () => setConflito(false),
  };
}
