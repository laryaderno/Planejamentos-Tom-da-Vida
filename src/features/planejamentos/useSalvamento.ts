import { useEffect, useRef, useState } from "react";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import type { Bloco } from "./api";

export type EstadoSalvamento = "salvo" | "pendente" | "salvando" | "erro" | "offline";

interface RespostaSalvar {
  versao: number;
  atualizado_em: string;
  conflito: boolean;
}

const ESPERA_MS = 1500;
const NOVA_TENTATIVA_MS = 10_000;

function erroDeRede(e: unknown): boolean {
  if (!navigator.onLine) return true;
  const msg = e && typeof e === "object" && "message" in e ? String(e.message) : "";
  return /Failed to fetch|NetworkError|Load failed/i.test(msg);
}

/**
 * Salvamento do bloco (§7): grava sozinho 1,5 s depois da última alteração,
 * envia só os campos alterados e tenta de novo quando a conexão volta.
 * Na Fase 3 a fila também passa a sobreviver ao fechamento da aba (IndexedDB).
 */
export function useSalvamento(bloco: Bloco, aoSalvar?: () => void) {
  const [estado, setEstado] = useState<EstadoSalvamento>("salvo");
  const [erro, setErro] = useState<string | null>(null);
  const [salvoEm, setSalvoEm] = useState<string>(bloco.atualizado_em);
  const [conflito, setConflito] = useState(false);

  // Tudo o que as funções assíncronas precisam fica em refs (não depende de re-render).
  const r = useRef({
    id: bloco.id,
    versao: bloco.versao,
    pendentes: {} as Record<string, unknown>,
    salvando: false,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
    aoSalvar,
  });
  useEffect(() => {
    r.current.aoSalvar = aoSalvar;
  }, [aoSalvar]);

  const [acoes] = useState(() => {
    const estadoAtual = r.current;

    function agendar(ms: number) {
      clearTimeout(estadoAtual.timer);
      estadoAtual.timer = setTimeout(() => void salvarAgora(), ms);
    }

    async function salvarAgora(): Promise<void> {
      clearTimeout(estadoAtual.timer);
      if (estadoAtual.salvando) return agendar(300);
      const campos = estadoAtual.pendentes;
      if (Object.keys(campos).length === 0) return;
      estadoAtual.pendentes = {};
      estadoAtual.salvando = true;
      setEstado("salvando");
      try {
        const resp = verificar(
          await supabase.rpc("salvar_bloco", { p_id: estadoAtual.id, p_versao: estadoAtual.versao, p_campos: campos as never }),
        ) as unknown as RespostaSalvar;
        estadoAtual.versao = resp.versao;
        setSalvoEm(resp.atualizado_em);
        if (resp.conflito) setConflito(true);
        setErro(null);
        const restante = Object.keys(estadoAtual.pendentes).length > 0;
        setEstado(restante ? "pendente" : "salvo");
        if (restante) agendar(ESPERA_MS); // algo foi digitado enquanto salvava
        estadoAtual.aoSalvar?.();
      } catch (e) {
        // Devolve os campos à fila sem sobrescrever o que foi digitado depois.
        estadoAtual.pendentes = { ...campos, ...estadoAtual.pendentes };
        if (erroDeRede(e)) {
          setEstado("offline");
          setErro(null);
          agendar(NOVA_TENTATIVA_MS);
        } else {
          setEstado("erro");
          setErro(mensagemDeErro(e));
        }
      } finally {
        estadoAtual.salvando = false;
      }
    }

    /** Registra uma alteração e agenda o salvamento automático. */
    function alterar(campo: string, valor: unknown) {
      estadoAtual.pendentes = { ...estadoAtual.pendentes, [campo]: valor };
      setEstado((s) => (s === "offline" ? s : "pendente"));
      agendar(ESPERA_MS);
    }

    function temPendencia() {
      return Object.keys(estadoAtual.pendentes).length > 0 || estadoAtual.salvando;
    }

    return { salvarAgora, alterar, temPendencia };
  });

  useEffect(() => {
    // Conexão voltou: envia o que ficou pendente.
    const aoVoltar = () => void acoes.salvarAgora();
    // Aviso ao fechar a aba com alterações não enviadas.
    const aoSair = (e: BeforeUnloadEvent) => {
      if (acoes.temPendencia()) e.preventDefault();
    };
    window.addEventListener("online", aoVoltar);
    window.addEventListener("beforeunload", aoSair);
    return () => {
      window.removeEventListener("online", aoVoltar);
      window.removeEventListener("beforeunload", aoSair);
      // Ao sair da tela, envia o que restou.
      if (acoes.temPendencia()) void acoes.salvarAgora();
    };
  }, [acoes]);

  return {
    alterar: acoes.alterar,
    salvarAgora: acoes.salvarAgora,
    estado,
    erro,
    salvoEm,
    conflito,
    fecharConflito: () => setConflito(false),
  };
}
