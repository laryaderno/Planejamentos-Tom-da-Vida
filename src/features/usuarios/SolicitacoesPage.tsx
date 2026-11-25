import { Bell, Check } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { SOLICITACOES_PENDENTES } from "@/mocks/dados";
import { C } from "@/styles/tokens";

export function SolicitacoesPage() {
  if (SOLICITACOES_PENDENTES.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="Nenhuma solicitação pendente."
        description="Novos cadastros de professores, coordenadores e diretores aparecerão aqui, dentro do seu escopo de autoridade, até serem aprovados ou recusados."
      />
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {SOLICITACOES_PENDENTES.map((s, i) => (
        <div key={i} className="tv-card" style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: "0 0 3px" }}>
              {s.nome}
              <span style={{ fontSize: 11.5, fontWeight: 600, color: C.goldDeep, background: "#F4E7CE", padding: "2px 8px", borderRadius: 999, marginLeft: 8 }}>
                {s.perfil}
              </span>
            </p>
            <p style={{ fontSize: 12.5, color: C.inkSoft, margin: 0 }}>{s.escopo} · solicitado em {s.data}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="tv-btn tv-btn-secondary" disabled title="Disponível em uma próxima etapa">Recusar</button>
            <button className="tv-btn tv-btn-primary" disabled title="Disponível em uma próxima etapa">
              <Check size={14} /> Aprovar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
