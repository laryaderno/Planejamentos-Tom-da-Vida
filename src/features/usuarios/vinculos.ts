import type { Disciplina, Etapa, Turma, VinculoEntrada } from "@/lib/consultas";

export interface Catalogo {
  etapas: Etapa[];
  turmas: Turma[];
  disciplinas: Disciplina[];
}

export function chave(v: VinculoEntrada): string {
  return `${v.etapa_id}:${v.turma_id ?? 0}:${v.disciplina_id ?? 0}`;
}

/** Texto legível de um vínculo, ex.: "Jardim 1 · Inglês" ou "Educação Infantil (etapa inteira)". */
export function descrever(v: VinculoEntrada, c: Catalogo): string {
  const etapa = c.etapas.find((e) => e.id === v.etapa_id)?.nome ?? "Etapa";
  if (!v.turma_id) return `${etapa} (etapa inteira)`;
  const turma = c.turmas.find((t) => t.id === v.turma_id)?.nome ?? "Turma";
  const disciplina = c.disciplinas.find((d) => d.id === v.disciplina_id)?.nome ?? "";
  return `${turma} · ${disciplina}${v.regente ? " · Regente" : ""}`;
}

/** O que muda entre o conjunto atual e o novo (para o modal de confirmação, §3.2). */
export function diferenca(atual: VinculoEntrada[], novo: VinculoEntrada[]) {
  const mapaAtual = new Map(atual.map((v) => [chave(v), v]));
  const mapaNovo = new Map(novo.map((v) => [chave(v), v]));
  return {
    adicionados: novo.filter((v) => !mapaAtual.has(chave(v))),
    removidos: atual.filter((v) => !mapaNovo.has(chave(v))),
    regenciaAlterada: novo.filter((v) => {
      const a = mapaAtual.get(chave(v));
      return a && Boolean(a.regente) !== Boolean(v.regente);
    }),
  };
}

/** Resumo por turma: "Jardim 1 (Polivalente, Inglês)". */
export function resumoTurmas(vinculos: VinculoEntrada[], c: Catalogo): string {
  const porTurma = new Map<number, string[]>();
  for (const v of vinculos) {
    if (!v.turma_id) continue;
    const nome = c.disciplinas.find((d) => d.id === v.disciplina_id)?.nome ?? "";
    porTurma.set(v.turma_id, [...(porTurma.get(v.turma_id) ?? []), nome]);
  }
  return [...porTurma.entries()]
    .map(([turmaId, disc]) => `${c.turmas.find((t) => t.id === turmaId)?.nome ?? "Turma"} (${disc.join(", ")})`)
    .join("; ");
}
