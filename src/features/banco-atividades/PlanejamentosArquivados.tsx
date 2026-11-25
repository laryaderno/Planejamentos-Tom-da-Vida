import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { Link } from "react-router";
import { Aviso } from "@/components/Aviso";
import { EmptyState } from "@/components/EmptyState";
import { Carregando } from "@/components/TelaCarregando";
import { useNomes } from "@/features/planejamentos/api";
import { dataCurta, hora } from "@/features/planejamentos/dominio";
import { formatarData, ROTULO_TURNO, useDisciplinas, type Turno } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";

interface Arquivado {
  id: number;
  conteudo: string;
  hora_inicio: string;
  hora_fim: string;
  professor_id: string;
  disciplina_id: number;
  arquivado_em: string;
  planejamentos: { turma_id: number; data: string; turno: Turno };
}

/** Banco de atividades → Planejamentos: blocos de professores removidos com "Manter" (D6). */
export function PlanejamentosArquivados({ turmaId, turmaNome }: { turmaId: number; turmaNome: string }) {
  const disciplinas = useDisciplinas();
  const consulta = useQuery({
    queryKey: ["planejamentos", "arquivados", turmaId],
    queryFn: async () =>
      verificar(
        await supabase
          .from("blocos")
          .select("id, conteudo, hora_inicio, hora_fim, professor_id, disciplina_id, arquivado_em, planejamentos!inner(turma_id, data, turno)")
          .not("arquivado_em", "is", null)
          .eq("planejamentos.turma_id", turmaId)
          .order("arquivado_em", { ascending: false }),
      ) as unknown as Arquivado[],
  });
  const nomes = useNomes((consulta.data ?? []).map((b) => b.professor_id));

  if (consulta.error) return <Aviso>{mensagemDeErro(consulta.error)}</Aviso>;
  if (!consulta.data) return <Carregando />;
  if (consulta.data.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={`Nenhum planejamento arquivado em ${turmaNome}.`}
        description="Ao remover um professor, quem remove pode escolher manter os planejamentos dele; eles aparecem aqui."
      />
    );
  }

  const ordenados = [...consulta.data].sort((a, b) => b.planejamentos.data.localeCompare(a.planejamentos.data));
  return (
    <div className="tv-card" style={{ overflow: "hidden" }}>
      {ordenados.map((b, i) => {
        const p = b.planejamentos;
        return (
          <Link
            key={b.id}
            to={`/planejamentos/${p.turma_id}/${p.data}/${p.turno}`}
            style={{ display: "block", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${C.border}`, textDecoration: "none", color: C.ink }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>{b.conteudo || "Sem conteúdo"}</p>
            <p style={{ fontSize: 12.5, color: C.inkSoft, margin: 0, textTransform: "capitalize" }}>
              {dataCurta(p.data)} · {ROTULO_TURNO[p.turno]} {hora(b.hora_inicio)}–{hora(b.hora_fim)} ·{" "}
              {disciplinas.data?.find((d) => d.id === b.disciplina_id)?.nome} · {nomes.data?.get(b.professor_id) ?? "…"} ·{" "}
              <span style={{ textTransform: "none" }}>arquivado em {formatarData(b.arquivado_em)}</span>
            </p>
          </Link>
        );
      })}
    </div>
  );
}
