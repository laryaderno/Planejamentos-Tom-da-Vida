import { MessageSquare } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Aviso } from "@/components/Aviso";
import { formatarData } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";
import type { Nota } from "./api";

/** Notas no planejamento (§3: todos que veem o planejamento podem anotar). */
export function Notas({
  planejamentoId,
  notas,
  nome,
  aoAdicionar,
}: {
  planejamentoId: number;
  notas: Nota[];
  nome: (id: string) => string;
  aoAdicionar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      verificar(await supabase.from("notas").insert({ planejamento_id: planejamentoId, texto: texto.trim() }));
      setTexto("");
      aoAdicionar();
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="tv-card" style={{ padding: 18 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>
        <MessageSquare size={16} color={C.primaryDeep} /> Notas
      </h2>
      {notas.length === 0 && <p style={{ fontSize: 13, color: C.inkSoft, margin: "0 0 12px" }}>Nenhuma nota ainda.</p>}
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}>
        {notas.map((n) => (
          <li key={n.id} style={{ padding: "9px 0", borderTop: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 12, color: C.inkSoft, margin: "0 0 3px" }}>
              <strong style={{ color: C.ink }}>{nome(n.autor_id)}</strong> · {formatarData(n.criado_em, true)}
            </p>
            <p style={{ fontSize: 13.5, margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{n.texto}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={enviar} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <textarea
          className="tv-input"
          rows={2}
          placeholder="Escreva uma nota…"
          aria-label="Nova nota"
          style={{ resize: "vertical", fontFamily: "inherit" }}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button type="submit" className="tv-btn tv-btn-primary" disabled={enviando || !texto.trim()}>
          {enviando ? "Enviando…" : "Adicionar"}
        </button>
      </form>
      {erro && <div style={{ marginTop: 10 }}><Aviso>{erro}</Aviso></div>}
    </section>
  );
}
