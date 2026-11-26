import { useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, ClipboardList, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { Carregando } from "@/components/TelaCarregando";
import { useUsuario } from "@/features/auth/AuthContext";
import { BotoesExportar } from "@/features/exportacao/BotoesExportar";
import { diaPorExtenso, montarCronograma } from "@/features/exportacao/cronograma";
import { dataModelo } from "@/features/exportacao/planejamento";
import { hojeISO } from "@/features/planejamentos/dominio";
import { useMinhasTurmas } from "@/features/planejamentos/PlanejamentosPage";
import { useDisciplinas } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";
import { useAvaliacoes, useProfessoresDaTurma, type Avaliacao, type TipoAvaliacao } from "./api";

const GESTAO = ["diretor", "secretaria", "coordenador"];
/** Bimestre provável pela data de hoje (fev–abr = 1º, mai–jul = 2º, ago–set = 3º, out–dez = 4º). */
function bimestreAtual(): number {
  const m = Number(hojeISO().slice(5, 7));
  return m <= 4 ? 1 : m <= 7 ? 2 : m <= 9 ? 3 : 4;
}

/** Cronograma de Avaliação da turma: datas agendadas pela gestão, conteúdo cadastrado pelos professores. */
export function CronogramaPage() {
  const eu = useUsuario();
  const { turmas, erro } = useMinhasTurmas();
  const disciplinas = useDisciplinas();
  const qc = useQueryClient();
  const [turmaId, setTurmaId] = useState<number | null>(null);
  const [tipo, setTipo] = useState<TipoAvaliacao>("bimestral");
  const [bimestre, setBimestre] = useState(bimestreAtual());
  const [ano, setAno] = useState(Number(hojeISO().slice(0, 4)));
  const [agendando, setAgendando] = useState<Avaliacao | "nova" | null>(null);
  const [cadastrando, setCadastrando] = useState<Avaliacao | null>(null);
  const [removendo, setRemovendo] = useState<Avaliacao | null>(null);

  const turma = turmas?.find((t) => t.id === (turmaId ?? turmas[0]?.id)) ?? null;
  const avaliacoes = useAvaliacoes(turma?.id, ano);
  const professores = useProfessoresDaTurma(turma?.id);

  if (erro) return <Aviso>{mensagemDeErro(erro)}</Aviso>;
  if (!turmas || !disciplinas.data) return <Carregando />;
  if (!turma) return <EmptyState icon={ClipboardList} title="Nenhuma turma no seu escopo." description="" />;

  const souGestao = GESTAO.includes(eu.papel);
  const nomeDisc = (id: number) => disciplinas.data.find((d) => d.id === id)?.nome ?? "Disciplina";
  const profs = professores.data ?? [];
  const regente = profs.find((p) => p.regente);
  const professorDe = (disc: number) => profs.filter((p) => p.disciplina_id === disc);
  const leciono = (disc: number) => profs.some((p) => p.disciplina_id === disc && p.usuario_id === eu.id);
  const lista = (avaliacoes.data ?? [])
    .filter((a) => a.tipo === tipo && a.bimestre === bimestre)
    .sort((a, b) => a.data.localeCompare(b.data) || nomeDisc(a.disciplina_id).localeCompare(nomeDisc(b.disciplina_id)));
  const pendentes = lista.filter((a) => !a.conteudo.trim()).length;
  const atualizar = () => qc.invalidateQueries({ queryKey: ["avaliacoes"] });

  // Especialista aparece como "Prof(a) …"; a regente já está no cabeçalho.
  const rotuloProfessor = (disc: number) =>
    professorDe(disc).filter((p) => !p.regente).map((p) => p.nome).join(", ");

  const montar = async () =>
    montarCronograma({
      turma: turma.nome,
      regente: regente?.nome ?? "",
      tipo,
      bimestre,
      ano,
      itens: lista.map((a) => ({
        data: a.data,
        disciplina: nomeDisc(a.disciplina_id),
        professor: rotuloProfessor(a.disciplina_id),
        conteudo: a.conteudo,
        material: a.material,
        orientacoes: a.orientacoes,
      })),
    });

  const botaoAba = (ativo: boolean) =>
    ({
      fontSize: 12.5, fontWeight: 600, padding: "6px 11px", borderRadius: 999, cursor: "pointer",
      background: ativo ? C.primary : "#fff", color: ativo ? "#fff" : C.inkSoft, border: `1px solid ${ativo ? C.primary : C.border}`,
    }) as const;

  return (
    <div>
      <div className="tv-card" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <select className="tv-input" style={{ width: "auto", minWidth: 180 }} value={turma.id} onChange={(e) => setTurmaId(Number(e.target.value))} aria-label="Turma">
          {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <div role="radiogroup" aria-label="Tipo de avaliação" style={{ display: "flex", gap: 4 }}>
          {(["mensal", "bimestral"] as const).map((id) => (
            <button key={id} role="radio" aria-checked={tipo === id} onClick={() => setTipo(id)} style={botaoAba(tipo === id)}>
              {id === "mensal" ? "Mensal" : "Bimestral"}
            </button>
          ))}
        </div>
        <select className="tv-input" style={{ width: "auto" }} value={bimestre} onChange={(e) => setBimestre(Number(e.target.value))} aria-label="Bimestre">
          {[1, 2, 3, 4].map((b) => <option key={b} value={b}>{b}º bimestre</option>)}
        </select>
        <select className="tv-input" style={{ width: "auto" }} value={ano} onChange={(e) => setAno(Number(e.target.value))} aria-label="Ano">
          {[ano - 1, ano, ano + 1].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {souGestao && (
          <button className="tv-btn tv-btn-primary" style={{ marginLeft: "auto" }} onClick={() => setAgendando("nova")}>
            <CalendarPlus size={15} /> Agendar avaliação
          </button>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
            Avaliação {tipo === "mensal" ? "mensal" : "bimestral"} · {bimestre}º bimestre de {ano}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: C.inkSoft }}>
            {turma.nome}
            {regente && ` — Prof(a) ${regente.nome}`}
            {pendentes > 0 && <span style={{ color: "#B45309" }}> · {pendentes} {pendentes === 1 ? "conteúdo pendente" : "conteúdos pendentes"}</span>}
          </p>
        </div>
        <BotoesExportar montar={montar} desabilitado={lista.length === 0} />
      </div>

      {avaliacoes.error && <Aviso>{mensagemDeErro(avaliacoes.error)}</Aviso>}
      {!avaliacoes.data ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma avaliação agendada."
          description={
            souGestao
              ? "Agende as datas das avaliações desta turma. Depois, cada professor cadastra o conteúdo da sua disciplina."
              : "As datas são definidas pela Secretaria, Coordenação ou Direção. Quando estiverem agendadas, você cadastra o conteúdo aqui."
          }
        />
      ) : (
        <div className="tv-card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: "#F9FAFB", textAlign: "left" }}>
                {["Data", "Disciplina", "Conteúdo", ""].map((h) => (
                  <th key={h} style={{ padding: "11px 14px", fontWeight: 600, color: C.inkSoft, fontSize: 12.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((a, i) => {
                const primeiraDoDia = i === 0 || lista[i - 1]!.data !== a.data;
                const prof = rotuloProfessor(a.disciplina_id);
                const posso = leciono(a.disciplina_id) || souGestao;
                return (
                  <tr key={a.id} style={{ borderTop: `1px solid ${primeiraDoDia ? C.border : "#F3F4F6"}`, verticalAlign: "top" }}>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      {primeiraDoDia && (
                        <>
                          <strong>{dataModelo(a.data)}</strong>
                          <br />
                          <span style={{ fontSize: 12, color: C.inkSoft }}>{diaPorExtenso(a.data)}</span>
                        </>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <strong>{nomeDisc(a.disciplina_id)}</strong>
                      {prof && <span style={{ display: "block", fontSize: 12, color: C.inkSoft }}>Prof(a) {prof}</span>}
                    </td>
                    <td style={{ padding: "12px 14px", maxWidth: 520 }}>
                      {a.conteudo.trim() ? (
                        <>
                          <span style={{ whiteSpace: "pre-wrap" }}>{a.conteudo}</span>
                          {a.material.trim() && (
                            <span style={{ display: "block", marginTop: 6, fontSize: 12.5 }}>
                              <strong>Material de apoio:</strong>
                              <Links texto={a.material} />
                            </span>
                          )}
                          {a.orientacoes.trim() && (
                            <span style={{ display: "inline-block", marginTop: 6, fontSize: 11.5, fontWeight: 600, color: C.primaryDeep, background: "#E6F0E9", padding: "2px 8px", borderRadius: 6 }}>
                              Com orientações (anexo)
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ fontStyle: "italic", color: "#B45309" }}>Conteúdo ainda não cadastrado.</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        {posso && (
                          <button className={a.conteudo.trim() ? "tv-btn-text" : "tv-btn tv-btn-primary"} style={{ fontSize: 12.5, ...(a.conteudo.trim() ? {} : { padding: "5px 10px" }) }} onClick={() => setCadastrando(a)}>
                            {a.conteudo.trim() ? "Editar conteúdo" : "Cadastrar avaliação"}
                          </button>
                        )}
                        {souGestao && (
                          <span style={{ display: "inline-flex", gap: 10 }}>
                            <button className="tv-btn-text" style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 12.5 }} onClick={() => setAgendando(a)}>
                              <Pencil size={12} /> Data
                            </button>
                            <button className="tv-btn-text-danger" style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 12.5 }} onClick={() => setRemovendo(a)}>
                              <Trash2 size={12} /> Remover
                            </button>
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {agendando && (
        <AgendarModal
          avaliacao={agendando === "nova" ? null : agendando}
          disciplinasDaTurma={[...new Set(profs.map((p) => p.disciplina_id))]
            .filter((d) => agendando !== "nova" || !lista.some((a) => a.disciplina_id === d))
            .map((d) => ({ id: d, nome: nomeDisc(d) }))
            .sort((a, b) => a.nome.localeCompare(b.nome))}
          rotulo={`${tipo === "mensal" ? "Avaliação mensal" : "Avaliação bimestral"} · ${bimestre}º bimestre de ${ano} · ${turma.nome}`}
          onFechar={() => setAgendando(null)}
          onSalvar={async (disciplina, data) => {
            verificar(
              await supabase.rpc("agendar_avaliacao", {
                p_id: (agendando === "nova" ? null : agendando.id) as never,
                p_turma: turma.id, p_disciplina: disciplina, p_tipo: tipo, p_bimestre: bimestre, p_ano: ano, p_data: data,
              }),
            );
            await atualizar();
            setAgendando(null);
          }}
        />
      )}
      {cadastrando && (
        <CadastrarModal
          avaliacao={cadastrando}
          titulo={`${nomeDisc(cadastrando.disciplina_id)} · ${dataModelo(cadastrando.data)} (${diaPorExtenso(cadastrando.data)})`}
          onFechar={() => setCadastrando(null)}
          onSalvar={async (conteudo, material, orientacoes) => {
            verificar(await supabase.rpc("cadastrar_avaliacao", { p_id: cadastrando.id, p_conteudo: conteudo, p_material: material, p_orientacoes: orientacoes }));
            await atualizar();
            setCadastrando(null);
          }}
        />
      )}
      {removendo && (
        <ConfirmarAcao
          titulo="Remover avaliação"
          mensagem={<>Remover a avaliação de <strong>{nomeDisc(removendo.disciplina_id)}</strong> de {dataModelo(removendo.data)}? O conteúdo cadastrado pelo professor também é apagado.</>}
          rotuloConfirmar="Remover"
          perigo
          onCancelar={() => setRemovendo(null)}
          onConfirmar={async () => {
            verificar(await supabase.rpc("remover_avaliacao", { p_id: removendo.id }));
            await atualizar();
            setRemovendo(null);
          }}
        />
      )}
    </div>
  );
}

/** Links do material de apoio clicáveis (um por linha); o resto como texto. */
function Links({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/\r?\n/).filter((l) => l.trim()).map((l, i) =>
        /^https?:\/\/\S+$/.test(l.trim()) ? (
          <a key={i} href={l.trim()} target="_blank" rel="noreferrer" style={{ display: "block", color: C.primaryDeep, wordBreak: "break-all" }}>{l.trim()}</a>
        ) : (
          <span key={i} style={{ display: "block" }}>{l}</span>
        ),
      )}
    </>
  );
}

function AgendarModal({
  avaliacao, disciplinasDaTurma, rotulo, onFechar, onSalvar,
}: {
  avaliacao: Avaliacao | null;
  disciplinasDaTurma: { id: number; nome: string }[];
  rotulo: string;
  onFechar: () => void;
  onSalvar: (disciplina: number, data: string) => Promise<void>;
}) {
  const [disciplina, setDisciplina] = useState<number | "">(avaliacao?.disciplina_id ?? disciplinasDaTurma[0]?.id ?? "");
  const [data, setData] = useState(avaliacao?.data ?? hojeISO());
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar() {
    setEnviando(true);
    setErro(null);
    try {
      await onSalvar(Number(disciplina), data);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo={avaliacao ? "Mudar a data da avaliação" : "Agendar avaliação"}
      subtitulo={rotulo}
      onFechar={onFechar}
      rodape={
        <>
          <button className="tv-btn tv-btn-secondary" onClick={onFechar} disabled={enviando}>Cancelar</button>
          <button className="tv-btn tv-btn-primary" onClick={() => void salvar()} disabled={enviando || disciplina === "" || !data}>
            {enviando ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Disciplina</span>
        <select className="tv-input" style={{ marginTop: 6 }} value={disciplina} disabled={!!avaliacao} onChange={(e) => setDisciplina(Number(e.target.value))}>
          {avaliacao && <option value={avaliacao.disciplina_id}>{disciplinasDaTurma.find((d) => d.id === avaliacao.disciplina_id)?.nome ?? "Disciplina"}</option>}
          {!avaliacao && disciplinasDaTurma.length === 0 && <option value="">Todas as disciplinas já têm avaliação agendada</option>}
          {!avaliacao && disciplinasDaTurma.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
      </label>
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Data da avaliação</span>
        <input type="date" className="tv-input" style={{ marginTop: 6 }} value={data} onChange={(e) => setData(e.target.value)} />
      </label>
      {erro && <Aviso>{erro}</Aviso>}
    </Modal>
  );
}

function CadastrarModal({
  avaliacao, titulo, onFechar, onSalvar,
}: {
  avaliacao: Avaliacao;
  titulo: string;
  onFechar: () => void;
  onSalvar: (conteudo: string, material: string, orientacoes: string) => Promise<void>;
}) {
  const [conteudo, setConteudo] = useState(avaliacao.conteudo);
  const [material, setMaterial] = useState(avaliacao.material);
  const [orientacoes, setOrientacoes] = useState(avaliacao.orientacoes);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar() {
    setEnviando(true);
    setErro(null);
    try {
      await onSalvar(conteudo, material, orientacoes);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  const area = (rotulo: string, ajuda: string, valor: string, set: (v: string) => void, linhas: number) => (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{rotulo}</span>
      <span style={{ display: "block", fontSize: 12, color: C.inkSoft, margin: "2px 0 6px" }}>{ajuda}</span>
      <textarea className="tv-input" rows={linhas} value={valor} onChange={(e) => set(e.target.value)} />
    </label>
  );

  return (
    <Modal
      titulo="Cadastrar avaliação"
      subtitulo={titulo}
      onFechar={onFechar}
      rodape={
        <>
          <button className="tv-btn tv-btn-secondary" onClick={onFechar} disabled={enviando}>Cancelar</button>
          <button className="tv-btn tv-btn-primary" onClick={() => void salvar()} disabled={enviando || !conteudo.trim()}>
            {enviando ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      {area("Conteúdo", "O que cai na avaliação, com as páginas. Um item por linha.", conteudo, setConteudo, 6)}
      {area("Material de apoio (opcional)", "Links de vídeos e materiais, um por linha.", material, setMaterial, 3)}
      {area("Orientações (opcional)", "Para trabalhos e pesquisas: vira um anexo no cronograma.", orientacoes, setOrientacoes, 4)}
      {erro && <Aviso>{erro}</Aviso>}
    </Modal>
  );
}
