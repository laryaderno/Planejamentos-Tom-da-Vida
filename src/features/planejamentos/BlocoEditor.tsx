import { AlertTriangle, CheckCircle2, CloudOff, History, Loader2, Save, Trash2 } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { Aviso } from "@/components/Aviso";
import { AnexosBloco } from "@/features/atividades/AnexosBloco";
import { formatarData } from "@/lib/consultas";
import { C } from "@/styles/tokens";
import type { Bloco } from "./api";
import {
  CAMPOS_TEXTO,
  hora,
  INTELIGENCIAS,
  LINGUAGENS_AMOR,
  STATUS,
  type CampoTexto,
  type Inteligencia,
  type LinguagemAmor,
  type StatusBloco,
} from "./dominio";
import { useSalvamento, type EstadoSalvamento } from "./useSalvamento";

interface Props {
  bloco: Bloco;
  /** Alterações ainda guardadas no navegador (não enviadas): prevalecem sobre o servidor. */
  pendentes?: Record<string, unknown>;
  etapaId: number;
  exigeLinguagemAmor: boolean;
  onHistorico: () => void;
  onRemover?: () => void;
  aoSalvar: () => void;
}

const rotulo: CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, color: C.ink, marginBottom: 5 };

/** Edição do bloco do próprio professor, com salvamento automático (§6, §7). */
export function BlocoEditor({ bloco, pendentes = {}, etapaId, exigeLinguagemAmor, onHistorico, onRemover, aoSalvar }: Props) {
  const s = useSalvamento(bloco, aoSalvar);
  // Valores iniciais: o que está no servidor, com as alterações guardadas no navegador por cima.
  const [inicial] = useState(() => ({ ...bloco, ...pendentes }) as Bloco);
  const [textos, setTextos] = useState<Record<CampoTexto, string>>(() =>
    Object.fromEntries(CAMPOS_TEXTO.map((c) => [c.chave, inicial[c.chave]])) as Record<CampoTexto, string>,
  );
  const [inicio, setInicio] = useState(hora(inicial.hora_inicio));
  const [fim, setFim] = useState(hora(inicial.hora_fim));
  const [habilidades, setHabilidades] = useState<Inteligencia[]>(inicial.habilidades);
  const [linguagens, setLinguagens] = useState<LinguagemAmor[]>(inicial.linguagens_amor);
  const [status, setStatus] = useState<StatusBloco>(inicial.status);

  const vazio = Object.values(textos).every((t) => !t.trim()) && habilidades.length === 0 && status === "cinza";
  const verdeBloqueado = exigeLinguagemAmor && linguagens.length === 0;

  /** Começou a preencher um bloco "Não iniciado": passa sozinho para "Em andamento". */
  function comecou() {
    if (status !== "cinza") return;
    setStatus("amarelo");
    s.alterar("status", "amarelo");
  }

  function texto(campo: CampoTexto, v: string) {
    setTextos((t) => ({ ...t, [campo]: v }));
    s.alterar(campo, v);
    if (v.trim()) comecou();
  }

  function alternarHabilidade(h: Inteligencia) {
    const nova = habilidades.includes(h) ? habilidades.filter((x) => x !== h) : [...habilidades, h];
    setHabilidades(nova);
    s.alterar("habilidades", nova);
    if (nova.length > habilidades.length) comecou();
  }

  function horario(campo: "hora_inicio" | "hora_fim", v: string) {
    if (campo === "hora_inicio") setInicio(v);
    else setFim(v);
    const ini = campo === "hora_inicio" ? v : inicio;
    const f = campo === "hora_fim" ? v : fim;
    if (ini && f && f > ini) {
      s.alterar("hora_inicio", ini);
      s.alterar("hora_fim", f);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <span style={rotulo}>Horário</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="time" className="tv-input" style={{ width: 110 }} value={inicio} onChange={(e) => horario("hora_inicio", e.target.value)} aria-label="Início" />
            <span style={{ color: C.inkSoft }}>às</span>
            <input type="time" className="tv-input" style={{ width: 110 }} value={fim} onChange={(e) => horario("hora_fim", e.target.value)} aria-label="Fim" />
          </div>
          {fim <= inicio && <p style={{ fontSize: 12, color: C.red, margin: "4px 0 0" }}>O fim precisa ser depois do início.</p>}
        </div>
        <div>
          <span style={rotulo}>Status</span>
          <div role="radiogroup" aria-label="Status" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(Object.keys(STATUS) as StatusBloco[]).map((st) => {
              const ativo = status === st;
              const bloqueado = st === "verde" && verdeBloqueado;
              return (
                <button
                  key={st}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  disabled={bloqueado}
                  title={bloqueado ? "Marque ao menos uma Linguagem do Amor trabalhada para concluir." : undefined}
                  onClick={() => {
                    setStatus(st);
                    s.alterar("status", st);
                  }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 999, fontSize: 12.5, fontWeight: 600,
                    cursor: bloqueado ? "not-allowed" : "pointer", opacity: bloqueado ? 0.5 : 1,
                    border: `1.5px solid ${ativo ? STATUS[st].cor : C.border}`, background: ativo ? STATUS[st].fundo : "#fff", color: STATUS[st].cor,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS[st].cor }} />
                  {STATUS[st].rotulo}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {exigeLinguagemAmor && (
        <fieldset style={{ border: `1px solid ${linguagens.length ? C.border : "#E3B9A8"}`, borderRadius: 9, padding: "10px 12px 12px", margin: "0 0 16px" }}>
          <legend style={{ fontSize: 12.5, fontWeight: 600, padding: "0 4px" }}>
            Linguagens do Amor trabalhadas <span style={{ color: C.red }}>*</span>
            <span style={{ fontWeight: 400, color: C.inkSoft }}> — marque uma ou mais; obrigatório para concluir</span>
          </legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
            {(Object.keys(LINGUAGENS_AMOR) as LinguagemAmor[]).map((l) => (
              <label key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={linguagens.includes(l)}
                  onChange={() => {
                    const nova = linguagens.includes(l) ? linguagens.filter((x) => x !== l) : [...linguagens, l];
                    setLinguagens(nova);
                    s.alterar("linguagens_amor", nova);
                    if (nova.length > linguagens.length) comecou();
                    // sem nenhuma linguagem, não pode continuar concluído
                    if (nova.length === 0 && status === "verde") {
                      setStatus("amarelo");
                      s.alterar("status", "amarelo");
                    }
                  }}
                />
                {LINGUAGENS_AMOR[l]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {CAMPOS_TEXTO.map((c) => (
          <label key={c.chave} style={{ display: "block" }}>
            <span style={rotulo}>{c.rotulo}</span>
            <textarea
              className="tv-input"
              rows={c.chave === "conteudo" ? 2 : 3}
              style={{ resize: "vertical", lineHeight: 1.5, fontFamily: "inherit" }}
              value={textos[c.chave]}
              onChange={(e) => texto(c.chave, e.target.value)}
            />
            {c.chave === "atividades" && (
              <AnexosBloco blocoId={bloco.id} etapaId={etapaId} disciplinaId={bloco.disciplina_id} editavel />
            )}
            {c.chave === "objetivos" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }} aria-label="Inteligências trabalhadas">
                {(Object.keys(INTELIGENCIAS) as Inteligencia[]).map((h) => {
                  const on = habilidades.includes(h);
                  return (
                    <button
                      key={h}
                      type="button"
                      aria-pressed={on}
                      onClick={() => alternarHabilidade(h)}
                      style={{
                        fontSize: 11.5, padding: "3px 8px", borderRadius: 999, cursor: "pointer",
                        border: `1px solid ${on ? C.primary : C.border}`, background: on ? "#E6F0E9" : "#fff",
                        color: on ? C.primaryDeep : C.inkSoft, fontWeight: on ? 600 : 400,
                      }}
                    >
                      {INTELIGENCIAS[h]}
                    </button>
                  );
                })}
              </div>
            )}
          </label>
        ))}
      </div>

      {s.conflito && (
        <div style={{ marginTop: 14 }}>
          <Aviso tipo="info">
            Este bloco tinha sido alterado em outro lugar (outra aba ou aparelho). Suas alterações foram gravadas por
            cima; a versão anterior está no histórico.{" "}
            <button className="tv-btn-text" onClick={s.fecharConflito}>Entendi</button>
          </Aviso>
        </div>
      )}
      {s.erro && <div style={{ marginTop: 14 }}><Aviso>{s.erro}</Aviso></div>}

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <IndicadorSalvamento estado={s.estado} salvoEm={s.salvoEm} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {onRemover && vazio && (
            <button className="tv-btn-text-danger" onClick={onRemover} style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 12.5 }}>
              <Trash2 size={12} /> Remover bloco
            </button>
          )}
          <button className="tv-btn-text" onClick={onHistorico} style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 12.5 }}>
            <History size={13} /> Histórico
          </button>
          <button className="tv-btn tv-btn-primary" onClick={() => void s.salvarAgora()} disabled={s.estado === "salvando"}>
            <Save size={14} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function IndicadorSalvamento({ estado, salvoEm }: { estado: EstadoSalvamento; salvoEm: string }) {
  const base: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 };
  switch (estado) {
    case "salvando":
      return <span style={{ ...base, color: C.inkSoft }} role="status"><Loader2 size={14} className="tv-girar" /> Salvando…</span>;
    case "pendente":
      return <span style={{ ...base, color: C.primaryDeep }} role="status">Guardado neste navegador — enviando…</span>;
    case "offline":
      return <span style={{ ...base, color: C.red }} role="status"><CloudOff size={14} /> Sem conexão — guardado neste navegador, será enviado quando a conexão voltar</span>;
    case "erro":
      return <span style={{ ...base, color: C.red }} role="status"><AlertTriangle size={14} /> Não salvo</span>;
    default:
      return <span style={{ ...base, color: "#3F6136" }} role="status"><CheckCircle2 size={14} /> Salvo {formatarData(salvoEm, true)}</span>;
  }
}

/** Bloco de outro professor (ou arquivado): somente leitura. */
export function BlocoLeitura({ bloco, etapaId, exigeLinguagemAmor }: { bloco: Bloco; etapaId: number; exigeLinguagemAmor: boolean }) {
  const preenchidos = CAMPOS_TEXTO.filter((c) => bloco[c.chave].trim());
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {exigeLinguagemAmor && (
        <p style={{ margin: 0, fontSize: 13 }}>
          <strong>Linguagens do Amor:</strong>{" "}
          {bloco.linguagens_amor.length ? bloco.linguagens_amor.map((l) => LINGUAGENS_AMOR[l]).join(", ") : <span style={{ color: C.inkSoft }}>não informadas</span>}
        </p>
      )}
      {preenchidos.length === 0 && <p style={{ margin: 0, fontSize: 13, color: C.inkSoft }}>Ainda sem conteúdo.</p>}
      {!bloco.atividades.trim() && (
        <AnexosBloco blocoId={bloco.id} etapaId={etapaId} disciplinaId={bloco.disciplina_id} editavel={false} />
      )}
      {preenchidos.map((c) => (
        <div key={c.chave}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: C.inkSoft, margin: "0 0 3px" }}>{c.rotulo}</p>
          <p style={{ fontSize: 13.5, color: C.ink, margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{bloco[c.chave]}</p>
          {c.chave === "atividades" && (
            <AnexosBloco blocoId={bloco.id} etapaId={etapaId} disciplinaId={bloco.disciplina_id} editavel={false} />
          )}
          {c.chave === "objetivos" && bloco.habilidades.length > 0 && (
            <p style={{ fontSize: 12, color: C.primaryDeep, margin: "4px 0 0" }}>{bloco.habilidades.map((h) => INTELIGENCIAS[h]).join(" · ")}</p>
          )}
        </div>
      ))}
    </div>
  );
}
