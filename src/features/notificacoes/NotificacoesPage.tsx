import { useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarCheck } from "lucide-react";
import { useNavigate } from "react-router";
import { Aviso } from "@/components/Aviso";
import { EmptyState } from "@/components/EmptyState";
import { Carregando } from "@/components/TelaCarregando";
import { useUsuario } from "@/features/auth/AuthContext";
import { AtividadesParaAprovar, usePendentesParaAprovar } from "@/features/atividades/AtividadesParaAprovar";
import { SolicitacoesPage } from "@/features/usuarios/SolicitacoesPage";
import { formatarData } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";
import { useEntregasPorId, useNotificacoes, useSolicitacoesPendentes, type Notificacao } from "./api";
import { SituacaoChip } from "./SituacaoChip";

/** Sininho: entregas de planejamento e cadastros aguardando aprovação. */
export function NotificacoesPage() {
  const eu = useUsuario();
  const notificacoes = useNotificacoes();
  const pendentes = useSolicitacoesPendentes();
  const atividadesPendentes = usePendentesParaAprovar();
  const entregas = useEntregasPorId();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const gestor = eu.papel !== "professor";

  async function marcarLidas(ids?: number[]) {
    verificar(await supabase.rpc("marcar_notificacoes_lidas", ids ? { p_ids: ids } : {}));
    await qc.invalidateQueries({ queryKey: ["notificacoes"] });
  }

  async function abrir(n: Notificacao) {
    if (!n.lida_em) await marcarLidas([n.id]);
    if (n.link) navigate(n.link);
  }

  const lista = notificacoes.data ?? [];
  const naoLidas = lista.filter((n) => !n.lida_em).length;

  return (
    <div style={{ display: "grid", gap: 28 }}>
      {gestor && (
        <section>
          <h2 style={titulo}>
            Solicitações de cadastro {pendentes.length > 0 && <Contador n={pendentes.length} />}
          </h2>
          <SolicitacoesPage compacto />
        </section>
      )}

      {gestor && (
        <section>
          <h2 style={titulo}>
            Atividades para aprovar {atividadesPendentes.length > 0 && <Contador n={atividadesPendentes.length} />}
          </h2>
          <AtividadesParaAprovar />
        </section>
      )}

      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <h2 style={{ ...titulo, margin: 0 }}>
            Avisos {naoLidas > 0 && <Contador n={naoLidas} />}
          </h2>
          {naoLidas > 0 && (
            <button className="tv-btn-text" onClick={() => void marcarLidas()}>Marcar todas como lidas</button>
          )}
        </div>

        {notificacoes.error && <Aviso>{mensagemDeErro(notificacoes.error)}</Aviso>}
        {!notificacoes.data && !notificacoes.error && <Carregando />}
        {notificacoes.data && lista.length === 0 && (
          <EmptyState
            icon={eu.papel === "professor" ? CalendarCheck : Bell}
            title="Nenhum aviso."
            description={
              eu.papel === "professor"
                ? "Aqui aparecem a confirmação das suas entregas, a aprovação ou o pedido de revisão dos seus planejamentos, as novas notas e o resultado das atividades que você enviou para o banco."
                : "Aqui aparecem as entregas de planejamento dos professores, com a situação em relação ao prazo, e as novas atividades enviadas para aprovação."
            }
          />
        )}
        {lista.length > 0 && (
          <div className="tv-card" style={{ overflow: "hidden" }}>
            {lista.map((n, i) => {
              const situacao = n.entrega_id ? entregas.get(n.entrega_id)?.situacao : undefined;
              return (
                <button
                  key={n.id}
                  onClick={() => void abrir(n)}
                  style={{
                    display: "flex", gap: 12, alignItems: "flex-start", width: "100%", textAlign: "left", cursor: "pointer",
                    padding: "13px 16px", border: "none", borderTop: i === 0 ? "none" : `1px solid ${C.border}`,
                    background: n.lida_em ? "transparent" : "#F0F6F2",
                  }}
                >
                  <span
                    aria-label={n.lida_em ? "Lida" : "Não lida"}
                    style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 6, flexShrink: 0, background: n.lida_em ? "transparent" : C.primary }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: n.lida_em ? 500 : 700, color: C.ink }}>{n.titulo}</span>
                      {situacao && <SituacaoChip situacao={situacao} />}
                    </span>
                    <span style={{ display: "block", fontSize: 13, color: C.inkSoft, lineHeight: 1.5 }}>{n.mensagem}</span>
                    <span style={{ display: "block", fontSize: 12, color: C.inkSoft, marginTop: 3 }}>{formatarData(n.criada_em, true)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Contador({ n }: { n: number }) {
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: C.red, padding: "1px 7px", borderRadius: 999, marginLeft: 6, verticalAlign: "middle" }}>
      {n}
    </span>
  );
}

const titulo = { fontSize: 15, fontWeight: 600, color: C.ink, margin: "0 0 12px" } as const;
