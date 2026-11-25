import { verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import type { DadosPlanejamento, TurnoExport } from "./planejamento";

/** Busca tudo o que o planejamento do período precisa (respeitando a RLS de quem exporta). */
export async function carregarPlanejamento(turmaId: number, inicio: string, fim: string): Promise<DadosPlanejamento> {
  const turma = verificar(await supabase.from("turmas").select("*, etapas(nome, exige_linguagem_amor)").eq("id", turmaId).single()) as unknown as {
    nome: string;
    etapa_id: number;
    turno_padrao: TurnoExport;
    etapas: { nome: string; exige_linguagem_amor: boolean };
  };
  const [planejamentos, disciplinas, horarios, diasSemAula] = await Promise.all([
    supabase.from("planejamentos").select("data, turno, blocos(*)").eq("turma_id", turmaId).gte("data", inicio).lte("data", fim).order("data"),
    supabase.from("disciplinas").select("id, nome"),
    supabase.from("horarios").select("*").eq("turma_id", turmaId).lte("vigente_desde", fim),
    supabase.from("dias_sem_aula").select("data, descricao, etapa_id").gte("data", inicio).lte("data", fim),
  ]);
  const nomeDisc = new Map(verificar(disciplinas).map((d) => [d.id, d.nome]));

  return {
    turma: turma.nome,
    etapa: turma.etapas.nome,
    exigeLinguagemAmor: turma.etapas.exige_linguagem_amor,
    turnoPadrao: turma.turno_padrao,
    inicio,
    fim,
    planejamentos: verificar(planejamentos).map((p) => ({
      data: p.data,
      turno: p.turno,
      blocos: p.blocos
        .filter((b) => b.excluido_em === null)
        .map((b) => ({ ...b, disciplina: nomeDisc.get(b.disciplina_id) ?? "" })),
    })),
    grade: verificar(horarios).map((h) => ({
      dia_semana: h.dia_semana,
      hora_inicio: h.hora_inicio,
      hora_fim: h.hora_fim,
      vigente_desde: h.vigente_desde,
      vigente_ate: h.vigente_ate,
      rotulo: h.rotulo,
      disciplina: h.disciplina_id ? nomeDisc.get(h.disciplina_id) ?? null : null,
    })),
    diasSemAula: verificar(diasSemAula)
      .filter((d) => d.etapa_id === null || d.etapa_id === turma.etapa_id)
      .map((d) => ({ data: d.data, descricao: d.descricao })),
    geradoEm: new Date(),
  };
}
