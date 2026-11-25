import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Send } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Carregando } from "@/components/TelaCarregando";
import { formatarData } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";

const OPCOES_DIAS = [7, 5, 3, 2, 1, 0];
const STATUS: Record<string, { rotulo: string; cor: string }> = {
  pendente: { rotulo: "Na fila", cor: "#8A6512" },
  enviado: { rotulo: "Enviado", cor: "#3F6136" },
  simulado: { rotulo: "Simulado", cor: "#54615C" },
  erro: { rotulo: "Erro", cor: "#B24C3B" },
};

/** Lembretes ao professor e alerta à Coordenação (§8.2, §8.4): configuração e histórico. */
export function EmailsAutomaticos() {
  const qc = useQueryClient();
  const config = useQuery({
    queryKey: ["config-notificacoes"],
    queryFn: async () => verificar(await supabase.from("config_notificacoes").select("*").single()),
  });
  const historico = useQuery({
    queryKey: ["emails"],
    queryFn: async () =>
      verificar(await supabase.from("emails").select("id, tipo, nome, email, assunto, status, erro, criado_em, enviado_em").order("id", { ascending: false }).limit(50)),
  });
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro" | "info"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(mudancas: { ativos?: boolean; dias?: number[]; alerta?: boolean }) {
    const c = config.data!;
    setMensagem(null);
    try {
      verificar(
        await supabase.rpc("salvar_config_notificacoes", {
          p_ativos: mudancas.ativos ?? c.emails_ativos,
          p_dias: mudancas.dias ?? c.lembrete_dias,
          p_alerta: mudancas.alerta ?? c.alerta_coordenacao,
        }),
      );
      await qc.invalidateQueries({ queryKey: ["config-notificacoes"] });
    } catch (e) {
      setMensagem({ tipo: "erro", texto: mensagemDeErro(e) });
    }
  }

  async function enviarAgora() {
    setEnviando(true);
    setMensagem(null);
    try {
      const { data, error } = await supabase.functions.invoke<{ preparados: number; enviados: number; simulados: number; erros: number; provedor: string }>(
        "rotina-diaria",
        { body: {} },
      );
      if (error) throw error;
      const r = data!;
      setMensagem({
        tipo: r.erros ? "erro" : "sucesso",
        texto:
          r.preparados + r.enviados + r.simulados + r.erros === 0
            ? "Nada a enviar hoje: nenhum lembrete ou alerta pendente."
            : `${r.preparados} novos na fila · ${r.enviados} enviados${r.simulados ? ` · ${r.simulados} simulados (serviço de e-mail não configurado)` : ""}${r.erros ? ` · ${r.erros} com erro` : ""}.`,
      });
      await qc.invalidateQueries({ queryKey: ["emails"] });
      await qc.invalidateQueries({ queryKey: ["notificacoes"] });
    } catch (e) {
      setMensagem({ tipo: "erro", texto: mensagemDeErro(e) });
    } finally {
      setEnviando(false);
    }
  }

  if (config.error) return <Aviso>{mensagemDeErro(config.error)}</Aviso>;
  if (!config.data) return <Carregando />;
  const c = config.data;

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <h2 style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 15, fontWeight: 600, margin: 0 }}>
          <Mail size={16} color={C.goldDeep} /> E-mails automáticos
        </h2>
        <button className="tv-btn tv-btn-secondary" onClick={enviarAgora} disabled={enviando || !c.emails_ativos} title="Normalmente roda sozinho todo dia às 7h.">
          <Send size={14} /> {enviando ? "Enviando…" : "Enviar agora"}
        </button>
      </div>
      <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 12px", maxWidth: 680, lineHeight: 1.5 }}>
        Todo dia às 7h o sistema envia lembretes aos professores que ainda não entregaram e, no dia seguinte ao prazo,
        avisa a Coordenação da etapa: <em>"TURMA [X] DE PROFESSOR [Y] – PLANEJAMENTO NÃO IDENTIFICADO"</em>. Cada e-mail
        também aparece nas Notificações de quem recebe.
      </p>

      <div className="tv-card" style={{ padding: 14, display: "grid", gap: 12, marginBottom: 12 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, fontWeight: 600 }}>
          <input type="checkbox" checked={c.emails_ativos} onChange={(e) => void salvar({ ativos: e.target.checked })} />
          Enviar e-mails automáticos
        </label>
        <div style={{ opacity: c.emails_ativos ? 1 : 0.5 }}>
          <p style={{ fontSize: 13, margin: "0 0 6px" }}>Lembrete ao professor:</p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {OPCOES_DIAS.map((d) => (
              <label key={d} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                <input
                  type="checkbox"
                  disabled={!c.emails_ativos}
                  checked={c.lembrete_dias.includes(d)}
                  onChange={(e) => void salvar({ dias: e.target.checked ? [...c.lembrete_dias, d] : c.lembrete_dias.filter((x) => x !== d) })}
                />
                {d === 0 ? "no dia do prazo" : `${d} ${d === 1 ? "dia" : "dias"} antes`}
              </label>
            ))}
          </div>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, opacity: c.emails_ativos ? 1 : 0.5 }}>
          <input type="checkbox" disabled={!c.emails_ativos} checked={c.alerta_coordenacao} onChange={(e) => void salvar({ alerta: e.target.checked })} />
          Avisar a Coordenação da etapa no dia seguinte ao prazo quando o planejamento não for entregue
        </label>
      </div>

      {mensagem && <div style={{ marginBottom: 12 }}><Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso></div>}

      <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>Últimos e-mails</p>
      {historico.data && historico.data.length === 0 && <p style={{ fontSize: 13, color: C.inkSoft }}>Nenhum e-mail enviado ainda.</p>}
      {historico.data && historico.data.length > 0 && (
        <div className="tv-card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#F4F1E6", textAlign: "left" }}>
                {["Quando", "Para", "Assunto", "Situação"].map((h) => (
                  <th key={h} style={{ padding: "9px 12px", fontWeight: 600, color: C.inkSoft }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historico.data.map((e) => (
                <tr key={e.id} style={{ borderTop: `1px solid ${C.border}`, verticalAlign: "top" }}>
                  <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: C.inkSoft }}>{formatarData(e.enviado_em ?? e.criado_em, true)}</td>
                  <td style={{ padding: "9px 12px" }}>{e.nome}<br /><span style={{ color: C.inkSoft }}>{e.email}</span></td>
                  <td style={{ padding: "9px 12px" }}>{e.assunto}</td>
                  <td style={{ padding: "9px 12px", color: STATUS[e.status]?.cor, fontWeight: 600 }} title={e.erro ?? undefined}>
                    {STATUS[e.status]?.rotulo ?? e.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
