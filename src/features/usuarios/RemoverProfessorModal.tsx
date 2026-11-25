import { AlertTriangle, Archive, Trash2, X } from "lucide-react";
import { useState } from "react";
import { C } from "@/styles/tokens";
import type { DestinoPlanejamentos, Professor } from "@/types/dominio";

interface Props {
  professor: Professor;
  totalPlanejamentos: number;
  onCancel: () => void;
  onConfirm: (destino: DestinoPlanejamentos) => void;
}

/**
 * Remoção de professor com escolha do destino dos planejamentos (decisão D6).
 * Segue a confirmação obrigatória da §3.2: cita usuário, ação, escopo e irreversibilidade.
 */
export function RemoverProfessorModal({ professor, totalPlanejamentos, onCancel, onConfirm }: Props) {
  const [destino, setDestino] = useState<DestinoPlanejamentos>("manter");
  const plural = totalPlanejamentos === 1 ? "planejamento" : "planejamentos";

  const opcoes: { valor: DestinoPlanejamentos; icone: typeof Archive; titulo: string; descricao: string }[] = [
    {
      valor: "manter",
      icone: Archive,
      titulo: "Manter planejamentos",
      descricao: "Ficam arquivados, somente leitura, no Banco de atividades → Planejamentos de cada turma.",
    },
    {
      valor: "excluir",
      icone: Trash2,
      titulo: "Excluir planejamentos",
      descricao: "Somem das telas de planejamento e do Banco de atividades, mas continuam salvos no conteúdo programático e no relatório de entregas.",
    },
  ];

  return (
    <div className="tv-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="tv-modal" role="dialog" aria-modal="true" aria-labelledby="remover-titulo" style={{ width: 460 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <h2 id="remover-titulo" className="tv-serif" style={{ fontSize: 18, fontWeight: 600, color: C.ink, margin: 0 }}>
            Remover professor
          </h2>
          <button onClick={onCancel} aria-label="Fechar" style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.55, margin: "0 0 16px" }}>
          Você está prestes a remover o acesso de <strong>{professor.nome}</strong> às turmas{" "}
          <strong>{professor.turmas}</strong>. {professor.nome.split(" ")[0]} tem{" "}
          <strong>{totalPlanejamentos} {plural}</strong>. O que fazer com eles?
        </p>

        <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {opcoes.map(({ valor, icone: Icone, titulo, descricao }) => {
            const ativo = destino === valor;
            const perigo = valor === "excluir";
            return (
              <label
                key={valor}
                style={{
                  display: "flex", gap: 12, padding: 12, borderRadius: 9, cursor: "pointer",
                  border: `1.5px solid ${ativo ? (perigo ? C.red : C.gold) : C.border}`,
                  background: ativo ? (perigo ? "#FBEFEC" : "#FBF4E7") : "#fff",
                }}
              >
                <input
                  type="radio"
                  name="destino"
                  value={valor}
                  checked={ativo}
                  onChange={() => setDestino(valor)}
                  style={{ marginTop: 3, accentColor: perigo ? C.red : C.gold }}
                />
                <span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: perigo ? C.red : C.ink }}>
                    <Icone size={14} /> {titulo}
                  </span>
                  <span style={{ display: "block", fontSize: 12.5, color: C.inkSoft, marginTop: 3, lineHeight: 1.5 }}>{descricao}</span>
                </span>
              </label>
            );
          })}
        </div>

        <p style={{ display: "flex", gap: 8, fontSize: 12.5, color: destino === "excluir" ? C.red : C.inkSoft, lineHeight: 1.5, margin: "0 0 18px" }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          {destino === "excluir"
            ? `Os ${totalPlanejamentos} ${plural} deixarão de aparecer no sistema, mas o conteúdo programático e o relatório de entregas continuam completos. A remoção do acesso não pode ser desfeita automaticamente.`
            : "A remoção do acesso não pode ser desfeita automaticamente; para voltar, o professor precisa ser cadastrado de novo."}
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="tv-btn tv-btn-secondary" onClick={onCancel}>Cancelar</button>
          <button
            className="tv-btn tv-btn-primary"
            style={destino === "excluir" ? { background: C.red } : undefined}
            onClick={() => onConfirm(destino)}
          >
            {destino === "excluir" ? "Remover e excluir" : "Remover e manter"}
          </button>
        </div>
      </div>
    </div>
  );
}
