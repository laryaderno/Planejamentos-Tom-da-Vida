import { Archive, ArrowLeft, Download, FileText, Folder, Search, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Aviso } from "@/components/Aviso";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { EmptyState } from "@/components/EmptyState";
import { Carregando } from "@/components/TelaCarregando";
import {
  baixarAtividade,
  removerAtividade,
  tamanhoLegivel,
  TIPOS_ARQUIVO,
  useAtividades,
  type AtividadeComOrigem,
} from "@/features/atividades/api";
import { useUsuario } from "@/features/auth/AuthContext";
import { useNomes } from "@/features/planejamentos/api";
import { useMinhasTurmas } from "@/features/planejamentos/PlanejamentosPage";
import { formatarData, useDisciplinas, useEtapas, useVinculos } from "@/lib/consultas";
import { mensagemDeErro } from "@/lib/erros";
import { NIVEL, podeEditarEtapa } from "@/lib/papeis";
import { C } from "@/styles/tokens";
import { AvaliacoesBanco } from "./AvaliacoesBanco";
import { PlanejamentosArquivados } from "./PlanejamentosArquivados";

/** Normaliza para busca: minúsculas, sem acentos. */
function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function BancoAtividadesPage() {
  const [aba, setAba] = useState<"atividades" | "avaliacoes" | "arquivados">("atividades");
  return (
    <div>
      <div role="tablist" style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {([["atividades", "Atividades"], ["avaliacoes", "Avaliações"], ["arquivados", "Planejamentos arquivados"]] as const).map(([id, rotulo]) => (
          <button
            key={id}
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            style={{
              fontSize: 13, fontWeight: 600, padding: "7px 13px", borderRadius: 999, cursor: "pointer",
              background: aba === id ? C.primary : "transparent", color: aba === id ? "#fff" : C.inkSoft,
              border: `1px solid ${aba === id ? C.primary : C.border}`,
            }}
          >
            {rotulo}
          </button>
        ))}
      </div>
      {aba === "atividades" ? <Atividades /> : aba === "avaliacoes" ? <AvaliacoesBanco /> : <Arquivados />}
    </div>
  );
}

