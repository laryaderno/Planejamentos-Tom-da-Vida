import { Archive, ArrowLeft, CalendarOff, ChevronLeft, ChevronRight, Clock, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router";
import { Aviso } from "@/components/Aviso";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { Carregando } from "@/components/TelaCarregando";
import { useUsuario } from "@/features/auth/AuthContext";
import { useSincronizacao } from "@/lib/offline/SincronizacaoContext";
import { diaDaSemana, useHorariosTurma, vigenteEm, type Horario } from "@/features/grade/api";
import { useDiasSemAula } from "@/features/prazos/DiasSemAula";
import { formatarData, ROTULO_TURNO, useDisciplinas, useEtapas, useVinculos, type Turno } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";
import { useNomes, usePlanejamentoDia, type Bloco } from "./api";
import { BlocoEditor, BlocoLeitura } from "./BlocoEditor";
import { dataPorExtenso, hora, somarDias, statusDoDia } from "./dominio";
import { HistoricoModal } from "./HistoricoModal";
import { Notas } from "./Notas";
import { useMinhasTurmas } from "./PlanejamentosPage";
import { EtiquetaAtrasado, useAtraso } from "./atraso";
import { StatusChip } from "./StatusChip";

const TURNOS: Turno[] = ["matutino", "vespertino"];

/** Planejamento de uma turma num dia e turno (§6). */
export function PlanejamentoDiaPage() {
  const params = useParams();
  const turmaId = Number(params.turma);
  const data = params.data ?? "";
  const turno = (TURNOS.includes(params.turno as Turno) ? params.turno : "matutino") as Turno;

  const eu = useUsuario();
  const { turmas } = useMinhasTurmas();
  const etapas = useEtapas();
  const disciplinas = useDisciplinas();
  const vinculos = useVinculos();
  const dia = usePlanejamentoDia(turmaId, data, turno);
  const qc = useQueryClient();
  const estaAtrasado = useAtraso();
  const [historico, setHistorico] = useState<Bloco | null>(null);
  const [removendo, setRemovendo] = useState<Bloco | null>(null);

  const { pendencias } = useSincronizacao();
  const horarios = useHorariosTurma(turmaId);
  const diasSemAula = useDiasSemAula();
  const [criandoHorario, setCriandoHorario] = useState<number | null>(null);
  // Se o servidor não responder em 4 s, abre com a cópia local.
  const [esperouServidor, setEsperouServidor] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEsperouServidor(true), 4000);
    return () => clearTimeout(t);
  }, []);
  const [erroHorario, setErroHorario] = useState<string | null>(null);

  const p = dia.data;
  // Aulas da grade previstas para esta data e turno.
  const previstos = (horarios.data ?? []).filter(
    (h): h is Horario & { professor_id: string; disciplina_id: number } =>
      h.professor_id !== null && h.disciplina_id !== null &&
      vigenteEm(h, data) && h.dia_semana === diaDaSemana(data) && (h.hora_inicio < "12:00" ? "matutino" : "vespertino") === turno,
  );
  const nomes = useNomes([
    ...(p?.blocos.map((b) => b.professor_id) ?? []),
    ...(p?.notas.map((n) => n.autor_id) ?? []),
    ...previstos.map((h) => h.professor_id),
  ]);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return <Navigate to="/planejamentos" replace />;
  if (dia.error && !dia.data) return <Aviso>{mensagemDeErro(dia.error)}</Aviso>;
  // Com internet, espera a versão atual do servidor antes de montar o editor (a cópia
  // local pode estar velha). Sem resposta do servidor, usa a cópia local.
  const diaAtualizado = dia.isFetchedAfterMount || dia.isError || dia.fetchStatus === "paused" || !navigator.onLine || esperouServidor;
  if (!turmas || pendencias === undefined || dia.isPending || !diaAtualizado || horarios.isPending || diasSemAula.isPending || !etapas.data || !disciplinas.data) return <Carregando />;

  const turma = turmas.find((t) => t.id === turmaId);
  if (!turma) return <Aviso>Você não tem acesso a esta turma.</Aviso>;

  const etapa = etapas.data.find((e) => e.id === turma.etapa_id);
  const exigeLinguagem = Boolean(etapa?.exige_linguagem_amor);
  const nomeDisciplina = (id: number) => disciplinas.data.find((d) => d.id === id)?.nome ?? "Disciplina";
  const nome = (id: string) => (id === eu.id ? "Você" : nomes.data?.get(id) ?? "…");
  const minhasDisciplinas = (vinculos.data ?? [])
    .filter((v) => v.usuario_id === eu.id && v.turma_id === turmaId && v.disciplina_id)
    .map((v) => v.disciplina_id!);
  const souProfessor = eu.papel === "professor" && minhasDisciplinas.length > 0;
  const blocos = p?.blocos ?? [];
  const semAula = diasSemAula.data?.find((d) => d.data === data && (d.etapa_id === null || d.etapa_id === turma.etapa_id));
  const pendentes = previstos.filter((h) => !blocos.some((b) => b.professor_id === h.professor_id && b.disciplina_id === h.disciplina_id));
  const meusPendentes = pendentes.filter((h) => h.professor_id === eu.id);

  async function planejarHorario(h: Horario & { disciplina_id: number }) {
    setCriandoHorario(h.id);
    setErroHorario(null);
    try {
      const plan = verificar(await supabase.rpc("abrir_planejamento", { p_turma: turmaId, p_data: data, p_turno: turno }));
      verificar(await supabase.rpc("criar_bloco", { p_planejamento: plan, p_disciplina: h.disciplina_id, p_inicio: hora(h.hora_inicio), p_fim: hora(h.hora_fim) }));
      await dia.refetch();
    } catch (e) {
      setErroHorario(mensagemDeErro(e));
    } finally {
      setCriandoHorario(null);
    }
  }
  const semanaUrl = `/planejamentos?turma=${turmaId}&semana=${data}`;
  const base = `/planejamentos/${turmaId}`;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <Link to={semanaUrl} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: C.inkSoft, textDecoration: "none" }}>
          <ArrowLeft size={14} /> Voltar para a semana
        </Link>
      </div>

      <section className="tv-card" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <p className="tv-serif" style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{turma.nome}</p>
            <p style={{ fontSize: 13.5, color: C.inkSoft, margin: "3px 0 0" }}>
              {etapa?.nome} · {dataPorExtenso(data)}
            </p>
          </div>
          {blocos.length > 0 && <StatusChip status={statusDoDia(blocos)} />}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
          <Link className="tv-btn tv-btn-secondary" style={{ padding: "6px 9px", textDecoration: "none" }} to={`${base}/${somarDias(data, -1)}/${turno}`} aria-label="Dia anterior">
            <ChevronLeft size={15} />
          </Link>
          <Link className="tv-btn tv-btn-secondary" style={{ padding: "6px 9px", textDecoration: "none" }} to={`${base}/${somarDias(data, 1)}/${turno}`} aria-label="Próximo dia">
            <ChevronRight size={15} />
          </Link>
          <div role="tablist" aria-label="Turno" style={{ display: "flex", gap: 4, marginLeft: 6 }}>
            {TURNOS.map((t) => (
              <Link
                key={t}
                role="tab"
                aria-selected={t === turno}
                to={`${base}/${data}/${t}`}
                style={{
                  fontSize: 12.5, fontWeight: 600, padding: "6px 11px", borderRadius: 999, textDecoration: "none",
                  background: t === turno ? C.primary : "transparent", color: t === turno ? "#fff" : C.inkSoft,
                  border: `1px solid ${t === turno ? C.primary : C.border}`,
                }}
              >
                {ROTULO_TURNO[t]}
              </Link>
            ))}
          </div>
          {p && (
            <span style={{ fontSize: 12, color: C.inkSoft, marginLeft: "auto" }}>
              Criado em {formatarData(p.criado_em, true)} · última alteração {formatarData(p.atualizado_em, true)}
            </span>
          )}
        </div>
      </section>

      {semAula && (
        <Aviso tipo="info">
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><CalendarOff size={14} /> Dia sem aula: {semAula.descricao}.</span>{" "}
          O planejamento deste dia não é exigido para a entrega.
        </Aviso>
      )}

      {blocos.length === 0 && pendentes.length === 0 && !souProfessor && !semAula && (
        <Aviso tipo="info">Ainda não há planejamento para este dia e turno.</Aviso>
      )}

      {!semAula && pendentes.length > 0 && (
        <section className="tv-card" style={{ padding: 16 }}>
          <h2 style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14, fontWeight: 600, margin: "0 0 10px" }}>
            <Clock size={15} color={C.primaryDeep} /> Horários da grade ainda sem planejamento
          </h2>
          {pendentes.map((h) => {
            const meu = h.professor_id === eu.id;
            return (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 0", borderTop: `1px dashed ${C.border}`, fontSize: 13.5 }}>
                <strong>{hora(h.hora_inicio)}–{hora(h.hora_fim)}</strong>
                <span>{nomeDisciplina(h.disciplina_id)}</span>
                <span style={{ color: C.inkSoft }}>· {meu ? "você" : nomes.data?.get(h.professor_id) ?? "…"}</span>
                {meu ? (
                  <button className="tv-btn tv-btn-primary" style={{ marginLeft: "auto", padding: "6px 12px" }} onClick={() => void planejarHorario(h)} disabled={criandoHorario !== null}>
                    {criandoHorario === h.id ? "Criando…" : "Planejar este horário"}
                  </button>
                ) : (
                  <span style={{ marginLeft: "auto", fontSize: 12, color: C.inkSoft }}>aguardando</span>
                )}
              </div>
            );
          })}
          {erroHorario && <div style={{ marginTop: 8 }}><Aviso>{erroHorario}</Aviso></div>}
        </section>
      )}

      {blocos.map((b) => {
        const meu = b.professor_id === eu.id && !b.arquivado_em;
        return (
          <section key={b.id} className="tv-card" style={{ padding: 18, borderLeft: `4px solid ${meu ? C.primary : C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                  {nomeDisciplina(b.disciplina_id)}
                  {!meu && <span style={{ fontWeight: 400, color: C.inkSoft }}> · {hora(b.hora_inicio)}–{hora(b.hora_fim)}</span>}
                </p>
                <p style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: C.inkSoft, margin: "2px 0 0" }}>
                  {nome(b.professor_id)}
                  {!b.arquivado_em && estaAtrasado(turma, b.professor_id, data) && <EtiquetaAtrasado />}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {b.arquivado_em && (
                  <span style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 11.5, color: C.inkSoft, background: "#F3F4F6", padding: "3px 8px", borderRadius: 999 }}>
                    <Archive size={11} /> Arquivado em {formatarData(b.arquivado_em)}
                  </span>
                )}
                {!meu && <StatusChip status={b.status} />}
                {!meu && (
                  <button className="tv-btn-text" style={{ fontSize: 12.5 }} onClick={() => setHistorico(b)}>Histórico</button>
                )}
              </div>
            </div>
            {meu ? (
              <BlocoEditor
                bloco={b}
                pendentes={pendencias.find((x) => x.blocoId === b.id)?.campos}
                etapaId={turma.etapa_id}
                exigeLinguagemAmor={exigeLinguagem}
                onHistorico={() => setHistorico(b)}
                onRemover={() => setRemovendo(b)}
                aoSalvar={atualizarSemana}
              />
            ) : (
              <BlocoLeitura bloco={b} etapaId={turma.etapa_id} exigeLinguagemAmor={exigeLinguagem} />
            )}
          </section>
        );
      })}

      {souProfessor && (
        <NovoBloco
          turmaId={turmaId}
          data={data}
          turno={turno}
          disciplinas={minhasDisciplinas.map((id) => ({ id, nome: nomeDisciplina(id) }))}
          sugestaoInicio={blocos.length ? hora(blocos[blocos.length - 1]!.hora_fim) : turno === "matutino" ? "07:30" : "13:00"}
          aoCriar={() => void dia.refetch()}
          primeiro={blocos.filter((b) => b.professor_id === eu.id).length === 0 && meusPendentes.length === 0 && !semAula}
        />
      )}

      {p && <Notas planejamentoId={p.id} notas={p.notas} nome={nome} aoAdicionar={() => void dia.refetch()} />}

      {historico && <HistoricoModal bloco={historico} onFechar={() => setHistorico(null)} />}
      {removendo && (
        <ConfirmarAcao
          titulo="Remover bloco"
          mensagem={<>Remover o bloco vazio de <strong>{nomeDisciplina(removendo.disciplina_id)}</strong> ({hora(removendo.hora_inicio)}–{hora(removendo.hora_fim)}) deste dia?</>}
          rotuloConfirmar="Remover"
          perigo
          onCancelar={() => setRemovendo(null)}
          onConfirmar={async () => {
            verificar(await supabase.rpc("remover_bloco", { p_id: removendo.id }));
            setRemovendo(null);
            await dia.refetch();
          }}
        />
      )}
    </div>
  );

  // A visão da semana mostra o status; atualiza sem recarregar este editor.
  function atualizarSemana() {
    void qc.invalidateQueries({ queryKey: ["planejamentos", "semana"] });
    void qc.invalidateQueries({ queryKey: ["entregas"] });
    void qc.invalidateQueries({ queryKey: ["notificacoes"] });
  }
}

function NovoBloco({
  turmaId,
  data,
  turno,
  disciplinas,
  sugestaoInicio,
  aoCriar,
  primeiro,
}: {
  turmaId: number;
  data: string;
  turno: Turno;
  disciplinas: { id: number; nome: string }[];
  sugestaoInicio: string;
  aoCriar: () => void;
  primeiro: boolean;
}) {
  const [aberto, setAberto] = useState(primeiro);
  const [disciplina, setDisciplina] = useState(disciplinas[0]?.id ?? 0);
  const [inicio, setInicio] = useState(sugestaoInicio);
  const [fim, setFim] = useState(() => somarHora(sugestaoInicio, primeiro && disciplinas.length === 1 ? 240 : 50));
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function criar(e: FormEvent) {
    e.preventDefault();
    if (fim <= inicio) return setErro("O fim precisa ser depois do início.");
    setEnviando(true);
    setErro(null);
    try {
      const plan = verificar(await supabase.rpc("abrir_planejamento", { p_turma: turmaId, p_data: data, p_turno: turno }));
      verificar(await supabase.rpc("criar_bloco", { p_planejamento: plan, p_disciplina: disciplina, p_inicio: inicio, p_fim: fim }));
      setAberto(false);
      aoCriar();
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <button className="tv-card" onClick={() => setAberto(true)} style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderStyle: "dashed", background: "transparent", color: C.inkSoft, cursor: "pointer", fontSize: 13.5 }}>
        <Plus size={16} /> Adicionar bloco de horário
      </button>
    );
  }

  return (
    <form onSubmit={criar} className="tv-card" style={{ padding: 18 }}>
      <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>{primeiro ? "Começar o planejamento" : "Novo bloco de horário"}</p>
      <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 14px" }}>
        Cada professor preenche o próprio bloco. Os horários dos especialistas aparecem neste mesmo dia.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <label>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Disciplina</span>
          <select className="tv-input" style={{ width: "auto" }} value={disciplina} onChange={(e) => setDisciplina(Number(e.target.value))}>
            {disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </label>
        <label>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Início</span>
          <input type="time" className="tv-input" style={{ width: 110 }} value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fim</span>
          <input type="time" className="tv-input" style={{ width: 110 }} value={fim} onChange={(e) => setFim(e.target.value)} />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          {!primeiro && <button type="button" className="tv-btn tv-btn-secondary" onClick={() => setAberto(false)}>Cancelar</button>}
          <button type="submit" className="tv-btn tv-btn-primary" disabled={enviando}>{enviando ? "Criando…" : "Criar bloco"}</button>
        </div>
      </div>
      {erro && <div style={{ marginTop: 12 }}><Aviso>{erro}</Aviso></div>}
    </form>
  );
}

function somarHora(hhmm: string, minutos: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min((h ?? 0) * 60 + (m ?? 0) + minutos, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
