import { useEntregas, usePeriodos, type Entrega, type Periodo } from "@/features/notificacoes/api";
import { hojeISO } from "./dominio";

export type SituacaoProfessor = Entrega["situacao"] | "nao_entregue" | "pendente";

/** Período de entrega que cobre a data para a etapa da turma. */
export function periodoDaData(periodos: Periodo[] | undefined, etapaId: number, data: string): Periodo | undefined {
  return periodos?.find((p) => p.inicio <= data && data <= p.fim && (p.etapa_id === null || p.etapa_id === etapaId));
}

/** Situação da entrega de um professor numa turma, no período: entregue (com a situação), não entregue (prazo vencido) ou pendente. */
export function situacaoDoProfessor(
  periodo: Periodo,
  entregas: Entrega[] | undefined,
  professorId: string,
  turmaId: number,
  hoje = hojeISO(),
): SituacaoProfessor {
  const e = entregas?.find((x) => x.periodo_id === periodo.id && x.professor_id === professorId && x.turma_id === turmaId);
  if (e) return e.situacao;
  return periodo.prazo < hoje ? "nao_entregue" : "pendente";
}

/**
 * Etiqueta "Atrasado" (§8.3): entregue depois do prazo, ou prazo vencido sem entrega.
 * Devolve uma função (turma, professor, data) → atrasado?
 */
export function useAtraso() {
  const periodos = usePeriodos();
  const entregas = useEntregas();
  return (turma: { id: number; etapa_id: number }, professorId: string, data: string): boolean => {
    const periodo = periodoDaData(periodos.data, turma.etapa_id, data);
    if (!periodo) return false;
    const s = situacaoDoProfessor(periodo, entregas.data, professorId, turma.id);
    return s === "atrasado" || s === "nao_entregue";
  };
}

export function EtiquetaAtrasado({ titulo }: { titulo?: string }) {
  return (
    <span
      title={titulo ?? "Planejamento entregue depois do prazo ou ainda não entregue"}
      style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#E5484D", padding: "2px 8px", borderRadius: 6, letterSpacing: 0.3 }}
    >
      Atrasado
    </span>
  );
}