function Atividades() {
  const eu = useUsuario();
  const atividades = useAtividades();
  const etapas = useEtapas();
  const disciplinas = useDisciplinas();
  const vinculos = useVinculos();
  const [etapaEscolhida, setEtapa] = useState<number | null>(null);
  const [disciplina, setDisciplina] = useState<number | null>(null);
  const [tema, setTema] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const aprovadas = (atividades.data ?? []).filter((a) => a.status === "aprovada");
  const nomes = useNomes(aprovadas.flatMap((a) => [a.proposta_por, a.avaliada_por]));

  if (atividades.error) return <Aviso>{mensagemDeErro(atividades.error)}</Aviso>;
  if (!atividades.data || !etapas.data || !disciplinas.data || !vinculos.data) return <Carregando />;

  // Etapas cujo banco o usuário vê.
  const minhasEtapas = NIVEL[eu.papel] >= NIVEL.secretaria
    ? etapas.data.map((e) => e.id)
    : eu.papel === "coordenador"
      ? eu.etapasCoordenadas
      : [...new Set(vinculos.data.filter((v) => v.usuario_id === eu.id).map((v) => v.etapa_id))];
  const etapasVisiveis = etapas.data.filter((e) => minhasEtapas.includes(e.id));
  const etapa = etapaEscolhida ?? etapasVisiveis[0]?.id ?? null;

  if (etapa === null) {
    return <EmptyState icon={Archive} title="Nenhuma etapa disponível." description="Você ainda não tem vínculo com nenhuma etapa." />;
  }

  const daEtapa = aprovadas.filter((a) => a.etapa_id === etapa);
  const nomeDisc = (id: number) => disciplinas.data.find((d) => d.id === id)?.nome ?? "";
  const nome = (id: string | null) => (id ? nomes.data?.get(id) ?? "…" : "—");
  const termo = normalizar(busca.trim());

  const resultados = termo
    ? daEtapa.filter((a) =>
        normalizar([a.titulo, a.tema, nomeDisc(a.disciplina_id), a.arquivo_nome, nome(a.proposta_por)].join(" ")).includes(termo),
      )
    : [];

  function trocarEtapa(id: number) {
    setEtapa(id);
    setDisciplina(null);
    setTema(null);
  }

  let conteudo: ReactNode;
  if (termo) {
    conteudo = resultados.length ? (
      <ListaAtividades atividades={resultados} nome={nome} nomeDisc={nomeDisc} mostrarPasta />
    ) : (
      <EmptyState icon={Search} title={`Nada encontrado para "${busca.trim()}".`} description="A busca procura no título, tema, disciplina, nome do arquivo e professor." />
    );
  } else if (disciplina === null) {
    const porDisciplina = [...new Set(daEtapa.map((a) => a.disciplina_id))]
      .map((id) => ({ id, nome: nomeDisc(id), qtd: daEtapa.filter((a) => a.disciplina_id === id).length }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    conteudo = porDisciplina.length ? (
      <Pastas itens={porDisciplina.map((d) => ({ chave: String(d.id), titulo: d.nome, qtd: d.qtd, abrir: () => setDisciplina(d.id) }))} />
    ) : (
      <EmptyState
        icon={Archive}
        title="Ainda não há atividades aprovadas nesta etapa."
        description="Os professores anexam arquivos nas Atividades Propostas do planejamento; depois de aprovados pela coordenação, eles aparecem aqui, organizados por disciplina e tema."
      />
    );
  } else if (tema === null) {
    const daDisc = daEtapa.filter((a) => a.disciplina_id === disciplina);
    const temas = [...new Set(daDisc.map((a) => a.tema))].sort((a, b) => a.localeCompare(b));
    conteudo = (
      <>
        <Trilha partes={[nomeDisc(disciplina)]} voltar={() => setDisciplina(null)} />
        <Pastas itens={temas.map((t) => ({ chave: t, titulo: t, qtd: daDisc.filter((a) => a.tema === t).length, abrir: () => setTema(t) }))} />
      </>
    );
  } else {
    conteudo = (
      <>
        <Trilha partes={[nomeDisc(disciplina), tema]} voltar={() => setTema(null)} />
        <ListaAtividades atividades={daEtapa.filter((a) => a.disciplina_id === disciplina && a.tema === tema)} nome={nome} nomeDisc={nomeDisc} />
      </>
    );
  }

  return (
    <div>
      <div className="tv-card" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        {etapasVisiveis.length > 1 && (
          <select className="tv-input" style={{ width: "auto" }} value={etapa} onChange={(e) => trocarEtapa(Number(e.target.value))} aria-label="Etapa">
            {etapasVisiveis.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        )}
        {etapasVisiveis.length === 1 && <span style={{ fontSize: 13.5, fontWeight: 600 }}>{etapasVisiveis[0]!.nome}</span>}
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search size={15} color={C.inkSoft} style={{ position: "absolute", left: 10, top: 11 }} />
          <input
            className="tv-input"
            style={{ paddingLeft: 32 }}
            placeholder="Buscar atividade, tema, disciplina ou professor"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar no banco de atividades"
          />
        </div>
      </div>
      {conteudo}
    </div>
  );
}

function Trilha({ partes, voltar }: { partes: string[]; voltar: () => void }) {
  return (
    <button onClick={voltar} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.inkSoft, fontSize: 13, marginBottom: 14, padding: 0 }}>
      <ArrowLeft size={15} /> {partes.join(" › ")}
    </button>
  );
}

function Pastas({ itens }: { itens: { chave: string; titulo: string; qtd: number; abrir: () => void }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
      {itens.map((p) => (
        <button key={p.chave} onClick={p.abrir} className="tv-card" style={{ padding: 18, textAlign: "left", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 9, background: "#E6F0E9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Folder size={18} color={C.primaryDeep} />
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft, background: "#F3F4F6", padding: "3px 9px", borderRadius: 999 }}>
              {p.qtd} {p.qtd === 1 ? "atividade" : "atividades"}
            </span>
          </div>
          <p style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, margin: 0 }}>{p.titulo}</p>
        </button>
      ))}
    </div>
  );
}

