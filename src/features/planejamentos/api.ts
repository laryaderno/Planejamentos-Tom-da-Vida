import { useQuery } from "@tanstack/react-query";
import type { Tables } from "@/lib/database.types";
import type { Turno } from "@/lib/consultas";
import { verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";

export type Bloco = Tables<"blocos">;
export type Nota = Tables<"notas">;
export type Historico = Tables<"historico_blocos">;
export type Planejamento = Tables<"planejamentos">;

export type BlocoResumo = Pick<Bloco, "id" | "status" | "professor_id" | "disciplina_id" | "hora_inicio" | "hora_fim" | "arquivado_em">;
export type PlanejamentoSemana = Planejamento & { blocos: BlocoResumo[] };
export type PlanejamentoDia = Planejamento & { blocos: Bloco[]; notas: Nota[] };

/** Planejamentos da turma entre duas datas (inclusive), com o resumo dos blocos. */
export function usePlanejamentosSemana(turmaId: number | null, inicio: string, fim: string) {
  return useQuery({
    queryKey: ["planejamentos", "semana", turmaId, inicio],
    enabled: turmaId !== null,
    queryFn: async () =>
      verificar(
        await supabase
          .from("planejamentos")
          .select("*, blocos(id, status, professor_id, disciplina_id, hora_inicio, hora_fim, arquivado_em)")
          .eq("turma_id", turmaId!)
          .gte("data", inicio)
          .lte("data", fim)
          .order("data"),
      ) as PlanejamentoSemana[],
  });
}

/** O planejamento do dia (ou null, se ainda não foi criado). */
export function usePlanejamentoDia(turmaId: number, data: string, turno: Turno) {
  return useQuery({
    queryKey: ["planejamentos", "dia", turmaId, data, turno],
    queryFn: async () => {
      const r = await supabase
        .from("planejamentos")
        .select("*, blocos(*), notas(*)")
        .eq("turma_id", turmaId)
        .eq("data", data)
        .eq("turno", turno)
        .maybeSingle();
      if (r.error) throw r.error;
      const p = r.data as PlanejamentoDia | null;
      if (p) {
        p.blocos.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
        p.notas.sort((a, b) => a.criado_em.localeCompare(b.criado_em));
      }
      return p;
    },
  });
}

export function useHistorico(blocoId: number) {
  return useQuery({
    queryKey: ["historico", blocoId],
    queryFn: async () =>
      verificar(
        await supabase.from("historico_blocos").select("*").eq("bloco_id", blocoId).order("em", { ascending: false }).limit(200),
      ),
  });
}

/** Nomes das pessoas que aparecem nos planejamentos (professores e autores de notas). */
export function useNomes(ids: (string | null | undefined)[]) {
  const unicos = [...new Set(ids.filter((x): x is string => !!x))].sort();
  return useQuery({
    queryKey: ["nomes", unicos],
    enabled: unicos.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const linhas = verificar(await supabase.rpc("nomes_usuarios", { p_ids: unicos }));
      return new Map(linhas.map((l) => [l.id, l.nome]));
    },
  });
}
