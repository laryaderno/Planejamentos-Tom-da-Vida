import { useQuery } from "@tanstack/react-query";
import { usePendentesParaAprovar } from "@/features/atividades/AtividadesParaAprovar";
import { useUsuario } from "@/features/auth/AuthContext";
import { usePerfis } from "@/lib/consultas";
import type { Database, Tables } from "@/lib/database.types";
import { verificar } from "@/lib/erros";
import { podeAprovar } from "@/lib/papeis";
import { supabase } from "@/lib/supabase";

export type Notificacao = Tables<"notificacoes">;
/** Período de entrega; `turmas` preenchido = personalizado (só essas turmas). */
export type Periodo = Tables<"periodos_entrega"> & { turmas: number[] };

/** O período vale para a turma? Personalizado: só as turmas escolhidas; senão, a etapa (ou todas). */
export function periodoValeParaTurma(p: Periodo, turma: { id: number; etapa_id: number }): boolean {
  const turmas = p.turmas ?? [];
  return turmas.length > 0 ? turmas.includes(turma.id) : p.etapa_id === null || p.etapa_id === turma.etapa_id;
}
export type Entrega = Tables<"entregas">;
export type SituacaoEntrega = Database["public"]["Enums"]["situacao_entrega"];

export const SITUACAO: Record<SituacaoEntrega, { rotulo: string; cor: string; fundo: string }> = {
  antecipado: { rotulo: "Com antecedência", cor: "#3F6136", fundo: "#DDEAD7" },
  no_prazo: { rotulo: "No prazo", cor: "#2F5A78", fundo: "#DCE8F0" },
  atrasado: { rotulo: "Com atraso", cor: "#B24C3B", fundo: "#FDECEC" },
};

export function useNotificacoes() {
  return useQuery({
    queryKey: ["notificacoes"],
    refetchInterval: 60_000,
    queryFn: async () =>
      verificar(await supabase.from("notificacoes").select("*").order("criada_em", { ascending: false }).limit(100)),
  });
}

export function usePeriodos() {
  return useQuery({
    queryKey: ["periodos-turmas"],
    queryFn: async (): Promise<Periodo[]> => {
      const linhas = verificar(
        await supabase.from("periodos_entrega").select("*, periodo_turmas(turma_id)").order("inicio", { ascending: false }),
      );
      return linhas.map(({ periodo_turmas, ...p }) => ({ ...p, turmas: periodo_turmas.map((t) => t.turma_id) }));
    },
  });
}

export function useEntregas() {
  return useQuery({
    queryKey: ["entregas"],
    queryFn: async () => verificar(await supabase.from("entregas").select("*")),
  });
}

/** Cadastros pendentes que este usuário pode decidir. */
export function useSolicitacoesPendentes() {
  const eu = useUsuario();
  const gestor = eu.papel !== "professor";
  const perfis = usePerfis();
  if (!gestor) return [];
  return (perfis.data ?? []).filter((p) => p.status === "pendente" && podeAprovar(eu, p.papel, p.etapa_solicitada_id));
}

/** Total do contador do sininho: avisos não lidos + cadastros e atividades aguardando decisão. */
export function useContadorNotificacoes(): number {
  const notificacoes = useNotificacoes();
  const pendentes = useSolicitacoesPendentes();
  const atividades = usePendentesParaAprovar();
  const naoLidas = (notificacoes.data ?? []).filter((n) => !n.lida_em).length;
  return naoLidas + pendentes.length + atividades.length;
}

/** Entregas indexadas por id (para mostrar a situação nas notificações). */
export function useEntregasPorId(): Map<number, Entrega> {
  const entregas = useEntregas();
  return new Map((entregas.data ?? []).map((e) => [e.id, e]));
}
