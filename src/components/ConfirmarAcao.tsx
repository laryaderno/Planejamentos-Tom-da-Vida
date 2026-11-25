import { AlertTriangle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { mensagemDeErro } from "@/lib/erros";
import { C } from "@/styles/tokens";
import { Aviso } from "./Aviso";
import { Modal } from "./Modal";

export interface ConfirmarAcaoProps {
  titulo: string;
  /** Deve citar o usuário afetado, a ação exata e o escopo (§3.2). */
  mensagem: ReactNode;
  /** Aviso de irreversibilidade, quando aplicável. */
  irreversivel?: string;
  rotuloConfirmar: string;
  perigo?: boolean;
  onCancelar: () => void;
  /** Pode lançar erro; a mensagem aparece no próprio modal. */
  onConfirmar: () => Promise<void>;
  children?: ReactNode;
}

/** Confirmação obrigatória de ações críticas (§3.2). */
export function ConfirmarAcao({
  titulo,
  mensagem,
  irreversivel,
  rotuloConfirmar,
  perigo,
  onCancelar,
  onConfirmar,
  children,
}: ConfirmarAcaoProps) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      await onConfirmar();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo={titulo}
      largura={460}
      onFechar={enviando ? () => {} : onCancelar}
      rodape={
        <>
          <button className="tv-btn tv-btn-secondary" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </button>
          <button
            className="tv-btn tv-btn-primary"
            style={perigo ? { background: C.red } : undefined}
            onClick={confirmar}
            disabled={enviando}
          >
            {enviando ? "Aguarde…" : rotuloConfirmar}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.55, margin: "0 0 14px" }}>{mensagem}</div>
      {children}
      {irreversivel && (
        <p style={{ display: "flex", gap: 8, fontSize: 12.5, color: perigo ? C.red : C.inkSoft, lineHeight: 1.5, margin: "0 0 4px" }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          {irreversivel}
        </p>
      )}
      {erro && (
        <div style={{ marginTop: 12 }}>
          <Aviso>{erro}</Aviso>
        </div>
      )}
    </Modal>
  );
}
