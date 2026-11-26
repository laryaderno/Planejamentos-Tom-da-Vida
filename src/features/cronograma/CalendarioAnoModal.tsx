import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Modal } from "@/components/Modal";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";
import type { Avaliacao, TipoAvaliacao } from "./api";

const COLUNAS: { tipo: TipoAvaliacao; bimestre: number }[] = [1, 2, 3, 4].flatMap((b) => [
  { tipo: "mensal" as const, bimestre: b },
  { tipo: "bimestral" as const, bimestre: b },
]);
const chave = (disc: number, tipo: string, bim: number) => `${disc}|${tipo}|${bim}`;

/**
 * Calendário acadêmico da turma: todas as datas de avaliação do ano de uma vez
 * (disciplinas nas linhas; mensal e bimestral de cada bimestre nas colunas).
 */
export function CalendarioAnoModal({
  turma, ano, disciplinas, avaliacoes, onFechar, aoSalvar,
}: {
  turma: { id: number; nome: string };
  ano: number;
  disciplinas: { id: number; nome: string }[];
  avaliacoes: Avaliacao[];
  onFechar: () => void;
  aoSalvar: (alteradas: number) => void;
}) {
  const inicial = Object.fromEntries(avaliacoes.map((a) => [chave(a.disciplina_id, a.tipo, a.bimestre), a.data]));
  const comConteudo = new Set(avaliacoes.filter((a) => a.conteudo.trim()).map((a) => chave(a.disciplina_id, a.tipo, a.bimestre)));
  const [datas, setDatas] = useState<Record<string, string>>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar() {
    setEnviando(true);
    setErro(null);
    try {
      // Envia só o que mudou (data nova, alterada ou apagada).
      const itens = disciplinas.flatMap((d) =>
        COLUNAS.flatMap(({ tipo, bimestre }) => {
          const k = chave(d.id, tipo, bimestre);
          const antes = inicial[k] ?? "";
          const agora = datas[k] ?? "";
          return antes === agora ? [] : [{ disciplina_id: d.id, tipo, bimestre, data: agora || null }];
        }),
      );
      const n = itens.length
        ? verificar(await supabase.rpc("agendar_avaliacoes", { p_turma: turma.id, p_ano: ano, p_itens: itens }))
        : 0;
      aoSalvar(n);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo={`Calendário de avaliações ${ano}`}
      subtitulo={`${turma.nome} — preencha as datas do ano todo e salve de uma vez. Datas apagadas removem a avaliação (só as que ainda não têm conteúdo).`}
      onFechar={onFechar}
      largura={1040}
      rodape={
        <>
          <button className="tv-btn tv-btn-secondary" onClick={onFechar} disabled={enviando}>Cancelar</button>
          <button className="tv-btn tv-btn-primary" onClick={() => void salvar()} disabled={enviando}>
            {enviando ? "Salvando…" : "Salvar calendário"}
          </button>
        </>
      }
    >
      {disciplinas.length === 0 ? (
        <p style={{ fontSize: 13, color: C.inkSoft }}>Nenhuma disciplina com professor vinculado a esta turma.</p>
      ) : (
        <div className="tv-scroll" style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12.5, minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                <th rowSpan={2} style={{ ...th, textAlign: "left", position: "sticky", left: 0, background: "#F9FAFB" }}>Disciplina</th>
                {[1, 2, 3, 4].map((b) => (
                  <th key={b} colSpan={2} style={{ ...th, borderLeft: `1px solid ${C.border}` }}>{b}º bimestre</th>
                ))}
              </tr>
              <tr style={{ background: "#F9FAFB" }}>
                {COLUNAS.map((c) => (
                  <th key={`${c.tipo}${c.bimestre}`} style={{ ...th, fontWeight: 500, borderLeft: c.tipo === "mensal" ? `1px solid ${C.border}` : undefined }}>
                    {c.tipo === "mensal" ? "Mensal" : "Bimestral"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {disciplinas.map((d) => (
                <tr key={d.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "6px 10px", fontWeight: 600, whiteSpace: "nowrap", position: "sticky", left: 0, background: "#fff" }}>{d.nome}</td>
                  {COLUNAS.map(({ tipo, bimestre }) => {
                    const k = chave(d.id, tipo, bimestre);
                    const travada = comConteudo.has(k);
                    return (
                      <td key={k} style={{ padding: 4, borderLeft: tipo === "mensal" ? `1px solid ${C.border}` : undefined }}>
                        <input
                          type="date"
                          className="tv-input"
                          style={{ padding: "5px 6px", fontSize: 12, width: 128 }}
                          value={datas[k] ?? ""}
                          min={`${ano}-01-01`}
                          max={`${ano}-12-31`}
                          title={travada ? "O professor já cadastrou o conteúdo: dá para mudar a data, não para apagar." : undefined}
                          aria-label={`${d.nome}, ${tipo} do ${bimestre}º bimestre`}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v && travada) return;
                            setDatas((x) => ({ ...x, [k]: v }));
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {erro && <div style={{ marginTop: 12 }}><Aviso>{erro}</Aviso></div>}
    </Modal>
  );
}

const th = { padding: "8px 10px", fontWeight: 600, color: C.inkSoft, textAlign: "center" } as const;
