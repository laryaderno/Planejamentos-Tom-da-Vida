import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDadosPrototipo } from "@/mocks/DadosPrototipoContext";
import { C } from "@/styles/tokens";
import type { Professor } from "@/types/dominio";
import { RemoverProfessorModal } from "./RemoverProfessorModal";

export function ProfessoresPage() {
  const { professores, planejamentos, removerProfessor } = useDadosPrototipo();
  const [removendo, setRemovendo] = useState<Professor | null>(null);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
        <button className="tv-btn tv-btn-primary" disabled title="Disponível em uma próxima etapa">
          <Plus size={16} /> Cadastrar professor
        </button>
      </div>
      <div className="tv-card" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: "#F4F1E6", textAlign: "left" }}>
              {["Nome", "Turmas", "E-mail", ""].map((h) => (
                <th key={h} style={{ padding: "12px 18px", fontWeight: 600, color: C.inkSoft, fontSize: 12.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {professores.map((p) => (
              <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: "12px 18px", color: C.ink, fontWeight: 500 }}>{p.nome}</td>
                <td style={{ padding: "12px 18px", color: C.inkSoft }}>{p.turmas}</td>
                <td style={{ padding: "12px 18px", color: C.inkSoft }}>{p.email}</td>
                <td style={{ padding: "12px 18px", textAlign: "right" }}>
                  <button
                    className="tv-btn-text-danger"
                    onClick={() => setRemovendo(p)}
                    style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <Trash2 size={12} /> Remover
                  </button>
                </td>
              </tr>
            ))}
            {professores.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "18px", color: C.inkSoft, textAlign: "center" }}>
                  Nenhum professor cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {removendo && (
        <RemoverProfessorModal
          professor={removendo}
          totalPlanejamentos={planejamentos.filter((pl) => pl.professorId === removendo.id && !pl.arquivadoEm && !pl.excluidoEm).length}
          onCancel={() => setRemovendo(null)}
          onConfirm={(destino) => {
            removerProfessor(removendo.id, destino);
            setRemovendo(null);
          }}
        />
      )}
    </div>
  );
}
