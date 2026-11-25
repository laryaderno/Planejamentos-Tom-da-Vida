import { FileDown, FileText } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { mensagemDeErro } from "@/lib/erros";
import { exportar, type Formato } from "./baixar";
import type { Documento } from "./modelo";

/** Botões "Baixar PDF" e "Baixar Word" para um documento montado sob demanda. */
export function BotoesExportar({
  montar,
  formatos = ["pdf", "docx"],
  desabilitado,
}: {
  montar: () => Promise<Documento>;
  formatos?: Formato[];
  desabilitado?: boolean;
}) {
  const [gerando, setGerando] = useState<Formato | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function baixar(formato: Formato) {
    setGerando(formato);
    setErro(null);
    try {
      await exportar(await montar(), formato);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setGerando(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {formatos.includes("pdf") && (
          <button className="tv-btn tv-btn-primary" onClick={() => void baixar("pdf")} disabled={desabilitado || gerando !== null}>
            <FileDown size={15} /> {gerando === "pdf" ? "Gerando PDF…" : "Baixar PDF"}
          </button>
        )}
        {formatos.includes("docx") && (
          <button className="tv-btn tv-btn-secondary" onClick={() => void baixar("docx")} disabled={desabilitado || gerando !== null}>
            <FileText size={15} /> {gerando === "docx" ? "Gerando Word…" : "Baixar Word"}
          </button>
        )}
      </div>
      {erro && <div style={{ marginTop: 10 }}><Aviso>{erro}</Aviso></div>}
    </div>
  );
}
