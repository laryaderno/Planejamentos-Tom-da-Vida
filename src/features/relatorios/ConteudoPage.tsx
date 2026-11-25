import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useDadosPrototipo } from "@/mocks/DadosPrototipoContext";

export function ConteudoPage() {
  const { turmas } = useDadosPrototipo();
  return (
    <EmptyState
      icon={BookOpen}
      title="Selecione uma turma para ver o conteúdo programático."
      description="Ao final de cada mês ou bimestre, o sistema reúne os campos “Conteúdo” e “Objetivos de Aprendizagem” de todos os planejamentos da turma em uma agregação somente leitura, pronta para impressão ou exportação."
    >
      <select className="tv-input" style={{ maxWidth: 260, marginTop: 14 }} disabled>
        <option>{turmas[0]?.nome ?? "Nenhuma turma cadastrada"}</option>
      </select>
    </EmptyState>
  );
}
