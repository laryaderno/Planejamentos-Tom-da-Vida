/**
 * Consultas compartilhadas (TanStack Query). A RLS do banco já limita o que
 * cada papel recebe: o Coordenador, por exemplo, só recebe perfis e vínculos
 * das suas etapas.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Database, Tables } from "./database.types";
import { verificar } from "./erros";
import { supabase } from "./supabase";

export type Etapa = Tables<"etapas">;
export type Disciplina = Tables<"disciplinas">;
export type Turma = Tables<"turmas">;
export type Perfil = Tables<"perfis">;
export type Vinculo = Tables<"vinculos">;
export type RegistroAuditoria = Tables<"log_auditoria">;
export type Turno = Database["public"]["Enums"]["turno"];

/** Vínculo no formato aceito pelas funções do banco. */
export interface VinculoEntrada {
  etapa_id: number;
  turma_id?: number | null;
  disciplina_id?: number | null;
  regente?: boolean;
}

export const ROTULO_TURNO: Record<Turno, string> = { matutino: "Matutino", vespertino: "Vespertino" };

export function useEtapas() {
  return useQuery({
    queryKey: ["etapas"],
    queryFn: async () => verificar(await supabase.from("etapas").select("*").order("ordem")),
    staleTime: Infinity,
  });
}

export function useDisciplinas() {
  return useQuery({
    queryKey: ["disciplinas"],
    queryFn: async () => verificar(await supabase.from("disciplinas").select("*").order("id")),
    staleTime: Infinity,
  });
}

export function useTurmas() {
  return useQuery({
    queryKey: ["turmas"],
    queryFn: async () => verificar(await supabase.from("turmas").select("*").eq("ativa", true).order("nome")),
  });
}

export function usePerfis() {
  return useQuery({
    queryKey: ["perfis"],
    queryFn: async () => verificar(await supabase.from("perfis").select("*").order("nome")),
  });
}

export function useVinculos() {
  return useQuery({
    queryKey: ["vinculos"],
    queryFn: async () => verificar(await supabase.from("vinculos").select("*").eq("ativo", true)),
  });
}

export function useAuditoria(limite = 200) {
  return useQuery({
    queryKey: ["auditoria", limite],
    queryFn: async () =>
      verificar(await supabase.from("log_auditoria").select("*").order("em", { ascending: false }).limit(limite)),
  });
}

/** Recarrega todos os dados depois de uma alteração. */
export function useRecarregar() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries(), [qc]);
}

/** Etapas em que o usuário tem algum vínculo ativo. */
export function etapasDoUsuario(vinculos: Vinculo[], usuarioId: string): number[] {
  return [...new Set(vinculos.filter((v) => v.usuario_id === usuarioId).map((v) => v.etapa_id))];
}

export function paraEntrada(v: Vinculo): VinculoEntrada {
  return { etapa_id: v.etapa_id, turma_id: v.turma_id, disciplina_id: v.disciplina_id, regente: v.regente };
}

export function formatarData(iso: string | null | undefined, comHora = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return comHora
    ? d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : d.toLocaleDateString("pt-BR");
}

/** Etapas, turmas ativas e disciplinas juntas (para os editores de permissão). */
export function useCatalogo() {
  const etapas = useEtapas();
  const turmas = useTurmas();
  const disciplinas = useDisciplinas();
  const pronto = etapas.data && turmas.data && disciplinas.data;
  return {
    catalogo: pronto ? { etapas: etapas.data!, turmas: turmas.data!, disciplinas: disciplinas.data! } : null,
    erro: etapas.error ?? turmas.error ?? disciplinas.error,
  };
}
