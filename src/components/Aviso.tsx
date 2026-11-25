import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { C } from "@/styles/tokens";

interface AvisoProps {
  tipo?: "erro" | "sucesso" | "info";
  children: ReactNode;
}

const ESTILO = {
  erro: { fundo: "#FDECEC", cor: C.red, Icone: AlertTriangle },
  sucesso: { fundo: "#E6EEE3", cor: "#3F6136", Icone: CheckCircle2 },
  info: { fundo: "#E6F0E9", cor: C.primaryDeep, Icone: AlertTriangle },
} as const;

export function Aviso({ tipo = "erro", children }: AvisoProps) {
  const { fundo, cor, Icone } = ESTILO[tipo];
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      style={{ display: "flex", gap: 8, alignItems: "flex-start", background: fundo, color: cor, padding: "10px 12px", borderRadius: 8, fontSize: 13, lineHeight: 1.5 }}
    >
      <Icone size={15} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>{children}</div>
    </div>
  );
}
