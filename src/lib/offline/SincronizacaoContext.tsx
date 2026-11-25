import { useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useUsuario } from "@/features/auth/AuthContext";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import { bancoLocal, type Pendencia } from "./banco-local";
import { criarSincronizador, type RespostaEnvio, type Sincronizador } from "./sincronizador";

const INTERVALO_MS = 30_000;

export function erroDeRede(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = e && typeof e === "object" && "message" in e ? String(e.message) : "";
  return /Failed to fetch|NetworkError|Load failed|network|fetch failed/i.test(msg);
}

interface Sincronizacao {
  sincronizador: Sincronizador;
  /** Pendências do usuário logado (undefined enquanto carrega do navegador). */
  pendencias: Pendencia[] | undefined;
  online: boolean;
}

const Ctx = createContext<Sincronizacao | null>(null);

/** Mantém a fila do usuário logado sendo enviada: ao abrir, quando a conexão volta e a cada 30 s. */
export function SincronizacaoProvider({ children }: { children: ReactNode }) {
  const eu = useUsuario();
  const qc = useQueryClient();
  const [online, setOnline] = useState(() => navigator.onLine);

  const sincronizador = useMemo(
    () =>
      criarSincronizador({
        enviar: async (blocoId, versaoBase, campos) =>
          verificar(
            await supabase.rpc("salvar_bloco", { p_id: blocoId, p_versao: versaoBase, p_campos: campos as never }),
          ) as unknown as RespostaEnvio,
        erroDeRede,
        mensagemDeErro,
      }),
    [],
  );

  const pendencias = useLiveQuery(() => bancoLocal.pendencias.where("usuarioId").equals(eu.id).toArray(), [eu.id]);

  useEffect(() => {
    let vivo = true;
    const tudo = () => {
      if (vivo && navigator.onLine) void sincronizador.sincronizarTudo(eu.id);
    };
    const on = () => {
      setOnline(true);
      tudo();
    };
    const off = () => setOnline(false);
    const visivel = () => document.visibilityState === "visible" && tudo();

    tudo();
    const intervalo = setInterval(tudo, INTERVALO_MS);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    document.addEventListener("visibilitychange", visivel);

    // Depois de um envio, a semana, as entregas e as notificações podem ter mudado.
    let agendado: ReturnType<typeof setTimeout> | undefined;
    const parar = sincronizador.aoSincronizar((_bloco, r) => {
      if (r.tipo !== "enviado") return;
      clearTimeout(agendado);
      agendado = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ["planejamentos", "semana"] });
        void qc.invalidateQueries({ queryKey: ["entregas"] });
        void qc.invalidateQueries({ queryKey: ["notificacoes"] });
      }, 800);
    });

    return () => {
      vivo = false;
      clearInterval(intervalo);
      clearTimeout(agendado);
      parar();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      document.removeEventListener("visibilitychange", visivel);
    };
  }, [eu.id, sincronizador, qc]);

  return <Ctx.Provider value={{ sincronizador, pendencias, online }}>{children}</Ctx.Provider>;
}

export function useSincronizacao(): Sincronizacao {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSincronizacao precisa estar dentro de SincronizacaoProvider");
  return ctx;
}
