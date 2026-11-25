import { C } from "@/styles/tokens";

export function PrazosPage() {
  return (
    <div>
      <p style={{ fontSize: 13.5, color: C.inkSoft, marginBottom: 18, maxWidth: 640, lineHeight: 1.6 }}>
        Cada etapa (ou turma específica) tem seu próprio calendário de prazos. Escolha um dos dois modos
        de configuração abaixo para cada etapa ou turma sob seu escopo.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        <div className="tv-card" style={{ padding: 18 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: "0 0 6px" }}>Modo 1 — Periodicidade automática</p>
          <p style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.6, margin: "0 0 16px" }}>
            Defina um intervalo (semanal, quinzenal ou mensal) e uma data-base; o sistema calcula os
            próximos ciclos automaticamente. Indicado para etapas com calendário estável.
          </p>
          <button className="tv-btn tv-btn-secondary" disabled title="Disponível em uma próxima etapa">Configurar</button>
        </div>
        <div className="tv-card" style={{ padding: 18 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: "0 0 6px" }}>Modo 2 — Calendário manual de ciclos</p>
          <p style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.6, margin: "0 0 16px" }}>
            Cadastre manualmente cada ciclo, informando a data-limite de entrega e o período do
            planejamento coberto. Indicado quando o calendário é definido caso a caso.
          </p>
          <button className="tv-btn tv-btn-secondary" disabled title="Disponível em uma próxima etapa">Configurar</button>
        </div>
      </div>
    </div>
  );
}
