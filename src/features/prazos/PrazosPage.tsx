import { CalendarDays, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { Carregando } from "@/components/TelaCarregando";
import { useUsuario } from "@/features/auth/AuthContext";
import { useEntregas, usePeriodos, SITUACAO, type Periodo, type SituacaoEntrega } from "@/features/notificacoes/api";
import { dataCurta, hojeISO, inicioDaSemana, somarDias } from "@/features/planejamentos/dominio";
import { formatarData, usePerfis, useRecarregar } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { podeAlterarConfiguracao } from "@/lib/papeis";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";

interface Form {
  id: number | null;
  inicio: string;
  fim: string;
  prazo: string;
}

/** Períodos de entrega e data-limite de cada um (definidos pela Direção ou Secretaria). */
export function PrazosPage() {
  const eu = useUsuario();
  const periodos = usePeriodos();
  const entregas = useEntregas();
  const perfis = usePerfis();
  const recarregar = useRecarregar();
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

  function novo() {
    // Sugestão: próxima semana sem período, com prazo na sexta anterior.
    const ultimo = periodos.data?.[0];
    const inicio = ultimo && ultimo.fim >= hoje ? inicioDaSemana(somarDias(ultimo.fim, 3)) : inicioDaSemana(somarDias(hoje, 7));
    setForm({ id: null, inicio, fim: somarDias(inicio, 4), prazo: somarDias(inicio, -3) });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <p style={{ fontSize: 13.5, color: C.inkSoft, margin: 0, maxWidth: 620, lineHeight: 1.6 }}>
          Cadastre cada período de planejamento e a data-limite de entrega. O período conta como entregue quando o
          professor conclui todos os dias dele. Entregas com 2 ou mais dias úteis de folga contam como{" "}
          <strong>com antecedência</strong>; no dia ou na véspera, <strong>no prazo</strong>; depois, <strong>com atraso</strong>.
        </p>
        <button className="tv-btn tv-btn-primary" onClick={novo}>
          <Plus size={16} /> Novo período
        </button>
      </div>

      {periodos.data.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nenhum período cadastrado." description="Sem períodos, as entregas de planejamento não são registradas nem notificadas." />
      ) : (
        <div className="tv-card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: "#F4F1E6", textAlign: "left" }}>
                {["Período", "Data-limite", "Entregas", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", fontWeight: 600, color: C.inkSoft, fontSize: 12.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodos.data.map((p) => {
                const travado = !podeAlterarConfiguracao(eu.papel, p.definido_por_nivel);
                const atual = p.inicio <= hoje && hoje <= p.fim;
                const qtd = contagem(p.id);
                const temEntregas = qtd.some((x) => x.n > 0);
                return (
                  <tr key={p.id} style={{ borderTop: `1px solid ${C.border}`, background: atual ? "#FBF4E7" : undefined }}>
                    <td style={{ padding: "12px 16px", textTransform: "capitalize" }}>
                      {dataCurta(p.inicio)} – {dataCurta(p.fim)}
                      {atual && <span style={{ textTransform: "none", color: C.goldDeep, fontWeight: 600 }}> · atual</span>}
                    </td>
                    <td style={{ padding: "12px 16px", textTransform: "capitalize", color: p.prazo < hoje ? C.inkSoft : C.ink }}>{dataCurta(p.prazo)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12.5 }}>
                        {qtd.map(({ s, n }) => (
                          <span key={s} style={{ color: SITUACAO[s].cor }}>{n} {SITUACAO[s].rotulo.toLowerCase()}</span>
                        ))}
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
                          <button className="tv-btn-text" style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 12.5 }} onClick={() => setForm({ id: p.id, inicio: p.inicio, fim: p.fim, prazo: p.prazo })}>
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

      {form && (
        <PeriodoModal
          form={form}
          onCancelar={() => setForm(null)}
          onSalvar={async (f) => {
            verificar(await supabase.rpc("salvar_periodo", { p_id: f.id as never, p_inicio: f.inicio, p_fim: f.fim, p_prazo: f.prazo }));
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
  const [f, setF] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const valido = f.inicio && f.fim && f.prazo && f.fim >= f.inicio;

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

  const campo = (rotulo: string, chave: keyof Omit<Form, "id">) => (
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
      {campo("Primeiro dia do período", "inicio")}
      {campo("Último dia do período", "fim")}
      {campo("Data-limite de entrega", "prazo")}
      {f.fim < f.inicio && <p style={{ fontSize: 12.5, color: C.red, margin: "0 0 8px" }}>O último dia precisa ser depois do primeiro.</p>}
      {erro && <Aviso>{erro}</Aviso>}
    </Modal>
  );
}
