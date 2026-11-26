import { useSearchParams } from "react-router";
import { useUsuario } from "@/features/auth/AuthContext";
import { NIVEL } from "@/lib/papeis";
import { C } from "@/styles/tokens";
import { EquipePage } from "./EquipePage";
import { ProfessoresPage } from "./ProfessoresPage";

/**
 * "Equipe": professores e gestão na mesma tela, em abas.
 * A Coordenação vê só a aba Professores; a de Gestão é da Secretaria para cima.
 */
export function EquipeAbasPage() {
  const eu = useUsuario();
  const [params, setParams] = useSearchParams();
  const veGestao = NIVEL[eu.papel] >= NIVEL.secretaria;
  const aba = veGestao && params.get("aba") === "gestao" ? "gestao" : "professores";

  return (
    <div>
      {veGestao && (
        <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {(
            [
              ["professores", "Professores"],
              ["gestao", "Gestão"],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              role="tab"
              aria-selected={aba === id}
              onClick={() => setParams(id === "gestao" ? { aba: "gestao" } : {}, { replace: true })}
              style={{
                fontSize: 13, fontWeight: 600, padding: "7px 13px", borderRadius: 999, cursor: "pointer",
                background: aba === id ? C.primary : "#fff", color: aba === id ? "#fff" : C.inkSoft,
                border: `1px solid ${aba === id ? C.primary : C.border}`,
              }}
            >
              {rotulo}
            </button>
          ))}
        </div>
      )}
      {aba === "gestao" ? <EquipePage /> : <ProfessoresPage />}
    </div>
  );
}
