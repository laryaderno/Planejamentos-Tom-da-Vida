import { useQuery } from "@tanstack/react-query";
import { CalendarOff, Download, Lock, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { Modal } from "@/components/Modal";
import { Carregando } from "@/components/TelaCarregando";
import { useUsuario } from "@/features/auth/AuthContext";
import { dataCurta, hojeISO } from "@/features/planejamentos/dominio";
import type { Tables } from "@/lib/database.types";
import { useEtapas, useRecarregar } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { podeAlterarConfiguracao } from "@/lib/papeis";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";

export type DiaSemAula = Tables<"dias_sem_aula">;

export function useDiasSemAula() {
  return useQuery({
    queryKey: ["dias-sem-aula"],
    queryFn: async () => verificar(await supabase.from("dias_sem_aula").select("*").order("data")),
  });
}

/** Calendário escolar: feriados, recessos e outros dias sem aula. */
export function DiasSemAula() {
  const eu = useUsuario();
  const dias = useDiasSemAula();
  const etapas = useEtapas();
  const recarregar = useRecarregar();
  const anoAtual = Number(hojeISO().slice(0, 4));
  const [ano, setAno] = useState(anoAtual);
  const [novo, setNovo] = useState(false);
  const [removendo, setRemovendo] = useState<DiaSemAula | null>(null);
  const [importando, setImportando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  if (dias.error) return <Aviso>{mensagemDeErro(dias.error)}</Aviso>;
  if (!dias.data) return <Carregando />;

  const doAno = dias.data.filter((d) => d.data.startsWith(String(ano)));
  const etapaNome = (id: number | null) => (id ? etapas.data?.find((e) => e.id === id)?.nome : null);

  async function importar() {
    setImportando(true);
    setMensagem(null);
    try {
      const n = verificar(await supabase.rpc("importar_feriados_nacionais", { p_ano: ano }));
      await recarregar();
      setMensagem({ tipo: "sucesso", texto: n > 0 ? `${n} feriados nacionais de ${ano} importados.` : `Os feriados nacionais de ${ano} já estavam cadastrados.` });
    } catch (e) {
      setMensagem({ tipo: "erro", texto: mensagemDeErro(e) });
    } finally {
      setImportando(false);
    }
  }

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Dias sem aula</h2>
          <select className="tv-input" style={{ width: "auto", padding: "5px 8px" }} value={ano} onChange={(e) => setAno(Number(e.target.value))} aria-label="Ano">
            {[anoAtual - 1, anoAtual, anoAtual + 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="tv-btn tv-btn-secondary" onClick={importar} disabled={importando}>
            <Download size={15} /> {importando ? "Importando…" : `Importar feriados nacionais de ${ano}`}
          </button>
          <button className="tv-btn tv-btn-primary" onClick={() => setNovo(true)}>
            <Plus size={15} /> Novo dia sem aula
          </button>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 12px", maxWidth: 640, lineHeight: 1.5 }}>
        Feriados, recessos, formações e eventos sem aula. Nesses dias o planejamento não é exigido para a entrega e
        eles não contam como dias úteis de antecedência. Feriados estaduais e municipais precisam ser cadastrados aqui.
      </p>
      {mensagem && <div style={{ marginBottom: 12 }}><Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso></div>}

      {doAno.length === 0 ? (
        <div className="tv-card" style={{ padding: 18, display: "flex", gap: 10, alignItems: "center", color: C.inkSoft, fontSize: 13.5 }}>
          <CalendarOff size={18} /> Nenhum dia sem aula cadastrado em {ano}.
        </div>
      ) : (
        <div className="tv-card" style={{ overflow: "hidden" }}>
          {doAno.map((d, i) => {
            const travado = !podeAlterarConfiguracao(eu.papel, d.definido_por_nivel);
            return (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: i ? `1px solid ${C.border}` : "none", fontSize: 13.5 }}>
                <span style={{ width: 110, textTransform: "capitalize", color: d.data < hojeISO() ? C.inkSoft : C.ink }}>{dataCurta(d.data)}</span>
                <span style={{ flex: 1 }}>
                  {d.descricao}
                  <span style={{ color: C.inkSoft, fontSize: 12.5 }}> · {etapaNome(d.etapa_id) ?? "escola toda"}</span>
                </span>
                {travado ? (
                  <span title="Cadastrado pela Direção" style={{ color: C.inkSoft }}><Lock size={13} /></span>
                ) : (
                  <button className="tv-btn-text-danger" aria-label={`Remover ${d.descricao}`} onClick={() => setRemovendo(d)} style={{ display: "inline-flex", alignItems: "center" }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {novo && <NovoDiaModal onFechar={() => setNovo(false)} aoSalvar={recarregar} />}
      {removendo && (
        <ConfirmarAcao
          titulo="Remover dia sem aula"
          mensagem={<>Remover <strong>{removendo.descricao}</strong> ({dataCurta(removendo.data)}) do calendário? O planejamento desse dia volta a ser exigido.</>}
          rotuloConfirmar="Remover"
          perigo
          onCancelar={() => setRemovendo(null)}
          onConfirmar={async () => {
            verificar(await supabase.rpc("remover_dia_sem_aula", { p_id: removendo.id }));
            await recarregar();
            setRemovendo(null);
          }}
        />
      )}
    </section>
  );
}

function NovoDiaModal({ onFechar, aoSalvar }: { onFechar: () => void; aoSalvar: () => Promise<unknown> }) {
  const etapas = useEtapas();
  const [data, setData] = useState(hojeISO());
  const [descricao, setDescricao] = useState("");
  const [etapa, setEtapa] = useState<number | "">("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar() {
    setEnviando(true);
    setErro(null);
    try {
      verificar(await supabase.rpc("salvar_dia_sem_aula", { p_id: null as never, p_data: data, p_descricao: descricao, p_etapa: etapa === "" ? (null as never) : etapa }));
      await aoSalvar();
      onFechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo="Novo dia sem aula"
      onFechar={onFechar}
      rodape={
        <>
          <button className="tv-btn tv-btn-secondary" onClick={onFechar} disabled={enviando}>Cancelar</button>
          <button className="tv-btn tv-btn-primary" onClick={salvar} disabled={enviando || !data || !descricao.trim()}>{enviando ? "Salvando…" : "Salvar"}</button>
        </>
      }
    >
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Data</span>
        <input type="date" className="tv-input" style={{ marginTop: 6 }} value={data} onChange={(e) => setData(e.target.value)} />
      </label>
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Motivo</span>
        <input className="tv-input" style={{ marginTop: 6 }} placeholder="Ex.: Aniversário da cidade, Recesso, Formação" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </label>
      <label style={{ display: "block", marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Vale para</span>
        <select className="tv-input" style={{ marginTop: 6 }} value={etapa} onChange={(e) => setEtapa(e.target.value === "" ? "" : Number(e.target.value))}>
          <option value="">A escola toda</option>
          {etapas.data?.map((e) => <option key={e.id} value={e.id}>Só {e.nome}</option>)}
        </select>
      </label>
      {erro && <div style={{ marginTop: 10 }}><Aviso>{erro}</Aviso></div>}
    </Modal>
  );
}
