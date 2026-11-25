import { useQuery } from "@tanstack/react-query";
import type { Tables } from "@/lib/database.types";
import { verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";

export type Horario = Tables<"horarios">;

/** Aula da grade no formato aceito por `salvar_grade`. */
export interface AulaGrade {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  disciplina_id: number;
  professor_id: string;
}

export const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"] as const;

/** 1 = segunda … 7 = domingo (como no banco). */
export function diaDaSemana(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  const js = new Date(a!, m! - 1, d!).getDay();
  return js === 0 ? 7 : js;
}

export function vigenteEm(h: Pick<Horario, "vigente_desde" | "vigente_ate">, data: string): boolean {
  return h.vigente_desde <= data && (h.vigente_ate === null || h.vigente_ate >= data);
}

export function ordenarAulas<T extends { dia_semana: number; hora_inicio: string }>(aulas: T[]): T[] {
  return [...aulas].sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio));
}

/** Todas as versões da grade de uma turma. */
export function useHorariosTurma(turmaId: number | null) {
  return useQuery({
    queryKey: ["horarios", "turma", turmaId],
    enabled: turmaId !== null,
    queryFn: async () =>
      verificar(await supabase.from("horarios").select("*").eq("turma_id", turmaId!).order("vigente_desde")),
  });
}

/** As aulas do próprio professor (todas as turmas). */
export function useMeusHorarios(professorId: string) {
  return useQuery({
    queryKey: ["horarios", "professor", professorId],
    queryFn: async () => verificar(await supabase.from("horarios").select("*").eq("professor_id", professorId)),
  });
}
