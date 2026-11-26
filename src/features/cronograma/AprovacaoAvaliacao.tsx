import { CheckCircle2, PencilLine } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { formatarData } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";
import type { Avaliacao } from "./api";

const pilula = { display: "inline-flex", gap: 5, alignItems: "center", fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" } as const;

/** Situação da avaliação: conteúdo pendente, aguardando aprovação, revisar ou aprovada. */
export function SituacaoAvaliacao({ a, nome }: { a: Avaliacao; nome: (id: string) => string }) {
  if (!a.conteudo.trim()) return <span style={{ ...pilula, color: "#B45309", background: "#FEF3C7" }}>Conteúdo pendente</span>;
  if (a.aprovacao === "aprovado") {
    return (
      <span style={{ ...pilula, color: "#2F6B3F", background: "#E3F1E6" }} title={a.aprovacao_por ? `Aprovada por ${nome(a.aprovacao_por)} em ${formatarData(a.aprovacao_em!)}` : undefined}>
        <CheckCircle2 size={12} /> Aprovada
      </span>
    );
  }
  if (a.aprovacao === "revisar") {
    return (
      <span style={{ ...pilula, color: "#9A3412", background: "#FDEBDD" }}>
        <PencilLine size={12} /> Revisar
      </span>
    );
  }
  return <span style={{ ...pilula, color: C.inkSoft, background: "#F3F4F6" }}>Aguardando aprovação</span>;
}

/** Gestão: "Revisar" (com o que rever) e "Aprovar". */
export function BotoesAprovacao({ a, aoAvaliar }: { a: Avaliacao; aoAvaliar: () => void }) {
  const [revisando, setRevisando] = useState(false);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (!a.conteudo.trim()) return null;

  async function avaliar(decisao: "aprovado" | "revisar") {
    setEnviando(true);
    setErro(null);
    try {
      verificar(await supabase.rpc("avaliar_avaliacao", { p_id: a.id, p_decisao: decisao, p_observacao: decisao === "revisar" ? obs : undefined }));
      setRevisando(false);
      setObs("");
      aoAvaliar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  const botao = { padding: "4px 10px", fontSize: 12.5 } as const;
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      {!revisando ? (
        <span style={{ display: "inline-flex", gap: 6 }}>
          <button className="tv-btn tv-btn-secondary" style={botao} disabled={enviando} onClick={() => setRevisando(true)}>
            <PencilLine size={13} /> Revisar
          </button>
          <button className="tv-btn tv-btn-primary" style={botao} disabled={enviando || a.aprovacao === "aprovado"} onClick={() => void avaliar("aprovado")}>
            <CheckCircle2 size={13} /> {a.aprovacao === "aprovado" ? "Aprovada" : "Aprovar"}
          </button>
        </span>
      ) : (
        <span style={{ display: "grid", gap: 6, width: 260 }}>
          <textarea className="tv-input" rows={3} autoFocus placeholder="O que o professor precisa revisar?" value={obs} onChange={(e) => setObs(e.target.value)} />
          <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
            <button className="tv-btn tv-btn-secondary" style={botao} onClick={() => { setRevisando(false); setObs(""); setErro(null); }}>Cancelar</button>
            <button className="tv-btn tv-btn-primary" style={botao} disabled={enviando || !obs.trim()} onClick={() => void avaliar("revisar")}>
              {enviando ? "Enviando…" : "Pedir revisão"}
            </button>
          </span>
        </span>
      )}
      {erro && <span style={{ maxWidth: 280, textAlign: "left" }}><Aviso>{erro}</Aviso></span>}
    </span>
  );
}
