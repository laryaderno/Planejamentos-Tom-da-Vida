import type { VinculoEntrada } from "@/lib/consultas";
import { C } from "@/styles/tokens";
import { descrever, type Catalogo } from "./vinculos";

/** Lista de vínculos com marcação de adicionado (+) e removido (−), para resumos de confirmação. */
export function ListaVinculos({
  titulo,
  itens,
  catalogo,
  sinal,
}: {
  titulo: string;
  itens: VinculoEntrada[];
  catalogo: Catalogo;
  sinal?: "+" | "−";
}) {
  if (itens.length === 0) return null;
  const cor = sinal === "−" ? C.red : sinal === "+" ? "#3F6136" : C.ink;
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 12.5, fontWeight: 600, color: C.inkSoft, margin: "0 0 4px" }}>{titulo}</p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: cor, lineHeight: 1.6 }}>
        {itens.map((v) => (
          <li key={`${v.etapa_id}-${v.turma_id}-${v.disciplina_id}`}>
            {sinal ? `${sinal} ` : ""}
            {descrever(v, catalogo)}
          </li>
        ))}
      </ul>
    </div>
  );
}
