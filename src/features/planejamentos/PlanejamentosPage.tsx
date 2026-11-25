import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Aviso } from "@/components/Aviso";
import { EmptyState } from "@/components/EmptyState";
import { Carregando } from "@/components/TelaCarregando";
import { useUsuario } from "@/features/auth/AuthContext";
import { ROTULO_TURNO, useEtapas, useTurmas, useVinculos, type Turma } from "@/lib/consultas";
import { mensagemDeErro } from "@/lib/erros";
import { NIVEL } from "@/lib/papeis";
import { C } from "@/styles/tokens";
import { usePlanejamentosSemana } from "./api";
import { dataCurta, deISO, hojeISO, inicioDaSemana, somarDias, statusDoDia } from "./dominio";
import { PrazoDaSemana } from "./PrazoDaSemana";
import { StatusChip } from "./StatusChip";

/** Turmas que o usuário acompanha nesta tela. */
export function useMinhasTurmas(): { turmas: Turma[] | null; erro: unknown } {
  const eu = useUsuario();
  const turmas = useTurmas();
  const vinculos = useVinculos();
  if (!turmas.data || !vinculos.data) return { turmas: null, erro: turmas.error ?? vinculos.error };
  if (NIVEL[eu.papel] >= NIVEL.secretaria) return { turmas: turmas.data, erro: null };
  if (eu.papel === "coordenador") return { turmas: turmas.data.filter((t) => eu.etapasCoordenadas.includes(t.etapa_id)), erro: null };
  const minhas = new Set(vinculos.data.filter((v) => v.usuario_id === eu.id).map((v) => v.turma_id));
  return { turmas: turmas.data.filter((t) => minhas.has(t.id)), erro: null };
}

const DIAS_UTEIS = 5;

/** Planejamentos por turma e semana (segunda a sexta). */
export function PlanejamentosPage() {
  const eu = useUsuario();
  const [params, setParams] = useSearchParams();
  const { turmas, erro } = useMinhasTurmas();
  const etapas = useEtapas();

  const semana = inicioDaSemana(params.get("semana") ?? hojeISO());
  const fim = somarDias(semana, DIAS_UTEIS - 1);
  const turmaId = Number(params.get("turma")) || turmas?.[0]?.id || null;
  const turma = turmas?.find((t) => t.id === turmaId) ?? null;
  const planejamentos = usePlanejamentosSemana(turma?.id ?? null, semana, fim);

  function ir(mudancas: Record<string, string>) {
    const novo = new URLSearchParams(params);
    for (const [k, v] of Object.entries(mudancas)) novo.set(k, v);
    setParams(novo, { replace: true });
  }

  if (erro) return <Aviso>{mensagemDeErro(erro)}</Aviso>;
  if (!turmas) return <Carregando />;
  if (turmas.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nenhuma turma disponível."
        description={eu.papel === "professor" ? "Você ainda não foi vinculado a nenhuma turma. Fale com a coordenação." : "Não há turmas no seu escopo."}
      />
    );
  }

  const hoje = hojeISO();
  const dias = Array.from({ length: DIAS_UTEIS }, (_, i) => somarDias(semana, i));
  const periodo = `${deISO(semana).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${deISO(fim).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
  const etapaNome = (id: number) => etapas.data?.find((e) => e.id === id)?.nome ?? "";

  return (
    <div>
      <div className="tv-card" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }} htmlFor="sel-turma">Turma</label>
        <select id="sel-turma" className="tv-input" style={{ width: "auto", minWidth: 200 }} value={turma?.id ?? ""} onChange={(e) => ir({ turma: e.target.value })}>
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>{t.nome} — {etapaNome(t.etapa_id)}</option>
          ))}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <button className="tv-btn tv-btn-secondary" style={{ padding: "7px 9px" }} aria-label="Semana anterior" onClick={() => ir({ semana: somarDias(semana, -7) })}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 170, textAlign: "center" }}>{periodo}</span>
          <button className="tv-btn tv-btn-secondary" style={{ padding: "7px 9px" }} aria-label="Próxima semana" onClick={() => ir({ semana: somarDias(semana, 7) })}>
            <ChevronRight size={16} />
          </button>
          {semana !== inicioDaSemana(hoje) && (
            <button className="tv-btn-text" onClick={() => ir({ semana: hoje })}>Hoje</button>
          )}
        </div>
      </div>

      {turma && <PrazoDaSemana turmaId={turma.id} inicio={semana} fim={fim} />}

      {planejamentos.error && <Aviso>{mensagemDeErro(planejamentos.error)}</Aviso>}
      {!planejamentos.data && !planejamentos.error && <Carregando />}

      {planejamentos.data && turma && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
          {dias.map((dia) => {
            const doDia = planejamentos.data.filter((p) => p.data === dia);
            const turnos = [...new Set([turma.turno_padrao, ...doDia.map((p) => p.turno)])];
            return (
              <div key={dia} className="tv-card" style={{ padding: 14, borderColor: dia === hoje ? C.gold : undefined }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, margin: "0 0 10px", textTransform: "capitalize" }}>
                  {dataCurta(dia)}
                  {dia === hoje && <span style={{ color: C.goldDeep, fontWeight: 500 }}> · hoje</span>}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {turnos.map((turno) => {
                    const p = doDia.find((x) => x.turno === turno);
                    const meus = p?.blocos.filter((b) => b.professor_id === eu.id) ?? [];
                    const blocos = eu.papel === "professor" ? meus : (p?.blocos ?? []);
                    return (
                      <Link
                        key={turno}
                        to={`/planejamentos/${turma.id}/${dia}/${turno}`}
                        style={{ display: "block", padding: "9px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", textDecoration: "none", color: C.ink }}
                      >
                        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 12.5, color: C.inkSoft }}>{ROTULO_TURNO[turno]}</span>
                          {blocos.length > 0 ? <StatusChip status={statusDoDia(blocos)} compacto /> : null}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, marginTop: 4, color: blocos.length ? C.ink : C.inkSoft }}>
                          {blocos.length > 0 ? (
                            `${blocos.length} ${blocos.length === 1 ? "bloco" : "blocos"}`
                          ) : eu.papel === "professor" ? (
                            <><Plus size={12} /> Planejar</>
                          ) : (
                            "Sem planejamento"
                          )}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
