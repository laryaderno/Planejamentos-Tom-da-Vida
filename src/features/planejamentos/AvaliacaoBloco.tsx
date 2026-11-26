import { CheckCircle2, PencilLine } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { useUsuario } from "@/features/auth/AuthContext";
import { formatarData } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";
import type { Bloco } from "./api";

const AVALIADORES = ["diretor", "secretaria", "coordenador"];

/**
 * Aprovação do bloco: selo com a decisão e, para a Coordenação, a Secretaria
 * e a Direção, os botões "Revisar" e "Aprovar".
 */
export function AvaliacaoBloco({ bloco, nome, aoAvaliar }: { bloco: Bloco; nome: (id: string) => string; aoAvaliar: () => void }) {
  const eu = useUsuario();
  const [revisando, setRevisando] = useState(false);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const avalia = AVALIADORES.includes(eu.papel) && !bloco.arquivado_em;
  const concluido = bloco.status === "verde";

  async function avaliar(decisao: "aprovado" | "revisar") {
    setEnviando(true);
    setErro(null);
    try {
      verificar(await supabase.rpc("avaliar_bloco", { p_id: bloco.id, p_decisao: decisao, p_observacao: decisao === "revisar" ? obs : undefined }));
      setRevisando(false);
      setObs("");
      aoAvaliar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  const quem = !bloco.aprovacao_por ? "" : bloco.aprovacao_por === eu.id ? "você" : nome(bloco.aprovacao_por);
  const quando = bloco.aprovacao_em ? formatarData(bloco.aprovacao_em) : "";
  const selo =
    bloco.aprovacao === "aprovado" ? (
      <span style={{ ...pilula, color: "#2F6B3F", background: "#E3F1E6" }}>
        <CheckCircle2 size={13} /> Aprovado por {quem} em {quando}
      </span>
    ) : bloco.aprovacao === "revisar" ? (
      <span style={{ ...pilula, color: "#9A3412", background: "#FDEBDD" }}>
        <PencilLine size={13} /> Revisar — pedido por {quem} em {quando}
      </span>
    ) : concluido ? (
      <span style={{ ...pilula, color: C.inkSoft, background: "#F3F4F6" }}>Aguardando aprovação</span>
    ) : null;

  if (!selo && !avalia) return null;

  return (
    <div style={{ margin: "-4px 0 14px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {selo}
        {avalia && !revisando && (
          <span style={{ display: "inline-flex", gap: 8, marginLeft: "auto" }}>
            <button className="tv-btn tv-btn-secondary" style={botao} disabled={enviando} onClick={() => setRevisando(true)}>
              <PencilLine size={14} /> Revisar
            </button>
            <button
              className="tv-btn tv-btn-primary"
              style={botao}
              disabled={enviando || !concluido || bloco.aprovacao === "aprovado"}
              title={!concluido ? "Só é possível aprovar depois que o professor concluir o planejamento." : undefined}
              onClick={() => void avaliar("aprovado")}
            >
              <CheckCircle2 size={14} /> {bloco.aprovacao === "aprovado" ? "Aprovado" : "Aprovar"}
            </button>
          </span>
        )}
      </div>
      {bloco.aprovacao === "revisar" && bloco.aprovacao_obs && (
        <p style={{ margin: "8px 0 0", padding: "9px 12px", borderRadius: 8, background: "#FFF7ED", border: "1px solid #FED7AA", fontSize: 13, color: "#7C2D12" }}>
          {bloco.aprovacao_obs}
        </p>
      )}
      {revisando && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <textarea
            className="tv-input"
            rows={3}
            autoFocus
            placeholder="O que o professor precisa revisar?"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="tv-btn tv-btn-secondary" style={botao} onClick={() => { setRevisando(false); setObs(""); setErro(null); }}>
              Cancelar
            </button>
            <button className="tv-btn tv-btn-primary" style={botao} disabled={enviando || !obs.trim()} onClick={() => void avaliar("revisar")}>
              {enviando ? "Enviando…" : "Pedir revisão"}
            </button>
          </div>
        </div>
      )}
      {erro && <div style={{ marginTop: 8 }}><Aviso>{erro}</Aviso></div>}
    </div>
  );
}

const pilula = { display: "inline-flex", gap: 5, alignItems: "center", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999 } as const;
const botao = { padding: "6px 12px", fontSize: 13 } as const;
