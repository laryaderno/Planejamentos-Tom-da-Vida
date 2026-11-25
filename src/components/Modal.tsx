import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { C } from "@/styles/tokens";

interface ModalProps {
  titulo: string;
  subtitulo?: string;
  largura?: number;
  onFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
}

export function Modal({ titulo, subtitulo, largura = 420, onFechar, children, rodape }: ModalProps) {
  const idTitulo = useId();

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div className="tv-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div
        className="tv-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        style={{ width: largura, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: subtitulo ? 4 : 14 }}>
          <h2 id={idTitulo} className="tv-serif" style={{ fontSize: 18, fontWeight: 600, color: C.ink, margin: 0 }}>
            {titulo}
          </h2>
          <button onClick={onFechar} aria-label="Fechar" style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}>
            <X size={18} />
          </button>
        </div>
        {subtitulo && <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 16px" }}>{subtitulo}</p>}
        <div className="tv-scroll" style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>{children}</div>
        {rodape && <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>{rodape}</div>}
      </div>
    </div>
  );
}
