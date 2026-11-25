import { BookMarked, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Modal } from "@/components/Modal";
import { useDisciplinas, useRecarregar, type Disciplina } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";

/** Cadastro de disciplinas (Direção e Secretaria). Ex.: Programa Bilíngue, Robótica. */
export function Disciplinas() {
  const disciplinas = useDisciplinas();
  const recarregar = useRecarregar();
  const [editando, setEditando] = useState<{ id: number | null; nome: string } | null>(null);

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 15, fontWeight: 600, margin: 0 }}>
          <BookMarked size={16} color={C.primaryDeep} /> Disciplinas
        </h2>
        <button className="tv-btn tv-btn-secondary" onClick={() => setEditando({ id: null, nome: "" })}>
          <Plus size={14} /> Nova disciplina
        </button>
      </div>
      <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 12px" }}>
        Usadas nas permissões dos professores, na grade horária e nos planejamentos.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(disciplinas.data ?? []).map((d: Disciplina) => (
          <button
            key={d.id}
            onClick={() => setEditando({ id: d.id, nome: d.nome })}
            title="Renomear"
            style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13, padding: "6px 11px", borderRadius: 999, border: `1px solid ${C.border}`, background: "#fff", cursor: "pointer", color: C.ink }}
          >
            {d.nome} <Pencil size={11} color={C.inkSoft} />
          </button>
        ))}
      </div>
      {editando && (
        <DisciplinaModal
          inicial={editando}
          onFechar={() => setEditando(null)}
          onSalvar={async (nome) => {
            verificar(await supabase.rpc("salvar_disciplina", { p_id: editando.id as never, p_nome: nome }));
            await recarregar();
            setEditando(null);
          }}
        />
      )}
    </section>
  );
}

function DisciplinaModal({ inicial, onFechar, onSalvar }: { inicial: { id: number | null; nome: string }; onFechar: () => void; onSalvar: (nome: string) => Promise<void> }) {
  const [nome, setNome] = useState(inicial.nome);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar() {
    setEnviando(true);
    setErro(null);
    try {
      await onSalvar(nome.trim());
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo={inicial.id ? "Renomear disciplina" : "Nova disciplina"}
      subtitulo={inicial.id ? "O novo nome aparece em todos os planejamentos, inclusive os antigos." : undefined}
      onFechar={onFechar}
      rodape={
        <>
          <button className="tv-btn tv-btn-secondary" onClick={onFechar} disabled={enviando}>Cancelar</button>
          <button className="tv-btn tv-btn-primary" onClick={salvar} disabled={enviando || !nome.trim()}>{enviando ? "Salvando…" : "Salvar"}</button>
        </>
      }
    >
      <label>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Nome</span>
        <input className="tv-input" style={{ marginTop: 6 }} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Robótica" autoFocus />
      </label>
      {erro && <div style={{ marginTop: 10 }}><Aviso>{erro}</Aviso></div>}
    </Modal>
  );
}
