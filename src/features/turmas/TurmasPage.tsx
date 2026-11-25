import { ChevronDown, ChevronRight, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { Modal } from "@/components/Modal";
import { Carregando } from "@/components/TelaCarregando";
import {
  formatarData,
  ROTULO_TURNO,
  useEtapas,
  usePerfis,
  useRecarregar,
  useTurmas,
  useVinculos,
  type Etapa,
  type Turma,
  type Turno,
} from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { NIVEL, podeAlterarConfiguracao, podeEditarEtapa } from "@/lib/papeis";
import { supabase } from "@/lib/supabase";
import { useUsuario } from "@/features/auth/AuthContext";
import { C } from "@/styles/tokens";
import { Disciplinas } from "./Disciplinas";

interface TurmaForm {
  id: number | null;
  etapa_id: number;
  nome: string;
  turno: Turno;
}

export function TurmasPage() {
  const eu = useUsuario();
  const etapas = useEtapas();
  const turmas = useTurmas();
  const vinculos = useVinculos();
  const perfis = usePerfis();
  const recarregar = useRecarregar();
  const [abertas, setAbertas] = useState<Set<number>>(() => new Set(eu.etapasCoordenadas.length ? eu.etapasCoordenadas : [1]));
  const [form, setForm] = useState<TurmaForm | null>(null);
  const [removendo, setRemovendo] = useState<Turma | null>(null);

  const erro = etapas.error ?? turmas.error ?? vinculos.error;
  if (erro) return <Aviso>{mensagemDeErro(erro)}</Aviso>;
  if (!etapas.data || !turmas.data || !vinculos.data) return <Carregando />;

  const todosVinculos = vinculos.data;
  const editaveis = etapas.data.filter((e) => podeEditarEtapa(eu, e.id));
  const professoresDa = (turmaId: number) => new Set(todosVinculos.filter((v) => v.turma_id === turmaId).map((v) => v.usuario_id)).size;
  const nomeDe = (id: string | null) => perfis.data?.find((p) => p.id === id)?.nome ?? "outro usuário";

  /** Turma travada por nível superior? (§3.1) */
  function trava(t: Turma): string | null {
    if (podeAlterarConfiguracao(eu.papel, t.definido_por_nivel)) return null;
    return `Definida por ${nomeDe(t.definido_por_id)} em ${formatarData(t.definido_em)}.`;
  }

  function alternar(id: number) {
    setAbertas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div>
      {editaveis.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
          <button className="tv-btn tv-btn-primary" onClick={() => setForm({ id: null, etapa_id: editaveis[0]!.id, nome: "", turno: "matutino" })}>
            <Plus size={16} /> Nova turma
          </button>
        </div>
      )}

      <div className="tv-card" style={{ padding: "6px 0", marginBottom: 22 }}>
        <p style={{ fontSize: 13, color: C.inkSoft, padding: "12px 20px 4px", margin: 0 }}>Estrutura organizacional</p>
        {etapas.data.map((etapa, i) => {
          const daEtapa = turmas.data.filter((t) => t.etapa_id === etapa.id);
          const aberta = abertas.has(etapa.id);
          const podeEditar = podeEditarEtapa(eu, etapa.id);
          return (
            <div key={etapa.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
              <button
                onClick={() => alternar(etapa.id)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 600, color: C.ink }}>
                  {aberta ? <ChevronDown size={16} color={C.inkSoft} /> : <ChevronRight size={16} color={C.inkSoft} />}
                  {etapa.nome}
                </span>
                <span style={{ fontSize: 12.5, color: C.inkSoft }}>
                  {daEtapa.length} {daEtapa.length === 1 ? "turma ativa" : "turmas ativas"}
                </span>
              </button>

              {aberta && (
                <div style={{ padding: "0 20px 20px", display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {daEtapa.map((t) => (
                    <TurmaCard
                      key={t.id}
                      turma={t}
                      professores={professoresDa(t.id)}
                      podeEditar={podeEditar}
                      trava={trava(t)}
                      onEditar={() => setForm({ id: t.id, etapa_id: t.etapa_id, nome: t.nome, turno: t.turno_padrao })}
                      onRemover={() => setRemovendo(t)}
                    />
                  ))}
                  {podeEditar && (
                    <button
                      onClick={() => setForm({ id: null, etapa_id: etapa.id, nome: "", turno: "matutino" })}
                      className="tv-card"
                      style={{ width: 180, minHeight: 96, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", borderStyle: "dashed", color: C.inkSoft, background: "transparent" }}
                    >
                      <Plus size={18} />
                      <span style={{ fontSize: 12.5 }}>Adicionar turma</span>
                    </button>
                  )}
                  {daEtapa.length === 0 && (
                    <p style={{ fontSize: 13, color: C.inkSoft, alignSelf: "center", margin: 0 }}>Nenhuma turma cadastrada nesta etapa ainda.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {NIVEL[eu.papel] >= NIVEL.secretaria && <Disciplinas />}

      {form && (
        <TurmaModal
          form={form}
          etapas={editaveis}
          onCancelar={() => setForm(null)}
          onSalvar={async (f) => {
            verificar(await supabase.rpc("salvar_turma", { p_id: f.id as never, p_etapa: f.etapa_id, p_nome: f.nome, p_turno: f.turno }));
            await recarregar();
            setAbertas((s) => new Set(s).add(f.etapa_id));
            setForm(null);
          }}
        />
      )}

      {removendo && (
        <ConfirmarAcao
          titulo="Remover turma"
          mensagem={
            <>
              Você está prestes a remover a turma <strong>{removendo.nome}</strong> –{" "}
              {etapas.data.find((e) => e.id === removendo.etapa_id)?.nome}. Ela deixa de aparecer nas listas e não poderá
              receber novos planejamentos.
            </>
          }
          irreversivel="Esta ação não pode ser desfeita automaticamente. Os planejamentos já feitos continuam guardados."
          rotuloConfirmar="Remover turma"
          perigo
          onCancelar={() => setRemovendo(null)}
          onConfirmar={async () => {
            verificar(await supabase.rpc("desativar_turma", { p_id: removendo.id }));
            await recarregar();
            setRemovendo(null);
          }}
        />
      )}
    </div>
  );
}

function TurmaCard({
  turma,
  professores,
  podeEditar,
  trava,
  onEditar,
  onRemover,
}: {
  turma: Turma;
  professores: number;
  podeEditar: boolean;
  trava: string | null;
  onEditar: () => void;
  onRemover: () => void;
}) {
  const matutino = turma.turno_padrao === "matutino";
  return (
    <div className="tv-card" style={{ width: 180, padding: 14, borderTop: `3px solid ${matutino ? C.amber : C.primary}` }}>
      <p style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, margin: "0 0 4px" }}>{turma.nome}</p>
      <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 2px", display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: matutino ? C.amber : C.primary, display: "inline-block" }} />
        {ROTULO_TURNO[turma.turno_padrao]}
      </p>
      <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 10px" }}>
        {professores} {professores === 1 ? "professor" : "professores"}
      </p>

      {podeEditar && trava && (
        <p title={trava} style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 12, color: C.inkSoft, borderTop: `1px solid ${C.border}`, paddingTop: 8, margin: 0 }}>
          <Lock size={12} /> Travada por nível superior
        </p>
      )}
      {podeEditar && !trava && (
        <div style={{ display: "flex", gap: 10, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
          <button className="tv-btn-text" onClick={onEditar} style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}>
            <Pencil size={12} /> Editar
          </button>
          <button className="tv-btn-text-danger" onClick={onRemover} style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}>
            <Trash2 size={12} /> Remover
          </button>
        </div>
      )}
    </div>
  );
}

function TurmaModal({
  form: inicial,
  etapas,
  onCancelar,
  onSalvar,
}: {
  form: TurmaForm;
  etapas: Etapa[];
  onCancelar: () => void;
  onSalvar: (f: TurmaForm) => Promise<void>;
}) {
  const [form, setForm] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const valido = form.nome.trim().length > 0;

  async function salvar() {
    setEnviando(true);
    setErro(null);
    try {
      await onSalvar({ ...form, nome: form.nome.trim() });
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo={form.id ? "Editar turma" : "Cadastrar nova turma"}
      subtitulo={form.id ? "Atualize os dados da turma." : "Defina as informações básicas para a nova turma."}
      onFechar={onCancelar}
      rodape={
        <>
          <button className="tv-btn tv-btn-secondary" onClick={onCancelar} disabled={enviando}>Cancelar</button>
          <button className="tv-btn tv-btn-primary" disabled={!valido || enviando} onClick={salvar}>
            {enviando ? "Salvando…" : "Salvar turma"}
          </button>
        </>
      }
    >
      <label style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Etapa</label>
      <select
        className="tv-input"
        style={{ marginTop: 6, marginBottom: 14 }}
        value={form.etapa_id}
        onChange={(e) => setForm((f) => ({ ...f, etapa_id: Number(e.target.value) }))}
      >
        {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
      </select>

      <label style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Nome da turma</label>
      <input
        className="tv-input"
        style={{ marginTop: 6, marginBottom: 14 }}
        placeholder="Ex: Jardim 1"
        value={form.nome}
        onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
      />

      <label style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Turno</label>
      <div style={{ display: "flex", gap: 8, marginTop: 6, marginBottom: 8 }}>
        {(Object.keys(ROTULO_TURNO) as Turno[]).map((turno) => (
          <button
            key={turno}
            type="button"
            onClick={() => setForm((f) => ({ ...f, turno }))}
            className="tv-btn"
            style={{
              flex: 1,
              background: form.turno === turno ? C.primary : "transparent",
              color: form.turno === turno ? "#fff" : C.ink,
              border: `1px solid ${form.turno === turno ? C.primary : C.border}`,
            }}
          >
            {ROTULO_TURNO[turno]}
          </button>
        ))}
      </div>
      {erro && <div style={{ marginTop: 10 }}><Aviso>{erro}</Aviso></div>}
    </Modal>
  );
}
