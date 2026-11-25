import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { VinculoEntrada } from "@/lib/consultas";
import type { Papel } from "@/lib/papeis";
import { C } from "@/styles/tokens";
import { chave, type Catalogo } from "./vinculos";

interface Props {
  papel: Papel;
  valor: VinculoEntrada[];
  onChange: (v: VinculoEntrada[]) => void;
  catalogo: Catalogo;
  /** Etapas que quem edita pode mexer (Coordenador: só as suas). */
  etapasEditaveis: number[];
}

/**
 * Permissões por etapa/turma/disciplina (§4.2, §5.3).
 * Coordenador: escolhe etapas. Professor: em cada turma, as disciplinas e a regência.
 */
export function VinculosEditor({ papel, valor, onChange, catalogo, etapasEditaveis }: Props) {
  if (papel === "coordenador") return <EditorEtapas {...{ valor, onChange, catalogo, etapasEditaveis }} />;
  if (papel === "professor") return <EditorTurmas {...{ valor, onChange, catalogo, etapasEditaveis }} />;
  return <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>Este papel tem acesso a todas as etapas e não recebe vínculos.</p>;
}

type EditorProps = Omit<Props, "papel">;

function EditorEtapas({ valor, onChange, catalogo, etapasEditaveis }: EditorProps) {
  const marcadas = new Set(valor.map((v) => v.etapa_id));
  function alternar(id: number) {
    onChange(marcadas.has(id) ? valor.filter((v) => v.etapa_id !== id) : [...valor, { etapa_id: id }]);
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {catalogo.etapas.map((e) => (
        <label key={e.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, color: C.ink, opacity: etapasEditaveis.includes(e.id) ? 1 : 0.5 }}>
          <input type="checkbox" checked={marcadas.has(e.id)} disabled={!etapasEditaveis.includes(e.id)} onChange={() => alternar(e.id)} />
          {e.nome}
        </label>
      ))}
    </div>
  );
}

function EditorTurmas({ valor, onChange, catalogo, etapasEditaveis }: EditorProps) {
  const etapasComVinculo = new Set(valor.map((v) => v.etapa_id));
  const [abertas, setAbertas] = useState<Set<number>>(
    () => new Set(etapasComVinculo.size ? etapasComVinculo : etapasEditaveis.slice(0, 1)),
  );
  const [disciplinaEmMassa, setDisciplinaEmMassa] = useState<Record<number, number | "">>({});
  const selecionados = new Set(valor.map(chave));

  function tem(etapa: number, turma: number, disciplina: number) {
    return selecionados.has(chave({ etapa_id: etapa, turma_id: turma, disciplina_id: disciplina }));
  }

  function alternarDisciplina(etapa: number, turma: number, disciplina: number) {
    if (tem(etapa, turma, disciplina)) {
      onChange(valor.filter((v) => !(v.turma_id === turma && v.disciplina_id === disciplina)));
    } else {
      const regente = valor.some((v) => v.turma_id === turma && v.regente);
      onChange([...valor, { etapa_id: etapa, turma_id: turma, disciplina_id: disciplina, regente }]);
    }
  }

  function alternarRegente(turma: number, regente: boolean) {
    onChange(valor.map((v) => (v.turma_id === turma ? { ...v, regente } : v)));
  }

  /** "Selecionar todas" (§5.3): aplica a disciplina escolhida a todas as turmas da etapa. */
  function aplicarATodas(etapa: number) {
    const disciplina = disciplinaEmMassa[etapa];
    if (!disciplina) return;
    const novos = catalogo.turmas
      .filter((t) => t.etapa_id === etapa && !tem(etapa, t.id, disciplina))
      .map((t) => ({ etapa_id: etapa, turma_id: t.id, disciplina_id: disciplina, regente: false }));
    onChange([...valor, ...novos]);
  }

  function limparEtapa(etapa: number) {
    onChange(valor.filter((v) => v.etapa_id !== etapa));
  }

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 9, overflow: "hidden" }}>
      {catalogo.etapas.map((etapa, i) => {
        const editavel = etapasEditaveis.includes(etapa.id);
        const turmas = catalogo.turmas.filter((t) => t.etapa_id === etapa.id);
        const qtd = valor.filter((v) => v.etapa_id === etapa.id).length;
        const aberta = abertas.has(etapa.id);
        return (
          <div key={etapa.id} style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
            <button
              type="button"
              onClick={() => setAbertas((s) => { const n = new Set(s); if (n.has(etapa.id)) n.delete(etapa.id); else n.add(etapa.id); return n; })}
              style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#F9FAFB", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13.5, fontWeight: 600, color: editavel ? C.ink : C.inkSoft }}>
                {aberta ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {etapa.nome}
                {!editavel && <span style={{ fontWeight: 400, fontSize: 12 }}>(fora do seu escopo)</span>}
              </span>
              {qtd > 0 && <span style={{ fontSize: 12, color: C.primaryDeep }}>{qtd} selecionado{qtd > 1 ? "s" : ""}</span>}
            </button>

            {aberta && (
              <div style={{ padding: "8px 12px 12px" }}>
                {editavel && turmas.length > 0 && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 10, fontSize: 12.5 }}>
                    <select
                      className="tv-input"
                      style={{ width: "auto", padding: "5px 8px", fontSize: 12.5 }}
                      value={disciplinaEmMassa[etapa.id] ?? ""}
                      onChange={(e) => setDisciplinaEmMassa((s) => ({ ...s, [etapa.id]: e.target.value ? Number(e.target.value) : "" }))}
                      aria-label={`Disciplina para todas as turmas de ${etapa.nome}`}
                    >
                      <option value="">Disciplina…</option>
                      {catalogo.disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
                    </select>
                    <button type="button" className="tv-btn-text" onClick={() => aplicarATodas(etapa.id)} disabled={!disciplinaEmMassa[etapa.id]}>
                      Selecionar em todas as turmas
                    </button>
                    {qtd > 0 && (
                      <button type="button" className="tv-btn-text-danger" onClick={() => limparEtapa(etapa.id)}>Limpar etapa</button>
                    )}
                  </div>
                )}
                {turmas.length === 0 && <p style={{ fontSize: 12.5, color: C.inkSoft, margin: 0 }}>Nenhuma turma nesta etapa.</p>}
                {turmas.map((t) => {
                  const regente = valor.some((v) => v.turma_id === t.id && v.regente);
                  const algum = valor.some((v) => v.turma_id === t.id);
                  return (
                    <div key={t.id} style={{ padding: "8px 0", borderTop: `1px dashed ${C.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{t.nome}</span>
                        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, color: algum ? C.ink : C.inkSoft }}>
                          <input type="checkbox" checked={regente} disabled={!editavel || !algum} onChange={(e) => alternarRegente(t.id, e.target.checked)} />
                          Regente da turma
                        </label>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {catalogo.disciplinas.map((d) => {
                          const on = tem(etapa.id, t.id, d.id);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              disabled={!editavel}
                              aria-pressed={on}
                              onClick={() => alternarDisciplina(etapa.id, t.id, d.id)}
                              style={{
                                fontSize: 12, padding: "4px 9px", borderRadius: 999, cursor: editavel ? "pointer" : "not-allowed",
                                border: `1px solid ${on ? C.primary : C.border}`, background: on ? "#E6F0E9" : "#fff",
                                color: on ? C.primaryDeep : C.inkSoft, fontWeight: on ? 600 : 400,
                              }}
                            >
                              {d.nome}
                            </button>
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
      })}
    </div>
  );
}
