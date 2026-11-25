import { Clock, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { Carregando } from "@/components/TelaCarregando";
import { useUsuario } from "@/features/auth/AuthContext";
import { useMinhasTurmas } from "@/features/planejamentos/PlanejamentosPage";
import { dataCurta, hojeISO, hora } from "@/features/planejamentos/dominio";
import { formatarData, useDisciplinas, useEtapas, usePerfis, useRecarregar, useVinculos } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { podeAlterarConfiguracao, podeEditarEtapa } from "@/lib/papeis";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";
import { DIAS_SEMANA, ehRotina, ordenarAulas, ROTINAS, useHorariosTurma, vigenteEm, type AulaGrade } from "./api";

type AulaEditavel = AulaGrade & { chave: number };
let proximaChave = 1;

function chaveAula(a: AulaGrade) {
  return `${a.dia_semana}|${hora(a.hora_inicio)}|${hora(a.hora_fim)}|${a.disciplina_id}|${a.professor_id}|${a.rotulo ?? ""}`;
}

/** Grade horária de cada turma (Coordenação na sua etapa, Secretaria, Direção). */
export function GradeHorariaPage() {
  const eu = useUsuario();
  const { turmas, erro } = useMinhasTurmas();
  const etapas = useEtapas();
  const disciplinas = useDisciplinas();
  const perfis = usePerfis();
  const vinculos = useVinculos();
  const [turmaId, setTurmaId] = useState<number | null>(null);
  const turma = turmas?.find((t) => t.id === (turmaId ?? turmas[0]?.id)) ?? null;
  const horarios = useHorariosTurma(turma?.id ?? null);
  const recarregar = useRecarregar();
  const [edicao, setEdicao] = useState<{ aulas: AulaEditavel[]; desde: string } | null>(null);
  const [revisando, setRevisando] = useState(false);

  if (erro) return <Aviso>{mensagemDeErro(erro)}</Aviso>;
  if (!turmas || !disciplinas.data || !vinculos.data) return <Carregando />;
  if (!turma) return <EmptyState icon={Clock} title="Nenhuma turma no seu escopo." description="" />;

  const hoje = hojeISO();
  const todas = horarios.data ?? [];
  const vigentes = ordenarAulas(todas.filter((h) => vigenteEm(h, hoje)));
  const futuras = todas.filter((h) => h.vigente_desde > hoje);
  const proximaData = futuras.length ? futuras.map((h) => h.vigente_desde).sort()[0]! : null;
  const daProxima = proximaData ? ordenarAulas(futuras.filter((h) => h.vigente_desde === proximaData)) : [];
  const desdeAtual = vigentes[0]?.vigente_desde ?? null;
  const definidor = [...vigentes, ...futuras].sort((a, b) => b.definido_por_nivel - a.definido_por_nivel)[0];
  const travada = definidor ? !podeAlterarConfiguracao(eu.papel, definidor.definido_por_nivel) : false;
  const podeEditar = podeEditarEtapa(eu, turma.etapa_id) && !travada;

  const nomeProf = (id: string | null) => perfis.data?.find((p) => p.id === id)?.nome ?? "—";
  // Quem definiu a grade (o nome pode não estar visível, ex.: Coordenação não vê o perfil da Direção).
  const quemDefiniu = (h: { definido_por_id: string | null; definido_por_nivel: number }) => {
    const nome = perfis.data?.find((p) => p.id === h.definido_por_id)?.nome;
    if (nome) return `por ${nome}`;
    return h.definido_por_nivel >= 40 ? "pela Direção" : h.definido_por_nivel >= 30 ? "pela Secretaria Acadêmica" : "pela Coordenação";
  };
  const nomeDisc = (id: number | null) => disciplinas.data.find((d) => d.id === id)?.nome ?? "—";
  const vincTurma = vinculos.data.filter((v) => v.turma_id === turma.id && v.disciplina_id);
  const disciplinasDaTurma = [...new Set(vincTurma.map((v) => v.disciplina_id!))];
  const professoresDe = (disc: number) => [...new Set(vincTurma.filter((v) => v.disciplina_id === disc).map((v) => v.usuario_id))];

  function editar(base: AulaGrade[], desde: string) {
    setEdicao({
      desde,
      aulas: base.map((a) => ({ ...a, hora_inicio: hora(a.hora_inicio), hora_fim: hora(a.hora_fim), chave: proximaChave++ })),
    });
  }

  function mudar(chave: number, campo: keyof AulaGrade, valor: string | number) {
    setEdicao((e) => e && {
      ...e,
      aulas: e.aulas.map((a) => {
        if (a.chave !== chave) return a;
        const nova = { ...a, [campo]: valor };
        // trocar a disciplina pode exigir trocar o professor
        if (campo === "disciplina_id" && !professoresDe(Number(valor)).includes(nova.professor_id ?? "")) {
          nova.professor_id = professoresDe(Number(valor))[0] ?? "";
        }
        return nova;
      }),
    });
  }

  function adicionar(dia: number, tipo: "aula" | "rotina") {
    setEdicao((e) => {
      if (!e) return e;
      const doDia = ordenarAulas(e.aulas.filter((a) => a.dia_semana === dia));
      const inicio = doDia.length ? doDia[doDia.length - 1]!.hora_fim : turma!.turno_padrao === "matutino" ? "07:30" : "13:00";
      const disc = disciplinasDaTurma[0] ?? null;
      const nova: AulaEditavel =
        tipo === "rotina"
          ? { chave: proximaChave++, dia_semana: dia, hora_inicio: inicio, hora_fim: somarMin(inicio, 20), disciplina_id: null, professor_id: null, rotulo: "Lanche" }
          : { chave: proximaChave++, dia_semana: dia, hora_inicio: inicio, hora_fim: somarMin(inicio, 50), disciplina_id: disc, professor_id: disc ? professoresDe(disc)[0] ?? null : null, rotulo: null };
      return { ...e, aulas: [...e.aulas, nova] };
    });
  }

  const rotinaSemNome = edicao?.aulas.some((a) => ehRotina(a) && !a.rotulo?.trim()) ?? false;

  const etapaNome = etapas.data?.find((e) => e.id === turma.etapa_id)?.nome ?? "";

  return (
    <div>
      <div className="tv-card" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }} htmlFor="grade-turma">Turma</label>
        <select
          id="grade-turma"
          className="tv-input"
          style={{ width: "auto", minWidth: 200 }}
          value={turma.id}
          disabled={!!edicao}
          onChange={(e) => setTurmaId(Number(e.target.value))}
        >
          {(etapas.data ?? []).map((e) => {
            const daEtapa = turmas.filter((t) => t.etapa_id === e.id);
            return daEtapa.length ? (
              <optgroup key={e.id} label={e.nome}>
                {daEtapa.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </optgroup>
            ) : null;
          })}
        </select>
        <span style={{ fontSize: 13, color: C.inkSoft }}>{etapaNome}</span>
        {!edicao && podeEditar && (
          <button className="tv-btn tv-btn-primary" style={{ marginLeft: "auto" }} onClick={() => editar(proximaData ? daProxima : vigentes, proximaData ?? hoje)}>
            <Pencil size={14} /> {vigentes.length || daProxima.length ? "Editar grade" : "Montar grade"}
          </button>
        )}
        {!edicao && travada && definidor && (
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 5, alignItems: "center", fontSize: 12.5, color: C.inkSoft }}>
            <Lock size={13} /> Definida {quemDefiniu(definidor)} em {formatarData(definidor.definido_em)}
          </span>
        )}
      </div>

      {horarios.error && <Aviso>{mensagemDeErro(horarios.error)}</Aviso>}

      {!edicao && (
        <>
          {vigentes.length === 0 && daProxima.length === 0 ? (
            <EmptyState
              icon={Clock}
              title={`${turma.nome} ainda não tem grade horária.`}
              description="Com a grade, cada professor vê os próprios horários, os blocos do dia já vêm com horário e disciplina, e a entrega do período passa a considerar exatamente as aulas de cada um."
            />
          ) : (
            <>
              {vigentes.length > 0 && (
                <Grade titulo={`Em vigor desde ${desdeAtual ? dataCurta(desdeAtual) : ""}`} aulas={vigentes} nomeProf={nomeProf} nomeDisc={nomeDisc} />
              )}
              {proximaData && (
                <div style={{ marginTop: 20 }}>
                  <Grade titulo={`Nova grade a partir de ${dataCurta(proximaData)}`} aulas={daProxima} nomeProf={nomeProf} nomeDisc={nomeDisc} />
                </div>
              )}
            </>
          )}
        </>
      )}

      {edicao && (
        <div>
          {disciplinasDaTurma.length === 0 && (
            <div style={{ marginBottom: 12 }}>
              <Aviso tipo="info">Nenhum professor vinculado a esta turma. Defina as permissões dos professores antes de montar a grade.</Aviso>
            </div>
          )}
          <datalist id="rotinas-grade">
            {ROTINAS.map((r) => <option key={r} value={r} />)}
          </datalist>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {DIAS_SEMANA.map((nomeDia, i) => {
              const dia = i + 1;
              const doDia = ordenarAulas(edicao.aulas.filter((a) => a.dia_semana === dia));
              return (
                <div key={dia} className="tv-card" style={{ padding: 12 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 600, margin: "0 0 10px" }}>{nomeDia}</p>
                  {doDia.map((a) => (
                    <div key={a.chave} style={{ borderTop: `1px dashed ${C.border}`, padding: "8px 0", display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input type="time" className="tv-input" style={{ padding: "5px 6px", fontSize: 12.5 }} value={a.hora_inicio} onChange={(e) => mudar(a.chave, "hora_inicio", e.target.value)} aria-label="Início" />
                        <input type="time" className="tv-input" style={{ padding: "5px 6px", fontSize: 12.5 }} value={a.hora_fim} onChange={(e) => mudar(a.chave, "hora_fim", e.target.value)} aria-label="Fim" />
                        <button className="tv-btn-text-danger" aria-label="Remover aula" onClick={() => setEdicao((e) => e && { ...e, aulas: e.aulas.filter((x) => x.chave !== a.chave) })}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {ehRotina(a) ? (
                        <>
                          <input
                            className="tv-input"
                            style={{ padding: "5px 6px", fontSize: 12.5, fontStyle: "italic" }}
                            list="rotinas-grade"
                            value={a.rotulo ?? ""}
                            onChange={(e) => mudar(a.chave, "rotulo", e.target.value)}
                            aria-label="Momento de rotina"
                            placeholder="Ex.: Lanche"
                          />
                          <span style={{ fontSize: 11.5, color: C.inkSoft }}>Momento de rotina (sem professor)</span>
                        </>
                      ) : (
                        <>
                          <select className="tv-input" style={{ padding: "5px 6px", fontSize: 12.5 }} value={a.disciplina_id ?? ""} onChange={(e) => mudar(a.chave, "disciplina_id", Number(e.target.value))} aria-label="Disciplina">
                            {disciplinasDaTurma.map((d) => <option key={d} value={d}>{nomeDisc(d)}</option>)}
                          </select>
                          <select className="tv-input" style={{ padding: "5px 6px", fontSize: 12.5 }} value={a.professor_id ?? ""} onChange={(e) => mudar(a.chave, "professor_id", e.target.value)} aria-label="Professor">
                            {professoresDe(a.disciplina_id ?? 0).map((p) => <option key={p} value={p}>{nomeProf(p)}</option>)}
                          </select>
                        </>
                      )}
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <button className="tv-btn-text" style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 12.5 }} onClick={() => adicionar(dia, "aula")} disabled={disciplinasDaTurma.length === 0}>
                      <Plus size={13} /> Aula
                    </button>
                    <button className="tv-btn-text" style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 12.5 }} onClick={() => adicionar(dia, "rotina")}>
                      <Plus size={13} /> Rotina
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="tv-card" style={{ padding: 14, marginTop: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 13, fontWeight: 600 }} htmlFor="grade-desde">Vale a partir de</label>
            <input id="grade-desde" type="date" className="tv-input" style={{ width: "auto" }} value={edicao.desde} onChange={(e) => setEdicao({ ...edicao, desde: e.target.value })} />
            <span style={{ fontSize: 12.5, color: C.inkSoft }}>Antes dessa data continua valendo a grade anterior.</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="tv-btn tv-btn-secondary" onClick={() => setEdicao(null)}>Cancelar</button>
              <button className="tv-btn tv-btn-primary" disabled={!edicao.desde || rotinaSemNome} title={rotinaSemNome ? "Dê um nome a cada momento de rotina." : undefined} onClick={() => setRevisando(true)}>Revisar e salvar</button>
            </div>
          </div>
        </div>
      )}

      {revisando && edicao && (
        <RevisarGrade
          turmaNome={turma.nome}
          desde={edicao.desde}
          antes={edicao.desde >= (proximaData ?? "9999") ? daProxima : vigentes}
          depois={edicao.aulas}
          nomeProf={nomeProf}
          nomeDisc={nomeDisc}
          onVoltar={() => setRevisando(false)}
          onSalvar={async () => {
            const aulas: AulaGrade[] = edicao.aulas.map(({ chave: _c, ...a }) => a);
            verificar(await supabase.rpc("salvar_grade", { p_turma: turma.id, p_vigente_desde: edicao.desde, p_aulas: aulas as never }));
            await recarregar();
            setRevisando(false);
            setEdicao(null);
          }}
        />
      )}
    </div>
  );
}

function Grade({ titulo, aulas, nomeProf, nomeDisc }: { titulo: string; aulas: AulaGrade[]; nomeProf: (id: string | null) => string; nomeDisc: (id: number | null) => string }) {
  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: C.inkSoft, margin: "0 0 10px" }}>{titulo}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {DIAS_SEMANA.map((nomeDia, i) => {
          const doDia = aulas.filter((a) => a.dia_semana === i + 1);
          return (
            <div key={nomeDia} className="tv-card" style={{ padding: 12 }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, margin: "0 0 8px" }}>{nomeDia}</p>
              {doDia.length === 0 && <p style={{ fontSize: 12.5, color: C.inkSoft, margin: 0 }}>Sem aulas</p>}
              {doDia.map((a, j) => (
                <div key={j} style={{ padding: "6px 0", borderTop: j ? `1px dashed ${C.border}` : "none", fontSize: 12.5 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{hora(a.hora_inicio)}–{hora(a.hora_fim)}</p>
                  {ehRotina(a) ? (
                    <p style={{ margin: 0, fontStyle: "italic", color: C.inkSoft }}>{a.rotulo}</p>
                  ) : (
                    <>
                      <p style={{ margin: 0 }}>{nomeDisc(a.disciplina_id)}</p>
                      <p style={{ margin: 0, color: C.inkSoft }}>{nomeProf(a.professor_id)}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RevisarGrade({
  turmaNome, desde, antes, depois, nomeProf, nomeDisc, onVoltar, onSalvar,
}: {
  turmaNome: string;
  desde: string;
  antes: AulaGrade[];
  depois: AulaGrade[];
  nomeProf: (id: string | null) => string;
  nomeDisc: (id: number | null) => string;
  onVoltar: () => void;
  onSalvar: () => Promise<void>;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const chavesAntes = new Set(antes.map(chaveAula));
  const chavesDepois = new Set(depois.map(chaveAula));
  const adicionadas = ordenarAulas(depois.filter((a) => !chavesAntes.has(chaveAula(a))));
  const removidas = ordenarAulas(antes.filter((a) => !chavesDepois.has(chaveAula(a))));
  const texto = (a: AulaGrade) =>
    `${DIAS_SEMANA[a.dia_semana - 1]} ${hora(a.hora_inicio)}–${hora(a.hora_fim)} · ${ehRotina(a) ? a.rotulo : `${nomeDisc(a.disciplina_id)} · ${nomeProf(a.professor_id)}`}`;

  async function salvar() {
    setEnviando(true);
    setErro(null);
    try {
      await onSalvar();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo="Confirmar grade horária"
      largura={520}
      onFechar={onVoltar}
      rodape={
        <>
          <button className="tv-btn tv-btn-secondary" onClick={onVoltar} disabled={enviando}>Voltar</button>
          <button className="tv-btn tv-btn-primary" onClick={salvar} disabled={enviando}>{enviando ? "Salvando…" : "Salvar grade"}</button>
        </>
      }
    >
      <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: "0 0 12px" }}>
        A grade de <strong>{turmaNome}</strong> passa a valer a partir de <strong>{dataCurta(desde)}</strong> com{" "}
        {depois.filter((a) => !ehRotina(a)).length} {depois.filter((a) => !ehRotina(a)).length === 1 ? "aula" : "aulas"} por semana.
      </p>
      {adicionadas.length === 0 && removidas.length === 0 && <p style={{ fontSize: 13, color: C.inkSoft }}>Nenhuma aula mudou; só a data de início.</p>}
      {adicionadas.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: C.inkSoft, margin: "0 0 4px" }}>Aulas novas ou alteradas</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#3F6136", lineHeight: 1.6 }}>
            {adicionadas.map((a, i) => <li key={i}>+ {texto(a)}</li>)}
          </ul>
        </div>
      )}
      {removidas.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: C.inkSoft, margin: "0 0 4px" }}>Aulas que saem</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.red, lineHeight: 1.6 }}>
            {removidas.map((a, i) => <li key={i}>− {texto(a)}</li>)}
          </ul>
        </div>
      )}
      <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "8px 0 0" }}>
        Antes de {dataCurta(desde)} continua valendo a grade anterior; entregas já registradas não mudam.
      </p>
      {erro && <div style={{ marginTop: 12 }}><Aviso>{erro}</Aviso></div>}
    </Modal>
  );
}

function somarMin(hhmm: string, minutos: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min((h ?? 0) * 60 + (m ?? 0) + minutos, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
