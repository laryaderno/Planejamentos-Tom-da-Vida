import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { DestinoPlanejamentos, PlanejamentoResumo, Professor, Turma } from "@/types/dominio";
import { PLANEJAMENTOS_INICIAIS, PROFESSORES, TURMAS_INICIAIS } from "./dados";

/**
 * Estado em memória do protótipo (turmas editáveis). Substituído por
 * consultas ao Supabase via TanStack Query na Fase 2.
 */
interface DadosPrototipo {
  turmas: Turma[];
  setTurmas: Dispatch<SetStateAction<Turma[]>>;
  professores: Professor[];
  planejamentos: PlanejamentoResumo[];
  /** Simula a RPC `remover_professor` (ARQUITETURA.md §3.2, decisão D6). */
  removerProfessor: (professorId: number, destino: DestinoPlanejamentos) => void;
}

const Ctx = createContext<DadosPrototipo | null>(null);

export function DadosPrototipoProvider({ children }: { children: ReactNode }) {
  const [turmas, setTurmas] = useState<Turma[]>(TURMAS_INICIAIS);
  const [professores, setProfessores] = useState<Professor[]>(PROFESSORES);
  const [planejamentos, setPlanejamentos] = useState<PlanejamentoResumo[]>(PLANEJAMENTOS_INICIAIS);

  function removerProfessor(professorId: number, destino: DestinoPlanejamentos) {
    const hoje = new Date().toLocaleDateString("pt-BR");
    // Nada é apagado: "excluir" só esconde (ver ARQUITETURA.md §3.2).
    const marca = destino === "excluir" ? { excluidoEm: hoje } : { arquivadoEm: hoje };
    setPlanejamentos((prev) => prev.map((p) => (p.professorId === professorId ? { ...p, ...marca } : p)));
    setProfessores((prev) => prev.filter((p) => p.id !== professorId));
  }

  return (
    <Ctx.Provider value={{ turmas, setTurmas, professores, planejamentos, removerProfessor }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDadosPrototipo(): DadosPrototipo {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDadosPrototipo precisa estar dentro de DadosPrototipoProvider");
  return ctx;
}
