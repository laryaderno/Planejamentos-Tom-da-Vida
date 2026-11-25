import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { Carregando } from "@/components/TelaCarregando";
import { etapasDoUsuario, useCatalogo, usePerfis, useRecarregar, useVinculos, type Perfil } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { NIVEL, podeGerenciarUsuario, ROTULO_PAPEL } from "@/lib/papeis";
import { supabase } from "@/lib/supabase";
import { useUsuario } from "@/features/auth/AuthContext";
import { C } from "@/styles/tokens";
import { BotoesUsuario } from "./acoes";
import { EditarVinculosModal } from "./EditarVinculosModal";
import { RedefinirSenhaModal } from "./RedefinirSenhaModal";

/** Gestão de Coordenadores, Secretaria, Diretores e Administradores. */
export function EquipePage() {
  const eu = useUsuario();
  const perfis = usePerfis();
  const vinculos = useVinculos();
  const { catalogo, erro: erroCatalogo } = useCatalogo();
  const recarregar = useRecarregar();
  const [editando, setEditando] = useState<Perfil | null>(null);
  const [removendo, setRemovendo] = useState<Perfil | null>(null);
  const [senha, setSenha] = useState<Perfil | null>(null);

  const erro = perfis.error ?? vinculos.error ?? erroCatalogo;
  if (erro) return <Aviso>{mensagemDeErro(erro)}</Aviso>;
  if (!perfis.data || !vinculos.data || !catalogo) return <Carregando />;

  const todosVinculos = vinculos.data;
  const equipe = perfis.data
    .filter((p) => p.status === "ativo" && p.papel !== "professor")
    .sort((a, b) => NIVEL[b.papel] - NIVEL[a.papel] || a.nome.localeCompare(b.nome));
  const etapasTexto = (id: string) =>
    etapasDoUsuario(todosVinculos, id)
      .map((e) => catalogo.etapas.find((x) => x.id === e)?.nome)
      .filter(Boolean)
      .join(", ");

  return (
    <div>
      <div className="tv-card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: "#F4F1E6", textAlign: "left" }}>
              {["Nome", "Papel", "Escopo", "E-mail", ""].map((h) => (
                <th key={h} style={{ padding: "12px 18px", fontWeight: 600, color: C.inkSoft, fontSize: 12.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {equipe.map((p) => {
              const gerencia = podeGerenciarUsuario(eu, p, etapasDoUsuario(todosVinculos, p.id));
              return (
                <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "12px 18px", color: C.ink, fontWeight: 500 }}>
                    {p.nome}
                    {p.id === eu.id && <span style={{ color: C.inkSoft, fontWeight: 400 }}> (você)</span>}
                  </td>
                  <td style={{ padding: "12px 18px", color: C.inkSoft }}>{ROTULO_PAPEL[p.papel]}</td>
                  <td style={{ padding: "12px 18px", color: C.inkSoft }}>
                    {p.papel === "coordenador" ? etapasTexto(p.id) || "—" : "Toda a escola"}
                  </td>
                  <td style={{ padding: "12px 18px", color: C.inkSoft }}>{p.email}</td>
                  <td style={{ padding: "12px 18px", textAlign: "right" }}>
                    <BotoesUsuario
                      onEditar={gerencia && p.papel === "coordenador" ? () => setEditando(p) : undefined}
                      onSenha={eu.papel === "administrador" && p.id !== eu.id ? () => setSenha(p) : undefined}
                      onRemover={gerencia ? () => setRemovendo(p) : undefined}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editando && (
        <EditarVinculosModal
          perfil={editando}
          vinculosAtuais={todosVinculos.filter((v) => v.usuario_id === editando.id)}
          catalogo={catalogo}
          onFechar={() => setEditando(null)}
        />
      )}
      {senha && <RedefinirSenhaModal perfil={senha} onFechar={() => setSenha(null)} />}
      {removendo && (
        <ConfirmarAcao
          titulo={`Remover ${ROTULO_PAPEL[removendo.papel]}`}
          mensagem={
            <>
              Você está prestes a remover o acesso de <strong>{removendo.nome}</strong> ({ROTULO_PAPEL[removendo.papel]}
              {removendo.papel === "coordenador" && etapasTexto(removendo.id) ? ` — ${etapasTexto(removendo.id)}` : ""}). A
              pessoa não conseguirá mais entrar no sistema.
            </>
          }
          irreversivel="Esta ação não pode ser desfeita automaticamente; para voltar, a pessoa precisa se cadastrar de novo."
          rotuloConfirmar="Remover acesso"
          perigo
          onCancelar={() => setRemovendo(null)}
          onConfirmar={async () => {
            verificar(await supabase.rpc("remover_usuario", { p_usuario: removendo.id }));
            await recarregar();
            setRemovendo(null);
          }}
        />
      )}
    </div>
  );
}
