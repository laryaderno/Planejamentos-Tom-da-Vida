import { useQueryClient } from "@tanstack/react-query";
import { Check, Download, FileText, X } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Modal } from "@/components/Modal";
import { useUsuario } from "@/features/auth/AuthContext";
import { useNomes } from "@/features/planejamentos/api";
import { dataCurta } from "@/features/planejamentos/dominio";
import { formatarData, useDisciplinas, useTurmas } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { podeEditarEtapa } from "@/lib/papeis";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";
import { baixarAtividade, tamanhoLegivel, TIPOS_ARQUIVO, useAtividades, type AtividadeComOrigem } from "./api";

/** Atividades aguardando aprovação no escopo de quem aprova. */
export function usePendentesParaAprovar(): AtividadeComOrigem[] {
  const eu = useUsuario();
  const atividades = useAtividades();
  if (eu.papel === "professor") return [];
  return (atividades.data ?? []).filter((a) => a.status === "pendente" && podeEditarEtapa(eu, a.etapa_id));
}

export function AtividadesParaAprovar() {
  const pendentes = usePendentesParaAprovar();
  const disciplinas = useDisciplinas();
  const turmas = useTurmas();
  const nomes = useNomes(pendentes.map((a) => a.proposta_por));
  const [recusando, setRecusando] = useState<AtividadeComOrigem | null>(null);

  if (pendentes.length === 0) {
    return <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>Nenhuma atividade aguardando aprovação.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {pendentes.map((a) => (
        <CartaoPendente
          key={a.id}
          atividade={a}
          disciplina={disciplinas.data?.find((d) => d.id === a.disciplina_id)?.nome ?? ""}
          turma={turmas.data?.find((t) => t.id === a.blocos?.planejamentos?.turma_id)?.nome ?? ""}
          professor={nomes.data?.get(a.proposta_por) ?? "…"}
          onRecusar={() => setRecusando(a)}
        />
      ))}
      {recusando && <RecusarModal atividade={recusando} onFechar={() => setRecusando(null)} />}
    </div>
  );
}

function CartaoPendente({
  atividade: a, disciplina, turma, professor, onRecusar,
}: {
  atividade: AtividadeComOrigem;
  disciplina: string;
  turma: string;
  professor: string;
  onRecusar: () => void;
}) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState(a.titulo);
  const [tema, setTema] = useState(a.tema);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const data = a.blocos?.planejamentos?.data;

  async function aprovar() {
    setEnviando(true);
    setErro(null);
    try {
      verificar(await supabase.rpc("avaliar_atividade", { p_id: a.id, p_aprovar: true, p_titulo: titulo, p_tema: tema }));
      await qc.invalidateQueries({ queryKey: ["atividades"] });
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  async function baixar() {
    try {
      await baixarAtividade(a);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  return (
    <div className="tv-card" style={{ padding: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <FileText size={18} color={C.primaryDeep} style={{ marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 8px" }}>
            <strong style={{ color: C.ink }}>{professor}</strong> · {disciplina}
            {turma && <> · {turma}</>}
            {data && <span style={{ textTransform: "capitalize" }}> · {dataCurta(data)}</span>} · enviado em {formatarData(a.proposta_em, true)}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
            <label>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Título</span>
              <input className="tv-input" style={{ marginTop: 4, padding: "7px 9px" }} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </label>
            <label>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Tema (pasta)</span>
              <input className="tv-input" style={{ marginTop: 4, padding: "7px 9px" }} value={tema} onChange={(e) => setTema(e.target.value)} />
            </label>
          </div>
          <button type="button" className="tv-btn-text" onClick={() => void baixar()} style={{ display: "inline-flex", gap: 5, alignItems: "center", fontSize: 12.5, marginTop: 8, padding: 0 }}>
            <Download size={13} /> {a.arquivo_nome} ({TIPOS_ARQUIVO[a.arquivo_tipo]?.rotulo ?? "Arquivo"}, {tamanhoLegivel(a.arquivo_tamanho)})
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, alignSelf: "center" }}>
          <button className="tv-btn tv-btn-secondary" onClick={onRecusar} disabled={enviando}>
            <X size={14} /> Recusar
          </button>
          <button className="tv-btn tv-btn-primary" onClick={() => void aprovar()} disabled={enviando || !titulo.trim() || !tema.trim()}>
            <Check size={14} /> {enviando ? "Aprovando…" : "Aprovar"}
          </button>
        </div>
      </div>
      {erro && <div style={{ marginTop: 10 }}><Aviso>{erro}</Aviso></div>}
    </div>
  );
}

function RecusarModal({ atividade, onFechar }: { atividade: AtividadeComOrigem; onFechar: () => void }) {
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function recusar() {
    setEnviando(true);
    setErro(null);
    try {
      verificar(await supabase.rpc("avaliar_atividade", { p_id: atividade.id, p_aprovar: false, p_motivo: motivo }));
      await qc.invalidateQueries({ queryKey: ["atividades"] });
      onFechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo="Recusar atividade"
      onFechar={enviando ? () => {} : onFechar}
      rodape={
        <>
          <button className="tv-btn tv-btn-secondary" onClick={onFechar} disabled={enviando}>Cancelar</button>
          <button className="tv-btn tv-btn-primary" style={{ background: C.red }} onClick={recusar} disabled={enviando || !motivo.trim()}>
            {enviando ? "Recusando…" : "Recusar"}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: "0 0 12px" }}>
        <strong>{atividade.titulo}</strong> não entrará no banco de atividades. O professor recebe o motivo e pode enviar uma nova versão.
      </p>
      <label>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Motivo</span>
        <textarea className="tv-input" rows={3} style={{ marginTop: 6, fontFamily: "inherit", resize: "vertical" }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: o arquivo está ilegível; envie em PDF." />
      </label>
      {erro && <div style={{ marginTop: 10 }}><Aviso>{erro}</Aviso></div>}
    </Modal>
  );
}
