import { useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { Modal } from "@/components/Modal";
import { useUsuario } from "@/features/auth/AuthContext";
import { mensagemDeErro } from "@/lib/erros";
import { C } from "@/styles/tokens";
import {
  ACEITOS,
  baixarAtividade,
  enviarAtividade,
  removerAtividade,
  STATUS_ATIVIDADE,
  tamanhoLegivel,
  TIPOS_ARQUIVO,
  tipoDoArquivo,
  tituloDoArquivo,
  useAtividades,
  useAtividadesDoBloco,
  type Atividade,
} from "./api";

interface Props {
  blocoId: number;
  etapaId: number;
  disciplinaId: number;
  /** O professor dono do bloco (pode anexar e remover os não aprovados). */
  editavel: boolean;
}

/** Arquivos das "Atividades Propostas" do bloco. Cada um vai para aprovação e, aprovado, para o banco. */
export function AnexosBloco({ blocoId, etapaId, disciplinaId, editavel }: Props) {
  const anexos = useAtividadesDoBloco(blocoId);
  const qc = useQueryClient();
  const [anexando, setAnexando] = useState(false);
  const [removendo, setRemovendo] = useState<Atividade | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const lista = anexos.data ?? [];

  const atualizar = () => qc.invalidateQueries({ queryKey: ["atividades"] });

  if (!editavel && lista.length === 0) return null;

  async function baixar(a: Atividade) {
    setErro(null);
    try {
      await baixarAtividade(a);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      {lista.map((a) => {
        const st = STATUS_ATIVIDADE[a.status];
        return (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", border: `1px solid ${C.border}`, borderRadius: 8, background: "#fff", marginBottom: 6, fontSize: 12.5 }}>
            <FileText size={15} color={C.primaryDeep} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.arquivo_nome}>
                {a.titulo}
              </span>
              <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", color: C.inkSoft }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: st.cor, background: st.fundo, padding: "1px 7px", borderRadius: 999 }}>{st.rotulo}</span>
                {a.tema} · {TIPOS_ARQUIVO[a.arquivo_tipo]?.rotulo ?? "Arquivo"} · {tamanhoLegivel(a.arquivo_tamanho)}
              </span>
              {a.status === "recusada" && a.motivo_recusa && (
                <span style={{ display: "block", color: C.red, marginTop: 2 }}>Motivo: {a.motivo_recusa}</span>
              )}
            </span>
            <button type="button" className="tv-btn-text" aria-label={`Baixar ${a.titulo}`} onClick={() => void baixar(a)}>
              <Download size={14} />
            </button>
            {editavel && a.status !== "aprovada" && (
              <button type="button" className="tv-btn-text-danger" aria-label={`Remover ${a.titulo}`} onClick={() => setRemovendo(a)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        );
      })}
      {editavel && (
        <button type="button" className="tv-btn-text" onClick={() => setAnexando(true)} style={{ display: "inline-flex", gap: 5, alignItems: "center", fontSize: 12.5, padding: "4px 0" }}>
          <Paperclip size={13} /> Anexar arquivo da atividade
        </button>
      )}
      {erro && <div style={{ marginTop: 6 }}><Aviso>{erro}</Aviso></div>}

      {anexando && (
        <AnexarModal blocoId={blocoId} etapaId={etapaId} disciplinaId={disciplinaId} onFechar={() => setAnexando(false)} aoEnviar={atualizar} />
      )}
      {removendo && (
        <ConfirmarAcao
          titulo="Remover anexo"
          mensagem={<>Remover o arquivo <strong>{removendo.titulo}</strong> ({removendo.arquivo_nome})? Ele deixa de aguardar aprovação.</>}
          irreversivel="O arquivo é apagado e não pode ser recuperado."
          rotuloConfirmar="Remover"
          perigo
          onCancelar={() => setRemovendo(null)}
          onConfirmar={async () => {
            await removerAtividade(removendo);
            await atualizar();
            setRemovendo(null);
          }}
        />
      )}
    </div>
  );
}

function AnexarModal({
  blocoId, etapaId, disciplinaId, onFechar, aoEnviar,
}: {
  blocoId: number;
  etapaId: number;
  disciplinaId: number;
  onFechar: () => void;
  aoEnviar: () => Promise<unknown>;
}) {
  const eu = useUsuario();
  const todas = useAtividades();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [tema, setTema] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Temas já usados no banco desta etapa e disciplina, para manter as pastas organizadas.
  const temas = [...new Set((todas.data ?? []).filter((a) => a.etapa_id === etapaId && a.disciplina_id === disciplinaId).map((a) => a.tema))].sort();
  const tipo = arquivo ? tipoDoArquivo(arquivo.name, arquivo.type) : null;
  const limite = tipo ? TIPOS_ARQUIVO[tipo]!.limite : 0;
  const problema = !arquivo
    ? null
    : !tipo
      ? "Tipo de arquivo não aceito. Envie PDF, Word, imagem, apresentação, planilha, áudio (MP3/M4A) ou vídeo (MP4)."
      : arquivo.size > limite
        ? `O arquivo tem ${tamanhoLegivel(arquivo.size)}; o limite para este tipo é ${tamanhoLegivel(limite)}.`
        : null;

  function escolher(f: File | null) {
    setArquivo(f);
    setErro(null);
    if (f && !titulo.trim()) setTitulo(tituloDoArquivo(f.name));
  }

  async function enviar() {
    if (!arquivo || !tipo || problema) return;
    setEnviando(true);
    setErro(null);
    try {
      await enviarAtividade({ arquivo, tipo, blocoId, professorId: eu.id, titulo: titulo.trim(), tema: tema.trim() });
      await aoEnviar();
      onFechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo="Anexar arquivo da atividade"
      subtitulo="O arquivo vai para aprovação da coordenação. Aprovado, entra no Banco de atividades da etapa."
      largura={480}
      onFechar={enviando ? () => {} : onFechar}
      rodape={
        <>
          <button className="tv-btn tv-btn-secondary" onClick={onFechar} disabled={enviando}>Cancelar</button>
          <button className="tv-btn tv-btn-primary" onClick={enviar} disabled={enviando || !arquivo || !!problema || !titulo.trim() || !tema.trim()}>
            <Upload size={14} /> {enviando ? "Enviando…" : "Enviar para aprovação"}
          </button>
        </>
      }
    >
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Arquivo</span>
        <input type="file" accept={ACEITOS} className="tv-input" style={{ marginTop: 6 }} onChange={(e) => escolher(e.target.files?.[0] ?? null)} />
        <span style={{ display: "block", fontSize: 12, color: C.inkSoft, marginTop: 4 }}>
          PDF, Word, imagens, apresentações e planilhas até 20 MB; áudio e vídeo curtos até 50 MB.
        </span>
      </label>
      {problema && <div style={{ marginBottom: 12 }}><Aviso>{problema}</Aviso></div>}
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Título</span>
        <input className="tv-input" style={{ marginTop: 6 }} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Caça às formas geométricas" />
      </label>
      <label style={{ display: "block", marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Tema (pasta no banco)</span>
        <input className="tv-input" style={{ marginTop: 6 }} list={`temas-${blocoId}`} value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ex.: Matemática e Raciocínio Lógico" />
        <datalist id={`temas-${blocoId}`}>
          {temas.map((t) => <option key={t} value={t} />)}
        </datalist>
        <span style={{ display: "block", fontSize: 12, color: C.inkSoft, marginTop: 4 }}>
          {temas.length ? "Escolha um tema existente ou escreva um novo." : "Escreva o tema; quem aprova pode ajustar."}
        </span>
      </label>
      {erro && <div style={{ marginTop: 10 }}><Aviso>{erro}</Aviso></div>}
    </Modal>
  );
}
