import { CalendarClock } from "lucide-react";
import { useUsuario } from "@/features/auth/AuthContext";
import { useEntregas, usePeriodos } from "@/features/notificacoes/api";
import { SituacaoChip } from "@/features/notificacoes/SituacaoChip";
import { formatarData } from "@/lib/consultas";
import { C } from "@/styles/tokens";
import { useNomes } from "./api";
import { dataCurta, hojeISO } from "./dominio";

/** Período de entrega que cobre a semana exibida, com a data-limite e as entregas da turma. */
export function PrazoDaSemana({ turmaId, etapaId, inicio, fim }: { turmaId: number; etapaId: number; inicio: string; fim: string }) {
  const eu = useUsuario();
  const periodos = usePeriodos();
  const entregas = useEntregas();
  const periodo = periodos.data?.find((p) => p.inicio <= fim && p.fim >= inicio && (p.etapa_id === null || p.etapa_id === etapaId));
  const daTurma = (entregas.data ?? []).filter((e) => periodo && e.periodo_id === periodo.id && e.turma_id === turmaId);
  const nomes = useNomes(daTurma.map((e) => e.professor_id));

  if (!periodos.data) return null;
  if (!periodo) {
    return (
      <p style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: C.inkSoft, margin: "0 0 14px" }}>
        <CalendarClock size={15} /> Nenhum período de entrega cadastrado para esta semana.
      </p>
    );
  }

  const minha = daTurma.find((e) => e.professor_id === eu.id);
  const vencido = periodo.prazo < hojeISO();

  return (
    <div className="tv-card" style={{ padding: "12px 14px", marginBottom: 14, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
        <CalendarClock size={16} color={C.goldDeep} />
        <span>
          Período <strong style={{ textTransform: "capitalize" }}>{dataCurta(periodo.inicio)} – {dataCurta(periodo.fim)}</strong> · entrega até{" "}
          <strong style={{ textTransform: "capitalize", color: vencido ? C.red : C.ink }}>{dataCurta(periodo.prazo)}</strong>
        </span>
      </span>

      {eu.papel === "professor" ? (
        minha ? (
          <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: C.inkSoft }}>
            <SituacaoChip situacao={minha.situacao} /> entregue em {formatarData(minha.entregue_em, true)}
          </span>
        ) : (
          <span style={{ fontSize: 12.5, color: vencido ? C.red : C.inkSoft }}>
            {vencido ? "Prazo vencido — " : ""}Conclua todos os seus dias do período para entregar.
          </span>
        )
      ) : (
        <span style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: C.inkSoft }}>
          {daTurma.length === 0 && "Nenhuma entrega desta turma ainda."}
          {daTurma.map((e) => (
            <span key={e.id} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              {nomes.data?.get(e.professor_id) ?? "…"} <SituacaoChip situacao={e.situacao} />
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
