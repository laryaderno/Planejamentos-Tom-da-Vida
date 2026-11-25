import { Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { LOGO_URL } from "@/app/marca";
import { C } from "@/styles/tokens";

/** Moldura comum das telas de login, cadastro e senha. */
export function TelaAuth({
  subtitulo,
  onSubmit,
  children,
  largura = 380,
}: {
  subtitulo?: string;
  onSubmit?: (e: FormEvent) => void;
  children: ReactNode;
  largura?: number;
}) {
  const Conteudo = onSubmit ? "form" : "div";
  return (
    <div
      className="tv-root"
      style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: `radial-gradient(circle at 30% 20%, ${C.sidebarSoft} 0%, ${C.sidebar} 55%)`,
        padding: 24,
      }}
    >
      <Conteudo onSubmit={onSubmit} className="tv-card" style={{ width: largura, maxWidth: "100%", padding: "34px 30px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 84, height: 84, borderRadius: "50%", background: "#fff", padding: 4,
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, overflow: "hidden",
            }}
          >
            <img src={LOGO_URL} alt="Logo Escola Tom da Vida" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <h1 className="tv-serif" style={{ fontSize: 21, fontWeight: 600, color: C.ink, textAlign: "center", margin: 0 }}>
            Sistema de Planejamento de Aulas
          </h1>
          <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 4, marginBottom: 0 }}>{subtitulo ?? "Escola Tom da Vida"}</p>
        </div>
        {children}
      </Conteudo>
    </div>
  );
}

export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{rotulo}</span>
      <div style={{ marginTop: 6 }}>{children}</div>
    </label>
  );
}

export function CampoSenha({
  valor,
  onChange,
  autoComplete = "current-password",
}: {
  valor: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        className="tv-input"
        style={{ paddingRight: 40 }}
        type={visivel ? "text" : "password"}
        placeholder="••••••••"
        autoComplete={autoComplete}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setVisivel((s) => !s)}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        style={{ position: "absolute", right: 10, top: 9, background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}
      >
        {visivel ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export const estiloLink = {
  background: "none", border: "none", fontSize: 13, color: C.inkSoft, cursor: "pointer", textDecoration: "underline", padding: 0,
} as const;
