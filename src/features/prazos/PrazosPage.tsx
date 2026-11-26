import { CalendarDays, Lock, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { Carregando } from "@/components/TelaCarregando";
import { useUsuario } from "@/features/auth/AuthContext";
import { useEntregas, usePeriodos, SITUACAO, type Periodo, type SituacaoEntrega } from "@/features/notificacoes/api";
import { dataCurta, hojeISO, inicioDaSemana, somarDias } from "@/features/planejamentos/dominio";
import { formatarData, useEtapas, usePerfis, useRecarregar, useTurmas } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { podeAlterarConfiguracao } from "@/lib/papeis";
import { supabase } from "@/lib/supabase";
import { DiasSemAula } from "./DiasSemAula";
import { EmailsAutomaticos } from "./EmailsAutomaticos";
import { C } from "@/styles/tokens";

interface Form {
  id: number | null;
  inicio: string;
  fim: string;
  prazo: string;
  /** null = todas as etapas */
  etapa: number | null;
  /** Personalizado: as turmas escolhidas (null = por etapa). */
  turmas: number[] | null;
}

function diasEntre(a: string, b: string): number {
  return Math.round((new Date(b + "T12:00").getTime() - new Date(a + "T12:00").getTime()) / 86_400_000);
}

/** Períodos de entrega e data-limite de cada um (definidos pela Direção ou Secretaria). */
export function PrazosPage() {
  const eu = useUsuario();
  const periodos = usePeriodos();
  const entregas = useEntregas();
  const perfis = usePerfis();
  const etapas = useEtapas();
  const turmas = useTurmas();
  const recarregar = useRecarregar();
  const [filtro, setFiltro] = useState<number | "todas">("todas");
  const [form, setForm] = useState<Form | null>(null);
  const [removendo, setRemovendo] = useState<Periodo | null>(null);

  if (periodos.error) return <Aviso>{mensagemDeErro(periodos.error)}</Aviso>;
  if (!periodos.data) return <Carregando />;

  const hoje = hojeISO();
  const nomeDe = (id: string | null) => perfis.data?.find((p) => p.id === id)?.nome ?? "outro usuário";
  const contagem = (id: number) => {
    const doPeriodo = (entregas.data ?? []).filter((e) => e.periodo_id === id);
    return (Object.keys(SITUACAO) as SituacaoEntrega[]).map((s) => ({ s, n: doPeriodo.filter((e) => e.situacao === s).length }));
  };

  const foraDoPL = (id: number) => (entregas.data ?? []).filter((e) => e.periodo_id === id && e.fora_do_pl).length;
  const nomeEtapa = (id: number | null) => (id === null ? "Todas as etapas" : etapas.data?.find((e) => e.id === id)?.nome ?? "");
  const nomeTurma = (id: number) => turmas.data?.find((t) => t.id === id)?.nome ?? "turma";
  const etapaDaTurma = (id: number) => turmas.data?.find((t) => t.id === id)?.etapa_id;
  const abrangencia = (p: Periodo) =>
    p.turmas.length > 0 ? `Personalizado: ${p.turmas.map(nomeTurma).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })).join(", ")}` : nomeEtapa(p.etapa_id);
  const lista = periodos.data.filter(
    (p) =>
      filtro === "todas" ||
      (p.turmas.length > 0 ? p.turmas.some((t) => etapaDaTurma(t) === filtro) : p.etapa_id === filtro || p.etapa_id === null),
  );

  function novo() {
    // Sugestão: o período seguinte ao último desta etapa, com a mesma duração e a mesma antecedência do prazo.
    const etapa = filtro === "todas" ? null : filtro;
    const ultimo = periodos.data?.find((p) => p.etapa_id === etapa && p.turmas.length === 0);
    if (ultimo) {
      const inicio = inicioDaSemana(somarDias(ultimo.fim, 3));
      setForm({ id: null, inicio, fim: somarDias(inicio, diasEntre(ultimo.inicio, ultimo.fim)), prazo: somarDias(inicio, diasEntre(ultimo.inicio, ultimo.prazo)), etapa, turmas: null });
    } else {
      const inicio = inicioDaSemana(somarDias(hoje, 7));
      setForm({ id: null, inicio, fim: somarDias(inicio, 4), prazo: somarDias(inicio, -3), etapa, turmas: null });
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <p style={{ fontSize: 13.5, color: C.inkSoft, margin: 0, maxWidth: 620, lineHeight: 1.6 }}>
          Cadastre os períodos de planejamento de cada etapa (ou de turmas escolhidas, no modo personalizado) e a data-limite de entrega. O período conta como entregue quando o
          professor conclui todos os dias dele. Entregas com 2 ou mais dias úteis de folga contam como{" "}
          <strong>com antecedência</strong>; no dia ou na véspera, <strong>no prazo</strong>; depois, <strong>com atraso</strong>.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select className="tv-input" style={{ width: "auto" }} value={filtro} onChange={(e) => setFiltro(e.target.value === "todas" ? "todas" : Number(e.target.value))} aria-label="Etapa">
            <option value="todas">Todas as etapas</option>
            {etapas.data?.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          <button className="tv-btn tv-btn-primary" onClick={novo}>
            <Plus size={16} /> Novo período
          </button>
        </div>
      </div>

      {lista.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nenhum período cadastrado." description="Sem períodos, as entregas de planejamento não são registradas nem notificadas." />
      ) : (
        <div className="tv-card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: "#F9FAFB", textAlign: "left" }}>
                {["Período", "Etapa ou turmas", "Data-limite", "Entregas", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", fontWeight: 600, color: C.inkSoft, fontSize: 12.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const travado = !podeAlterarConfiguracao(eu.papel, p.definido_por_nivel);
                const atual = p.inicio <= hoje && hoje <= p.fim;
                const qtd = contagem(p.id);
                const temEntregas = qtd.some((x) => x.n > 0);
                return (
                  <tr key={p.id} style={{ borderTop: `1px solid ${C.border}`, background: atual ? "#F0F6F2" : undefined }}>
                    <td style={{ padding: "12px 16px", textTransform: "capitalize" }}>
                      {dataCurta(p.inicio)} – {dataCurta(p.fim)}
                      {atual && <span style={{ textTransform: "none", color: C.primaryDeep, fontWeight: 600 }}> · atual</span>}
                    </td>
                    <td style={{ padding: "12px 16px", color: C.inkSoft, maxWidth: 260 }}>{abrangencia(p)}</td>
                    <td style={{ padding: "12px 16px", textTransform: "capitalize", color: p.prazo < hoje ? C.inkSoft : C.ink }}>{dataCurta(p.prazo)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12.5 }}>
                        {qtd.map(({ s, n }) => (
                          <span key={s} style={{ color: SITUACAO[s].cor }}>{n} {SITUACAO[s].rotulo.toLowerCase()}</span>
                        ))}
                        {foraDoPL(p.id) > 0 && <span style={{ color: "#6D28D9" }}>{foraDoPL(p.id)} fora do PL</span>}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {travado ? (
                        <span title={`Definido por ${nomeDe(p.definido_por_id)} em ${formatarData(p.definido_em)}.`} style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 12, color: C.inkSoft }}>
                          <Lock size={12} /> Definido pela Direção
                        </span>
                      ) : temEntregas ? (
                        <span style={{ fontSize: 12, color: C.inkSoft }}>Com entregas</span>
                      ) : (
                        <span style={{ display: "inline-flex", gap: 10 }}>
                          <button className="tv-btn-text" style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 12.5 }} onClick={() => setForm({ id: p.id, inicio: p.inicio, fim: p.fim, prazo: p.prazo, etapa: p.etapa_id, turmas: p.turmas.length > 0 ? p.turmas : null })}>
                            <Pencil size={12} /> Editar
                          </button>
                          <button className="tv-btn-text-danger" style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 12.5 }} onClick={() => setRemovendo(p)}>
                            <Trash2 size={12} /> Remover
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <EmailsAutomaticos />
      </div>

      <div style={{ marginTop: 32 }}>
        <DiasSemAula />
      </div>

      {form && (
        <PeriodoModal
          form={form}
          onCancelar={() => setForm(null)}
          onSalvar={async (f) => {
            verificar(
              await supabase.rpc("salvar_periodo", {
                p_id: f.id as never, p_inicio: f.inicio, p_fim: f.fim, p_prazo: f.prazo,
                p_etapa: (f.turmas ? null : f.etapa) as never, p_turmas: (f.turmas ?? null) as never,
              }),
            );
            await recarregar();
            setForm(null);
          }}
        />
      )}
      {removendo && (
        <ConfirmarAcao
          titulo="Remover período"
          mensagem={<>Você está prestes a remover o período de <strong>{dataCurta(removendo.inicio)}</strong> a <strong>{dataCurta(removendo.fim)}</strong>, com data-limite em {dataCurta(removendo.prazo)}. Entregas desse período deixam de ser registradas.</>}
          irreversivel="Esta ação não pode ser desfeita automaticamente."
          rotuloConfirmar="Remover período"
          perigo
          onCancelar={() => setRemovendo(null)}
          onConfirmar={async () => {
            verificar(await supabase.rpc("remover_periodo", { p_id: removendo.id }));
            await recarregar();
            setRemovendo(null);
          }}
        />
      )}
    </div>
  );
}

function PeriodoModal({ form: inicial, onCancelar, onSalvar }: { form: Form; onCancelar: () => void; onSalvar: (f: Form) => Promise<void> }) {
  const etapas = useEtapas();
  const turmas = useTurmas();
  const [f, setF] = useState(inicial);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const valido = f.inicio && f.fim && f.prazo && f.fim >= f.inicio && (f.turmas === null || f.turmas.length > 0);
  const escolhidas = new Set(f.turmas ?? []);
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const alternar = (id: number) =>
    setF((x) => ({ ...x, turmas: escolhidas.has(id) ? (x.turmas ?? []).filter((t) => t !== id) : [...(x.turmas ?? []), id] }));

  async function salvar() {
    setEnviando(true);
    setErro(null);
    try {
      await onSalvar(f);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  const campo = (rotulo: string, chave: "inicio" | "fim" | "prazo") => (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{rotulo}</span>
      <input type="date" className="tv-input" style={{ marginTop: 6 }} value={f[chave]} onChange={(e) => setF((x) => ({ ...x, [chave]: e.target.value }))} />
    </label>
  );

  return (
    <Modal
      titulo={f.id ? "Editar período" : "Novo período"}
      subtitulo="Os planejamentos deste intervalo de datas precisam ser entregues até a data-limite."
      onFechar={onCancelar}
      rodape={
        <>
          <button className="tv-btn tv-btn-secondary" onClick={onCancelar} disabled={enviando}>Cancelar</button>
          <button className="tv-btn tv-btn-primary" onClick={salvar} disabled={!valido || enviando}>{enviando ? "Salvando…" : "Salvar período"}</button>
        </>
      }
    >
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Vale para</span>
        <select
          className="tv-input"
          style={{ marginTop: 6 }}
          value={f.turmas ? "personalizado" : (f.etapa ?? "")}
          onChange={(e) => {
            const v = e.target.value;
            setF((x) => (v === "personalizado" ? { ...x, etapa: null, turmas: x.turmas ?? [] } : { ...x, etapa: v === "" ? null : Number(v), turmas: null }));
          }}
        >
          <option value="">Todas as etapas</option>
          {etapas.data?.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          <option value="personalizado">Personalizado (escolher as turmas)</option>
        </select>
      </label>
      {f.turmas && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ position: "relative", marginBottom: 8 }}>
            <Search size={14} color={C.inkSoft} style={{ position: "absolute", left: 10, top: 12 }} />
            <input className="tv-input" style={{ paddingLeft: 30 }} placeholder="Pesquisar turma" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Pesquisar turma" />
          </div>
          <div className="tv-scroll" style={{ maxHeight: 220, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px" }}>
            {etapas.data?.map((e) => {
              const daEtapa = (turmas.data ?? [])
                .filter((t) => t.etapa_id === e.id && (!termo || t.nome.toLocaleLowerCase("pt-BR").includes(termo)))
                .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
              if (daEtapa.length === 0) return null;
              const todas = daEtapa.every((t) => escolhidas.has(t.id));
              return (
                <div key={e.id} style={{ padding: "6px 0" }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, fontWeight: 600, color: C.inkSoft }}>
                    <input
                      type="checkbox"
                      checked={todas}
                      onChange={() =>
                        setF((x) => {
                          const ids = daEtapa.map((t) => t.id);
                          const resto = (x.turmas ?? []).filter((t) => !ids.includes(t));
                          return { ...x, turmas: todas ? resto : [...resto, ...ids] };
                        })
                      }
                    />
                    {e.nome}
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", padding: "4px 0 0 22px" }}>
                    {daEtapa.map((t) => (
                      <label key={t.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                        <input type="checkbox" checked={escolhidas.has(t.id)} onChange={() => alternar(t.id)} />
                        {t.nome}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: f.turmas.length ? C.inkSoft : C.red, margin: "6px 0 0" }}>
            {f.turmas.length === 0 ? "Escolha pelo menos uma turma." : `${f.turmas.length} ${f.turmas.length === 1 ? "turma escolhida" : "turmas escolhidas"}.`}
          </p>
        </div>
      )}
      {campo("Primeiro dia do período", "inicio")}
      {campo("Último dia do período", "fim")}
      {campo("Data-limite de entrega", "prazo")}
      {f.fim < f.inicio && <p style={{ fontSize: 12.5, color: C.red, margin: "0 0 8px" }}>O último dia precisa ser depois do primeiro.</p>}
      {erro && <Aviso>{erro}</Aviso>}
    </Modal>
  );
}
