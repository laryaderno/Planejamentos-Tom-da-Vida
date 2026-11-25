import { C } from "@/styles/tokens";

export function TelaCarregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div className="tv-root" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.inkSoft, fontSize: 14 }}>
      {texto}
    </div>
  );
}

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return <p style={{ color: C.inkSoft, fontSize: 13.5, padding: "8px 0" }}>{texto}</p>;
}
