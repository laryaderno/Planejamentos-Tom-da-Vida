import { KeyRound, Pencil, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";

const estilo: CSSProperties = { fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 4 };

/** Botões de ação das tabelas de usuários. */
export function BotoesUsuario({
  onEditar,
  onRemover,
  onSenha,
}: {
  onEditar?: () => void;
  onRemover?: () => void;
  onSenha?: () => void;
}) {
  return (
    <span style={{ display: "inline-flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
      {onEditar && (
        <button className="tv-btn-text" onClick={onEditar} style={estilo}>
          <Pencil size={12} /> Permissões
        </button>
      )}
      {onSenha && (
        <button className="tv-btn-text" onClick={onSenha} style={estilo}>
          <KeyRound size={12} /> Redefinir senha
        </button>
      )}
      {onRemover && (
        <button className="tv-btn-text-danger" onClick={onRemover} style={estilo}>
          <Trash2 size={12} /> Remover
        </button>
      )}
    </span>
  );
}
