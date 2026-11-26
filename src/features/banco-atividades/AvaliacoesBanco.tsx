import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Search } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { EmptyState } from "@/components/EmptyState";
import { Carregando } from "@/components/TelaCarregando";
import { useUsuario } from "@/features/auth/AuthContext";
import { diaPorExtenso } from "@/features/exportacao/cronograma";
import { dataModelo } from "@/features/exportacao/planejamento";
import { useNomes } from "@/features/planejamentos/api";
import { useDisciplinas, useEtapas, useTurmas, useVinculos } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { NIVEL } from "@/lib/papeis";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";

const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Banco de atividades > Avaliações: avaliações aprovadas da etapa, por disciplina, com busca. */
export function AvaliacoesBanco() {
  const eu = useUsuario();
  const etapas = useEtapas();
  const turmas = useTurmas();
  const disciplinas = useDisciplinas();
  const vinculos = useVinculos();
  const aprovadas = useQuery({
    queryKey: ["avaliacoes", "aprovadas"],
    queryFn: async () =>
      verificar(await supabase.from("avaliacoes").select("*").eq("aprovacao", "aprovado").order("data", { ascending: false })),
  });
  const nomes = useNomes((aprovadas.data ?? []).map((a) => a.preenchida_por));
  const [etapaEscolhida, setEtapa] = useState<number | null>(null);
  const [disciplina, setDisciplina] = useState<number | null>(null);
  const [busca, setBusca] = useState("");

  if (aprovadas.error) return <Aviso>{mensagemDeErro(aprovadas.error)}</Aviso>;
  if (!aprovadas.data || !etapas.data || !turmas.data || !disciplinas.data || !vinculos.data) return <Carregando />;

  const minhasEtapas = NIVEL[eu.papel] >= NIVEL.secretaria
    ? etapas.data.map((e) => e.id)
    : eu.papel === "coordenador"
      ? eu.etapasCoordenadas
      : [...new Set(vinculos.data.filter((v) => v.usuario_id === eu.id).map((v) => v.etapa_id))];
  const etapasVisiveis = etapas.data.filter((e) => minhasEtapas.includes(e.id));
  const etapa = etapaEscolhida ?? etapasVisiveis[0]?.id ?? null;
  if (etapa === null) {
    return <EmptyState icon={ClipboardList} title="Nenhuma etapa disponível." description="Você ainda não tem vínculo com nenhuma etapa." />;
  }

  const turmaDe = (id: number) => turmas.data.find((t) => t.id === id);
  const nomeDisc = (id: number) => disciplinas.data.find((d) => d.id === id)?.nome ?? "";
  const daEtapa = aprovadas.data.filter((a) => turmaDe(a.turma_id)?.etapa_id === etapa);
  const discs = [...new Set(daEtapa.map((a) => a.disciplina_id))]
    .map((id) => ({ id, nome: nomeDisc(id), qtd: daEtapa.filter((a) => a.disciplina_id === id).length }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const termo = normalizar(busca.trim());
  const lista = daEtapa
    .filter((a) => disciplina === null || a.disciplina_id === disciplina)
    .filter(
      (a) =>
        !termo ||
        normalizar([a.conteudo, a.material, a.orientacoes, nomeDisc(a.disciplina_id), turmaDe(a.turma_id)?.nome ?? ""].join(" ")).includes(termo),
    );

  const pill = (ativo: boolean) =>
    ({
      fontSize: 12.5, fontWeight: 600, padding: "5px 11px", borderRadius: 999, cursor: "pointer",
      background: ativo ? C.primary : "#fff", color: ativo ? "#fff" : C.inkSoft, border: `1px solid ${ativo ? C.primary : C.border}`,
    }) as const;

  return (
    <div>
      <div className="tv-card" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        {etapasVisiveis.length > 1 && (
          <select className="tv-input" style={{ width: "auto" }} value={etapa} onChange={(e) => { setEtapa(Number(e.target.value)); setDisciplina(null); }} aria-label="Etapa">
            {etapasVisiveis.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        )}
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search size={14} color={C.inkSoft} style={{ position: "absolute", left: 10, top: 12 }} />
          <input className="tv-input" style={{ paddingLeft: 30 }} placeholder="Pesquisar no conteúdo, disciplina ou turma" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Pesquisar avaliações" />
        </div>
      </div>

      {discs.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <button style={pill(disciplina === null)} onClick={() => setDisciplina(null)}>Todas</button>
          {discs.map((d) => (
            <button key={d.id} style={pill(disciplina === d.id)} onClick={() => setDisciplina(d.id)}>
              {d.nome} ({d.qtd})
            </button>
          ))}
        </div>
      )}

      {lista.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={termo ? `Nada encontrado para "${busca.trim()}".` : "Ainda não há avaliações aprovadas nesta etapa."}
          description={termo ? "A busca procura no conteúdo, material, orientações, disciplina e turma." : "Quando a coordenação aprova uma avaliação cadastrada pelo professor no Cronograma de Avaliação, ela aparece aqui."}
        />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {lista.map((a) => (
            <article key={a.id} className="tv-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600 }}>{nomeDisc(a.disciplina_id)} · {turmaDe(a.turma_id)?.nome}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: C.inkSoft }}>
                    Avaliação {a.tipo} · {a.bimestre}º bimestre de {a.ano} · {dataModelo(a.data)} ({diaPorExtenso(a.data)})
                    {a.preenchida_por && <> · Prof(a) {nomes.data?.get(a.preenchida_por) ?? "…"}</>}
                  </p>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13.5, whiteSpace: "pre-wrap" }}>{a.conteudo}</p>
              {a.material.trim() && (
                <div style={{ marginTop: 8, fontSize: 12.5 }}>
                  <strong>Material de apoio:</strong>
                  {a.material.split(/\r?\n/).filter((l) => l.trim()).map((l, i) =>
                    /^https?:\/\/\S+$/.test(l.trim()) ? (
                      <a key={i} href={l.trim()} target="_blank" rel="noreferrer" style={{ display: "block", color: C.primaryDeep, wordBreak: "break-all" }}>{l.trim()}</a>
                    ) : (
                      <span key={i} style={{ display: "block" }}>{l}</span>
                    ),
                  )}
                </div>
              )}
              {a.orientacoes.trim() && (
                <details style={{ marginTop: 8, fontSize: 12.5 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600, color: C.primaryDeep }}>Orientações</summary>
                  <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{a.orientacoes}</p>
                </details>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
