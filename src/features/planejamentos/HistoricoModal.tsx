import { Aviso } from "@/components/Aviso";
import { Modal } from "@/components/Modal";
import { Carregando } from "@/components/TelaCarregando";
import { formatarData } from "@/lib/consultas";
import { mensagemDeErro } from "@/lib/erros";
import { C } from "@/styles/tokens";
import { useHistorico, useNomes, type Bloco } from "./api";
import { INTELIGENCIAS, LINGUAGENS_AMOR, ROTULO_CAMPO, STATUS, type Inteligencia, type LinguagemAmor, type StatusBloco } from "./dominio";

function legivel(campo: string, valor: string | null): string {
  if (valor === null || valor === "") return "—";
  if (campo === "status") return STATUS[valor as StatusBloco]?.rotulo ?? valor;
  if (campo === "linguagem_amor") return LINGUAGENS_AMOR[valor as LinguagemAmor] ?? valor;
  if (campo === "habilidades") {
    try {
      const lista = JSON.parse(valor) as Inteligencia[];
      return lista.length ? lista.map((h) => INTELIGENCIAS[h]).join(", ") : "—";
    } catch {
      return valor;
    }
  }
  if (campo === "arquivado_em" || campo === "excluido_em") return formatarData(valor, true);
  if (campo.startsWith("hora_")) return valor.slice(0, 5);
  return valor.length > 160 ? `${valor.slice(0, 160)}…` : valor;
}

/** Histórico completo de edições do bloco (§6.3). */
export function HistoricoModal({ bloco, onFechar }: { bloco: Bloco; onFechar: () => void }) {
  const historico = useHistorico(bloco.id);
  const nomes = useNomes([bloco.professor_id, ...(historico.data ?? []).map((h) => h.autor_id)]);
  const nome = (id: string | null) => (id ? nomes.data?.get(id) ?? "—" : "Sistema");

  return (
    <Modal titulo="Histórico de edições" subtitulo={`Criado em ${formatarData(bloco.criado_em, true)} · última alteração ${formatarData(bloco.atualizado_em, true)}`} largura={560} onFechar={onFechar}>
      {historico.error && <Aviso>{mensagemDeErro(historico.error)}</Aviso>}
      {!historico.data && !historico.error && <Carregando />}
      {historico.data?.length === 0 && <p style={{ fontSize: 13, color: C.inkSoft }}>Nenhuma alteração desde a criação.</p>}
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {historico.data?.map((h) => (
          <li key={h.id} style={{ padding: "10px 0", borderTop: `1px solid ${C.border}`, fontSize: 13 }}>
            <p style={{ margin: "0 0 3px", color: C.inkSoft, fontSize: 12 }}>
              {formatarData(h.em, true)} · {nome(h.autor_id)}
            </p>
            <p style={{ margin: 0 }}>
              <strong>{ROTULO_CAMPO[h.campo] ?? h.campo}:</strong>{" "}
              <span style={{ color: C.inkSoft, textDecoration: "line-through" }}>{legivel(h.campo, h.valor_anterior)}</span>{" "}
              → <span>{legivel(h.campo, h.valor_novo)}</span>
            </p>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
