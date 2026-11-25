import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useDadosPrototipo } from "@/mocks/DadosPrototipoContext";
import { C } from "@/styles/tokens";
import { ETAPAS, TURNOS, type Etapa, type Turma } from "@/types/dominio";

type TurmaForm = Omit<Turma, "id" | "professores"> & Partial<Pick<Turma, "id" | "professores">>;
type ModalState = { mode: "create" | "edit"; form: TurmaForm };

export function TurmasPage() {
  const { turmas, setTurmas } = useDadosPrototipo();
  const [expanded, setExpanded] = useState<Partial<Record<Etapa, boolean>>>({ "Educação Infantil": true });
  const [modal, setModal] = useState<ModalState | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);

  function toggleEtapa(etapa: Etapa) {
    setExpanded((e) => ({ ...e, [etapa]: !e[etapa] }));
  }

  function openCreate(etapa?: Etapa) {
    setModal({ mode: "create", form: { etapa: etapa ?? ETAPAS[0], nome: "", turno: "Matutino" } });
  }

  function openEdit(turma: Turma) {
    setModal({ mode: "edit", form: { ...turma } });
  }

  function saveModal(form: TurmaForm) {
    if (modal?.mode === "create") {
      const nextId = turmas.length ? Math.max(...turmas.map((t) => t.id)) + 1 : 1;
      setTurmas((prev) => [...prev, { id: nextId, professores: 0, ...form }]);
      setExpanded((e) => ({ ...e, [form.etapa]: true }));
    } else {
      setTurmas((prev) => prev.map((t) => (t.id === form.id ? { ...t, ...form } : t)));
    }
    setModal(null);
  }

  function removeTurma(id: number) {
    setTurmas((prev) => prev.filter((t) => t.id !== id));
    setConfirmRemoveId(null);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
        <button className="tv-btn tv-btn-primary" onClick={() => openCreate()}>
          <Plus size={16} /> Nova turma
        </button>
      </div>

      <div className="tv-card" style={{ padding: "6px 0", marginBottom: 22 }}>
        <p style={{ fontSize: 13, color: C.inkSoft, padding: "12px 20px 4px", margin: 0 }}>Estrutura organizacional</p>
        {ETAPAS.map((etapa, i) => {
          const turmasDaEtapa = turmas.filter((t) => t.etapa === etapa);
          const isOpen = !!expanded[etapa];
          return (
            <div key={etapa} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
              <button
                onClick={() => toggleEtapa(etapa)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 600, color: C.ink }}>
                  {isOpen ? <ChevronDown size={16} color={C.inkSoft} /> : <ChevronRight size={16} color={C.inkSoft} />}
                  {etapa}
                </span>
                <span style={{ fontSize: 12.5, color: C.inkSoft }}>
                  {turmasDaEtapa.length} {turmasDaEtapa.length === 1 ? "turma ativa" : "turmas ativas"}
                </span>
              </button>

              {isOpen && (
                <div style={{ padding: "0 20px 20px", display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {turmasDaEtapa.map((t) => (
                    <TurmaCard
                      key={t.id}
                      turma={t}
                      confirming={confirmRemoveId === t.id}
                      onEdit={() => openEdit(t)}
                      onAskRemove={() => setConfirmRemoveId(t.id)}
                      onCancelRemove={() => setConfirmRemoveId(null)}
                      onConfirmRemove={() => removeTurma(t.id)}
                    />
                  ))}
                  <button
                    onClick={() => openCreate(etapa)}
                    className="tv-card"
                    style={{
                      width: 180, minHeight: 96, display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: 6, cursor: "pointer", borderStyle: "dashed", color: C.inkSoft,
                      background: "transparent",
                    }}
                  >
                    <Plus size={18} />
                    <span style={{ fontSize: 12.5 }}>Adicionar turma</span>
                  </button>
                  {turmasDaEtapa.length === 0 && (
                    <p style={{ fontSize: 13, color: C.inkSoft, alignSelf: "center", margin: 0 }}>
                      Nenhuma turma cadastrada nesta etapa ainda.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal && <TurmaModal modal={modal} onCancel={() => setModal(null)} onSave={saveModal} />}
    </div>
  );
}

interface TurmaCardProps {
  turma: Turma;
  confirming: boolean;
  onEdit: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
}

function TurmaCard({ turma, confirming, onEdit, onAskRemove, onCancelRemove, onConfirmRemove }: TurmaCardProps) {
  const isMatutino = turma.turno === "Matutino";
  return (
    <div className="tv-card" style={{ width: 180, padding: 14, borderTop: `3px solid ${isMatutino ? C.amber : C.sidebarSoft}`, borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
      <p style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, margin: "0 0 4px" }}>{turma.nome}</p>
      <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 2px", display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: isMatutino ? C.amber : C.sidebarSoft, display: "inline-block" }} />
        {turma.turno}
      </p>
      <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 10px" }}>
        {turma.professores} {turma.professores === 1 ? "professor" : "professores"}
      </p>

      {confirming ? (
        <div>
          <p style={{ fontSize: 12, color: C.ink, margin: "0 0 8px" }}>Remover esta turma?</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="tv-btn-text-danger" onClick={onConfirmRemove} style={{ fontSize: 12.5, fontWeight: 600 }}>Confirmar</button>
            <button className="tv-btn-text" onClick={onCancelRemove} style={{ fontSize: 12.5, fontWeight: 600, color: C.inkSoft }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
          <button className="tv-btn-text" onClick={onEdit} style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}>
            <Pencil size={12} /> Editar
          </button>
          <button className="tv-btn-text-danger" onClick={onAskRemove} style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}>
            <Trash2 size={12} /> Remover
          </button>
        </div>
      )}
    </div>
  );
}

interface TurmaModalProps {
  modal: ModalState;
  onCancel: () => void;
  onSave: (form: TurmaForm) => void;
}

function TurmaModal({ modal, onCancel, onSave }: TurmaModalProps) {
  const [form, setForm] = useState(modal.form);
  const valid = form.nome.trim().length > 0;

  return (
    <div className="tv-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="tv-modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <h2 className="tv-serif" style={{ fontSize: 18, fontWeight: 600, color: C.ink, margin: 0 }}>
            {modal.mode === "create" ? "Cadastrar nova turma" : "Editar turma"}
          </h2>
          <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 18px" }}>
          {modal.mode === "create" ? "Defina as informações básicas para a nova turma." : "Atualize os dados da turma."}
        </p>

        <label style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Etapa</label>
        <select
          className="tv-input"
          style={{ marginTop: 6, marginBottom: 14 }}
          value={form.etapa}
          onChange={(e) => setForm((f) => ({ ...f, etapa: e.target.value as Etapa }))}
        >
          {ETAPAS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>

        <label style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Nome da turma</label>
        <input
          className="tv-input"
          style={{ marginTop: 6, marginBottom: 14 }}
          placeholder="Ex: Jardim 1"
          value={form.nome}
          onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value as Etapa }))}
        />

        <label style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Turno</label>
        <div style={{ display: "flex", gap: 8, marginTop: 6, marginBottom: 22 }}>
          {TURNOS.map((turno) => (
            <button
              key={turno}
              type="button"
              onClick={() => setForm((f) => ({ ...f, turno }))}
              className="tv-btn"
              style={{
                flex: 1,
                background: form.turno === turno ? C.sidebar : "transparent",
                color: form.turno === turno ? "#fff" : C.ink,
                border: `1px solid ${form.turno === turno ? C.sidebar : C.border}`,
              }}
            >
              {turno}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="tv-btn tv-btn-secondary" onClick={onCancel}>Cancelar</button>
          <button className="tv-btn tv-btn-primary" disabled={!valid} onClick={() => onSave(form)}>
            Salvar turma
          </button>
        </div>
      </div>
    </div>
  );
}
