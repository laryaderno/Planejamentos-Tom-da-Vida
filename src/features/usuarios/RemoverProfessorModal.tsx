import { AlertTriangle, Archive, EyeOff } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Modal } from "@/components/Modal";
import { mensagemDeErro } from "@/lib/erros";
import { C } from "@/styles/tokens";

export type DestinoPlanejamentos = "manter" | "excluir";

interface Props {
  nome: string;
  /** Turmas atuais do professor, para o texto de confirmação. */
  turmas: string;
  onCancel: () => void;
  onConfirm: (destino: DestinoPlanejamentos) => Promise<void>;
}

/**
 * Remoção de professor com escolha do destino dos planejamentos (decisão D6).
 * Em nenhuma opção o planejamento é apagado: os excluídos seguem no conteúdo
 * programático e no relatório de entregas (ARQUITETURA.md §3.2).
 */
export function RemoverProfessorModal({ nome, turmas, onCancel, onConfirm }: Props) {
  const [destino, setDestino] = useState<DestinoPlanejamentos>("manter");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const opcoes = [
    {
      valor: "manter" as const,
      Icone: Archive,
      titulo: "Manter planejamentos",
      descricao: "Ficam arquivados, somente leitura, no Banco de atividades → Planejamentos de cada turma.",
    },
    {
      valor: "excluir" as const,
      Icone: EyeOff,
      titulo: "Excluir planejamentos",
      descricao: "Somem das telas de planejamento e do Banco de atividades, mas continuam salvos no conteúdo programático e no relatório de entregas.",
    },
  ];

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      await onConfirm(destino);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo="Remover professor"
      largura={470}
      onFechar={enviando ? () => {} : onCancel}
      rodape={
        <>
          <button className="tv-btn tv-btn-secondary" onClick={onCancel} disabled={enviando}>Cancelar</button>
          <button
            className="tv-btn tv-btn-primary"
            style={destino === "excluir" ? { background: C.red } : undefined}
            onClick={confirmar}
            disabled={enviando}
          >
            {enviando ? "Removendo…" : destino === "excluir" ? "Remover e excluir" : "Remover e manter"}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.55, margin: "0 0 16px" }}>
        Você está prestes a remover o acesso de <strong>{nome}</strong>
        {turmas ? <> às turmas <strong>{turmas}</strong></> : null}. O que fazer com os planejamentos dele(a)?
      </p>

      <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {opcoes.map(({ valor, Icone, titulo, descricao }) => {
          const ativo = destino === valor;
          const perigo = valor === "excluir";
          return (
            <label
              key={valor}
              style={{
                display: "flex", gap: 12, padding: 12, borderRadius: 9, cursor: "pointer",
                border: `1.5px solid ${ativo ? (perigo ? C.red : C.gold) : C.border}`,
                background: ativo ? (perigo ? "#FBEFEC" : "#FBF4E7") : "#fff",
              }}
            >
              <input
                type="radio"
                name="destino"
                value={valor}
                checked={ativo}
                onChange={() => setDestino(valor)}
                style={{ marginTop: 3, accentColor: perigo ? C.red : C.gold }}
              />
              <span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: perigo ? C.red : C.ink }}>
                  <Icone size={14} /> {titulo}
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: C.inkSoft, marginTop: 3, lineHeight: 1.5 }}>{descricao}</span>
              </span>
            </label>
          );
        })}
      </div>

      <p style={{ display: "flex", gap: 8, fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5, margin: 0 }}>
        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        A remoção do acesso não pode ser desfeita automaticamente; para voltar, o professor precisa se cadastrar de novo.
      </p>
      {erro && <div style={{ marginTop: 12 }}><Aviso>{erro}</Aviso></div>}
    </Modal>
  );
}
