import { CalendarClock } from "lucide-react";
import { useUsuario } from "@/features/auth/AuthContext";
import { useEntregas, usePeriodos } from "@/features/notificacoes/api";
import { SituacaoChip } from "@/features/notificacoes/SituacaoChip";
import { formatarData, useVinculos } from "@/lib/consultas";
import { C } from "@/styles/tokens";
import { useNomes } from "./api";
import { EtiquetaAtrasado, situacaoDoProfessor } from "./atraso";
import { dataCurta, hojeISO } from "./dominio";

/**
 * Período de entrega que cobre a semana: data-limite e a situação de cada
 * professor da turma (com a etiqueta "Atrasado", §8.3).
 */
export function PrazoDaSemana({ turmaId, etapaId, inicio, fim }: { turmaId: number; etapaId: number; inicio: string; fim: string }) {
  const eu = useUsuario();
  const periodos = usePeriodos();
  const entregas = useEntregas();
  const vinculos = useVinculos();
  const periodo = periodos.data?.find((p) => p.inicio <= fim && p.fim >= inicio && (p.etapa_id === null || p.etapa_id === etapaId));

  // Professores esperados: quem tem vínculo com a turma (o professor vê só a si mesmo).
  const professores =
    eu.papel === "professor"
      ? [eu.id]
      : [...new Set((vinculos.data ?? []).filter((v) => v.turma_id === turmaId).map((v) => v.usuario_id))];
  const nomes = useNomes(professores);

  if (!periodos.data) return null;
  if (!periodo) {
    return (
      <p style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: C.inkSoft, margin: "0 0 14px" }}>
        <CalendarClock size={15} /> Nenhum período de entrega cadastrado para esta semana.
      </p>
    );
  }

  const vencido = periodo.prazo < hojeISO();
  const situacoes = professores
    .map((id) => {
      const s = situacaoDoProfessor(periodo, entregas.data, id, turmaId);
      const e = entregas.data?.find((x) => x.periodo_id === periodo.id && x.professor_id === id && x.turma_id === turmaId);
      return { id, nome: id === eu.id ? "Você" : (nomes.data?.get(id) ?? "…"), s, entregueEm: e?.entregue_em };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="tv-card" style={{ padding: "12px 14px", marginBottom: 14 }}>
      <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
        <CalendarClock size={16} color={C.primaryDeep} />
        <span>
          Período <strong style={{ textTransform: "capitalize" }}>{dataCurta(periodo.inicio)} – {dataCurta(periodo.fim)}</strong> · entrega até{" "}
          <strong style={{ textTransform: "capitalize", color: vencido ? C.red : C.ink }}>{dataCurta(periodo.prazo)}</strong>
        </span>
      </span>
      <div style={{ display: "flex", gap: "6px 16px", flexWrap: "wrap", marginTop: 8, fontSize: 12.5, color: C.inkSoft }}>
        {situacoes.length === 0 && <span>Nenhum professor vinculado a esta turma.</span>}
        {situacoes.map((x) => (
          <span key={x.id} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            {x.nome}
            {x.s === "nao_entregue" ? (
              <>
                <EtiquetaAtrasado titulo="Prazo vencido e planejamento não entregue" />
                {eu.papel === "professor" && <span>conclua todos os seus dias do período para entregar</span>}
              </>
            ) : x.s === "pendente" ? (
              <span style={{ fontStyle: "italic" }}>{eu.papel === "professor" ? "conclua todos os seus dias do período para entregar" : "ainda não entregou"}</span>
            ) : (
              <>
                <SituacaoChip situacao={x.s} />
                {x.s === "atrasado" && <EtiquetaAtrasado />}
                {x.entregueEm && <span>em {formatarData(x.entregueEm, true)}</span>}
              </>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