function ListaAtividades({
  atividades, nome, nomeDisc, mostrarPasta,
}: {
  atividades: AtividadeComOrigem[];
  nome: (id: string | null) => string;
  nomeDisc: (id: number) => string;
  mostrarPasta?: boolean;
}) {
  const eu = useUsuario();
  const qc = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<AtividadeComOrigem | null>(null);

  async function baixar(a: AtividadeComOrigem) {
    setErro(null);
    try {
      await baixarAtividade(a);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  return (
    <div>
      {erro && <div style={{ marginBottom: 10 }}><Aviso>{erro}</Aviso></div>}
      <div className="tv-card" style={{ overflow: "hidden" }}>
        {atividades.map((a, i) => (
          <div key={a.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 16px", borderTop: i ? `1px solid ${C.border}` : "none" }}>
            <FileText size={18} color={C.primaryDeep} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: "0 0 3px" }}>{a.titulo}</p>
              <p style={{ fontSize: 12.5, color: C.inkSoft, margin: 0 }}>
                {mostrarPasta && <>{nomeDisc(a.disciplina_id)} › {a.tema} · </>}
                {TIPOS_ARQUIVO[a.arquivo_tipo]?.rotulo ?? "Arquivo"}, {tamanhoLegivel(a.arquivo_tamanho)} · proposta por {nome(a.proposta_por)} · aprovada por{" "}
                {nome(a.avaliada_por)} em {formatarData(a.avaliada_em)}
              </p>
            </div>
            <button className="tv-btn tv-btn-secondary" style={{ padding: "6px 11px" }} onClick={() => void baixar(a)}>
              <Download size={14} /> Baixar
            </button>
            {podeEditarEtapa(eu, a.etapa_id) && (
              <button className="tv-btn-text-danger" aria-label={`Remover ${a.titulo} do banco`} onClick={() => setRemovendo(a)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      {removendo && (
        <ConfirmarAcao
          titulo="Remover do banco"
          mensagem={<>Remover <strong>{removendo.titulo}</strong> do banco de atividades? O arquivo é apagado para todos.</>}
          irreversivel="Esta ação não pode ser desfeita."
          rotuloConfirmar="Remover"
          perigo
          onCancelar={() => setRemovendo(null)}
          onConfirmar={async () => {
            await removerAtividade(removendo);
            await qc.invalidateQueries({ queryKey: ["atividades"] });
            setRemovendo(null);
          }}
        />
      )}
    </div>
  );
}

function Arquivados() {
  const { turmas } = useMinhasTurmas();
  const [turmaId, setTurmaId] = useState<number | null>(null);
  if (!turmas) return <Carregando />;
  const turma = turmas.find((t) => t.id === (turmaId ?? turmas[0]?.id));
  if (!turma) return <EmptyState icon={Archive} title="Nenhuma turma disponível." description="" />;
  return (
    <div>
      <div className="tv-card" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }} htmlFor="arq-turma">Turma</label>
        <select id="arq-turma" className="tv-input" style={{ width: "auto", minWidth: 200 }} value={turma.id} onChange={(e) => setTurmaId(Number(e.target.value))}>
          {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <span style={{ fontSize: 12.5, color: C.inkSoft }}>Planejamentos de professores que saíram e foram mantidos na remoção. Somente leitura.</span>
      </div>
      <PlanejamentosArquivados turmaId={turma.id} turmaNome={turma.nome} />
    </div>
  );
}
