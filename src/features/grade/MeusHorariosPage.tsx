import { Clock } from "lucide-react";
import { Link } from "react-router";
import { Aviso } from "@/components/Aviso";
import { EmptyState } from "@/components/EmptyState";
import { Carregando } from "@/components/TelaCarregando";
import { useUsuario } from "@/features/auth/AuthContext";
import { hojeISO, hora, inicioDaSemana, somarDias } from "@/features/planejamentos/dominio";
import { useDisciplinas, useTurmas } from "@/lib/consultas";
import { mensagemDeErro } from "@/lib/erros";
import { C } from "@/styles/tokens";
import { DIAS_SEMANA, ordenarAulas, useMeusHorarios, vigenteEm } from "./api";

/** A semana do professor em todas as turmas, conforme a grade horária. */
export function MeusHorariosPage() {
  const eu = useUsuario();
  const horarios = useMeusHorarios(eu.id);
  const turmas = useTurmas();
  const disciplinas = useDisciplinas();

  if (horarios.error) return <Aviso>{mensagemDeErro(horarios.error)}</Aviso>;
  if (!horarios.data) return <Carregando />;

  const hoje = hojeISO();
  const segunda = inicioDaSemana(hoje);
  const atuais = ordenarAulas(horarios.data.filter((h) => vigenteEm(h, hoje)));
  const nomeTurma = (id: number) => turmas.data?.find((t) => t.id === id)?.nome ?? "Turma";
  const nomeDisc = (id: number) => disciplinas.data?.find((d) => d.id === id)?.nome ?? "";
  const turnoDe = (h: string) => (h < "12:00" ? "matutino" : "vespertino");

  if (atuais.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="Você ainda não tem aulas na grade horária."
        description="Quando a coordenação ou a secretaria montar a grade das suas turmas, seus horários aparecem aqui."
      />
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13.5, color: C.inkSoft, margin: "0 0 16px", maxWidth: 620, lineHeight: 1.6 }}>
        Seus horários definidos pela coordenação. Clique numa aula para planejar o dia desta semana.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {DIAS_SEMANA.map((nomeDia, i) => {
          const dia = i + 1;
          const data = somarDias(segunda, i);
          const doDia = atuais.filter((h) => h.dia_semana === dia);
          return (
            <div key={dia} className="tv-card" style={{ padding: 12, borderColor: data === hoje ? C.gold : undefined }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, margin: "0 0 8px" }}>
                {nomeDia}
                {data === hoje && <span style={{ color: C.goldDeep, fontWeight: 500 }}> · hoje</span>}
              </p>
              {doDia.length === 0 && <p style={{ fontSize: 12.5, color: C.inkSoft, margin: 0 }}>Sem aulas</p>}
              {doDia.map((h) => (
                <Link
                  key={h.id}
                  to={`/planejamentos/${h.turma_id}/${data}/${turnoDe(h.hora_inicio)}`}
                  style={{ display: "block", padding: "8px 10px", marginTop: 6, borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", textDecoration: "none", color: C.ink, fontSize: 12.5 }}
                >
                  <strong>{hora(h.hora_inicio)}–{hora(h.hora_fim)}</strong>
                  <span style={{ display: "block" }}>{nomeTurma(h.turma_id)}</span>
                  <span style={{ display: "block", color: C.inkSoft }}>{nomeDisc(h.disciplina_id)}</span>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
