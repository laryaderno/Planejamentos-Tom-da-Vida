import { Bell, Check } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { EmptyState } from "@/components/EmptyState";
import { Carregando } from "@/components/TelaCarregando";
import { formatarData, useCatalogo, usePerfis, useRecarregar, type Perfil } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { podeAprovar, ROTULO_PAPEL } from "@/lib/papeis";
import { supabase } from "@/lib/supabase";
import { useUsuario } from "@/features/auth/AuthContext";
import { C } from "@/styles/tokens";
import { AprovarModal } from "./AprovarModal";

/** Lista de cadastros pendentes. `compacto`: usada dentro da página de Notificações. */
export function SolicitacoesPage({ compacto = false }: { compacto?: boolean }) {
  const eu = useUsuario();
  const perfis = usePerfis();
  const { catalogo, erro: erroCatalogo } = useCatalogo();
  const recarregar = useRecarregar();
  const [aprovando, setAprovando] = useState<Perfil | null>(null);
  const [recusando, setRecusando] = useState<Perfil | null>(null);

  if (perfis.error || erroCatalogo) return <Aviso>{mensagemDeErro(perfis.error ?? erroCatalogo)}</Aviso>;
  if (!perfis.data || !catalogo) return <Carregando />;

  const etapaNome = (id: number | null) => catalogo.etapas.find((e) => e.id === id)?.nome;
  // A RLS já filtra; aqui mostramos só o que este usuário pode decidir.
  const pendentes = perfis.data
    .filter((p) => p.status === "pendente")
    .filter((p) => eu.papel !== "coordenador" || podeAprovar(eu, p.papel, p.etapa_solicitada_id))
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em));

  if (pendentes.length === 0) {
    if (compacto) return <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>Nenhuma solicitação pendente.</p>;
    return (
      <EmptyState
        icon={Bell}
        title="Nenhuma solicitação pendente."
        description="Novos cadastros aparecem aqui, dentro do seu escopo, até serem aprovados ou recusados."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {pendentes.map((s) => {
        const pode = podeAprovar(eu, s.papel, s.etapa_solicitada_id);
        const dica = pode ? undefined : `Apenas um nível acima de ${ROTULO_PAPEL[s.papel]} pode decidir este pedido.`;
        return (
          <div key={s.id} className="tv-card" style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: "0 0 3px" }}>
                {s.nome}
                <span style={{ fontSize: 11.5, fontWeight: 600, color: C.primaryDeep, background: "#E6F0E9", padding: "2px 8px", borderRadius: 999, marginLeft: 8 }}>
                  {ROTULO_PAPEL[s.papel]}
                </span>
              </p>
              <p style={{ fontSize: 12.5, color: C.inkSoft, margin: 0 }}>
                {s.email}
                {etapaNome(s.etapa_solicitada_id) && <> · {etapaNome(s.etapa_solicitada_id)}</>} · solicitado em {formatarData(s.criado_em)}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="tv-btn tv-btn-secondary" onClick={() => setRecusando(s)} disabled={!pode} title={dica}>Recusar</button>
              <button className="tv-btn tv-btn-primary" onClick={() => setAprovando(s)} disabled={!pode} title={dica}>
                <Check size={14} /> Aprovar
              </button>
            </div>
          </div>
        );
      })}

      {aprovando && <AprovarModal perfil={aprovando} catalogo={catalogo} onFechar={() => setAprovando(null)} />}

      {recusando && (
        <ConfirmarAcao
          titulo="Recusar cadastro"
          mensagem={
            <>
              Você está prestes a recusar o pedido de acesso de <strong>{recusando.nome}</strong> ({recusando.email}) como{" "}
              {ROTULO_PAPEL[recusando.papel]}. A pessoa não conseguirá entrar no sistema.
            </>
          }
          irreversivel="Esta ação não pode ser desfeita automaticamente."
          rotuloConfirmar="Recusar"
          perigo
          onCancelar={() => setRecusando(null)}
          onConfirmar={async () => {
            verificar(await supabase.rpc("recusar_usuario", { p_usuario: recusando.id }));
            await recarregar();
            setRecusando(null);
          }}
        />
      )}
    </div>
  );
}
