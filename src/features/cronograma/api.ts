import { useQuery } from "@tanstack/react-query";
import type { Tables } from "@/lib/database.types";
import { verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";

export type Avaliacao = Tables<"avaliacoes">;
export type TipoAvaliacao = "mensal" | "bimestral";

/** Avaliações da turma no ano (filtradas na tela por tipo e bimestre). */
export function useAvaliacoes(turmaId: number | undefined, ano: number) {
  return useQuery({
    queryKey: ["avaliacoes", turmaId, ano],
    enabled: !!turmaId,
    queryFn: async () =>
      verificar(await supabase.from("avaliacoes").select("*").eq("turma_id", turmaId!).eq("ano", ano).order("data")),
  });
}

/** Quem leciona cada disciplina na turma (cabeçalho com a regente e "Prof(a) …" dos especialistas). */
export function useProfessoresDaTurma(turmaId: number | undefined) {
  return useQuery({
    queryKey: ["professores-da-turma", turmaId],
    enabled: !!turmaId,
    queryFn: async () => verificar(await supabase.rpc("professores_da_turma", { p_turma: turmaId! })),
  });
}
