import { Archive, ArrowLeft, ArrowRight, CalendarDays, Folder } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { ATIVIDADES_POR_TURMA } from "@/mocks/dados";
import { useDadosPrototipo } from "@/mocks/DadosPrototipoContext";
import { C } from "@/styles/tokens";

export function BancoAtividadesPage() {
  const { turmas, planejamentos } = useDadosPrototipo();
  const [turmaId, setTurmaId] = useState("");
  const [tema, setTema] = useState<string | null>(null);

  const turma = turmas.find((t) => String(t.id) === String(turmaId));
  const dados = turmaId ? ATIVIDADES_POR_TURMA[Number(turmaId)] : null;
  const pastaAtual = dados?.pastas.find((p) => p.tema === tema);
  const planejamentosArquivados = planejamentos.filter((p) => p.arquivadoEm && !p.excluidoEm && String(p.turmaId) === turmaId);

  function selectTurma(id: string) {
    setTurmaId(id);
    setTema(null);
  }

  return (
    <div>
      <div className="tv-card" style={{ padding: 16, marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Turma</label>
        <select
          className="tv-input"
          style={{ maxWidth: 280, marginTop: 6 }}
          value={turmaId}
          onChange={(e) => selectTurma(e.target.value)}
        >
          <option value="">Selecione uma turma</option>
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>{t.nome} — {t.etapa}</option>
          ))}
        </select>
        <p style={{ fontSize: 12, color: C.inkSoft, margin: "8px 0 0" }}>
          Como Diretor(a), você vê todas as turmas. Professores veem apenas as turmas às quais têm acesso.
        </p>
      </div>

      {!turmaId && (
        <EmptyState
          icon={Archive}
          title="Selecione uma turma para ver o banco de atividades."
          description="Cada turma mantém seu próprio repositório de atividades já aprovadas, organizado em pastas por tema, disponíveis para reaproveitamento em novos planejamentos."
        />
      )}

      {turmaId && !tema && (
        <>
          <h2 style={tituloSecao}>Atividades por tema</h2>
          {!dados || dados.pastas.length === 0 ? (
            <EmptyState
              icon={Folder}
              title={`Nenhuma atividade aprovada ainda em ${turma?.nome}.`}
              description="Quando um professor enviar uma atividade proposta e ela for aprovada pela coordenação ou direção, ela aparecerá aqui, organizada por tema."
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
              {dados.pastas.map((p) => (
                <button
                  key={p.tema}
                  onClick={() => setTema(p.tema)}
                  className="tv-card"
                  style={{ padding: 18, textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 9, background: "#F4E7CE", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Folder size={18} color={C.goldDeep} />
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft, background: "#EFEAD9", padding: "3px 9px", borderRadius: 999 }}>
                      {p.atividades.length} {p.atividades.length === 1 ? "atividade" : "atividades"}
                    </span>
                  </div>
                  <p style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, margin: 0 }}>{p.tema}</p>
                </button>
              ))}
            </div>
          )}

          <h2 style={{ ...tituloSecao, marginTop: 28 }}>Planejamentos</h2>
          <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "-4px 0 12px", maxWidth: 620, lineHeight: 1.5 }}>
            Planejamentos de professores que saíram da escola e foram mantidos na remoção. Somente leitura.
          </p>
          {planejamentosArquivados.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={`Nenhum planejamento arquivado em ${turma?.nome}.`}
              description="Ao remover um professor, quem remove pode escolher manter os planejamentos dele; eles aparecem aqui."
            />
          ) : (
            <div className="tv-card" style={{ overflow: "hidden" }}>
              {planejamentosArquivados.map((p, i) => (
                <div key={p.id} style={{ padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: "0 0 4px" }}>{p.conteudo}</p>
                  <p style={{ fontSize: 12.5, color: C.inkSoft, margin: 0 }}>
                    {p.data} · {p.turno} · {p.professorNome} · arquivado em {p.arquivadoEm}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {turmaId && tema && (
        <div>
          <button
            onClick={() => setTema(null)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.inkSoft, fontSize: 13, marginBottom: 14, padding: 0 }}
          >
            <ArrowLeft size={15} /> {turma?.nome} <ArrowRight size={12} /> {tema}
          </button>

          {!pastaAtual || pastaAtual.atividades.length === 0 ? (
            <EmptyState icon={Folder} title="Nenhuma atividade aprovada nesta pasta ainda." description="Atividades enviadas por professores e aprovadas pela coordenação para este tema aparecerão aqui." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pastaAtual.atividades.map((a, i) => (
                <div key={i} className="tv-card" style={{ padding: 16 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: "0 0 6px" }}>{a.titulo}</p>
                  <p style={{ fontSize: 12.5, color: C.inkSoft, margin: 0 }}>
                    Proposta por {a.propostaPor} · aprovada por {a.aprovadaPor} em {a.data}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const tituloSecao = { fontSize: 15, fontWeight: 600, color: C.ink, margin: "0 0 12px" } as const;
