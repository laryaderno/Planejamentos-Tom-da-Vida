import { Printer, Users } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { EmptyState } from "@/components/EmptyState";
import { Carregando } from "@/components/TelaCarregando";
import {
  etapasDoUsuario,
  paraEntrada,
  useCatalogo,
  usePerfis,
  useRecarregar,
  useVinculos,
  type Perfil,
} from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { podeGerenciarUsuario } from "@/lib/papeis";
import { supabase } from "@/lib/supabase";
import { useUsuario } from "@/features/auth/AuthContext";
import { RelatorioEntregasModal } from "@/features/exportacao/RelatorioEntregasModal";
import { C } from "@/styles/tokens";
import { BotoesUsuario } from "./acoes";
import { EditarVinculosModal } from "./EditarVinculosModal";
import { RedefinirSenhaModal } from "./RedefinirSenhaModal";
import { RemoverProfessorModal } from "./RemoverProfessorModal";
import { resumoTurmas } from "./vinculos";

/** Aba "Professores" (§9): nome e turmas, com gestão de permissões e remoção. */
export function ProfessoresPage() {
  const eu = useUsuario();
  const perfis = usePerfis();
  const vinculos = useVinculos();
  const { catalogo, erro: erroCatalogo } = useCatalogo();
  const recarregar = useRecarregar();
  const [editando, setEditando] = useState<Perfil | null>(null);
  const [removendo, setRemovendo] = useState<Perfil | null>(null);
  const [senha, setSenha] = useState<Perfil | null>(null);
  const [relatorio, setRelatorio] = useState(false);

  const erro = perfis.error ?? vinculos.error ?? erroCatalogo;
  if (erro) return <Aviso>{mensagemDeErro(erro)}</Aviso>;
  if (!perfis.data || !vinculos.data || !catalogo) return <Carregando />;

  const todosVinculos = vinculos.data;
  const professores = perfis.data.filter((p) => p.papel === "professor" && p.status === "ativo");
  const vinculosDe = (id: string) => todosVinculos.filter((v) => v.usuario_id === id);
  const turmasDe = (id: string) => resumoTurmas(vinculosDe(id).map(paraEntrada), catalogo);

  if (professores.length === 0) {
    return <EmptyState icon={Users} title="Nenhum professor ativo." description="Professores aprovados na aba Solicitações aparecem aqui." />;
  }

  return (
    <div>
      <div className="tv-card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: "#F4F1E6", textAlign: "left" }}>
              {["Nome", "Turmas e disciplinas", "E-mail", ""].map((h) => (
                <th key={h} style={{ padding: "12px 18px", fontWeight: 600, color: C.inkSoft, fontSize: 12.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {professores.map((p) => {
              const gerencia = podeGerenciarUsuario(eu, p, etapasDoUsuario(todosVinculos, p.id));
              return (
                <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "12px 18px", color: C.ink, fontWeight: 500 }}>{p.nome}</td>
                  <td style={{ padding: "12px 18px", color: C.inkSoft }}>{turmasDe(p.id) || "—"}</td>
                  <td style={{ padding: "12px 18px", color: C.inkSoft }}>{p.email}</td>
                  <td style={{ padding: "12px 18px", textAlign: "right" }}>
                    <BotoesUsuario
                      onEditar={gerencia ? () => setEditando(p) : undefined}
                      onSenha={eu.papel === "administrador" ? () => setSenha(p) : undefined}
                      onRemover={gerencia ? () => setRemovendo(p) : undefined}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* §9: "Imprimir Relatório" abaixo da lista de professores */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <button className="tv-btn tv-btn-primary" onClick={() => setRelatorio(true)}>
          <Printer size={15} /> Imprimir relatório de entregas
        </button>
      </div>
      {relatorio && <RelatorioEntregasModal onFechar={() => setRelatorio(false)} />}

      {editando && (
        <EditarVinculosModal perfil={editando} vinculosAtuais={vinculosDe(editando.id)} catalogo={catalogo} onFechar={() => setEditando(null)} />
      )}
      {senha && <RedefinirSenhaModal perfil={senha} onFechar={() => setSenha(null)} />}
      {removendo && (
        <RemoverProfessorModal
          nome={removendo.nome}
          turmas={turmasDe(removendo.id)}
          onCancel={() => setRemovendo(null)}
          onConfirm={async (destino) => {
            verificar(await supabase.rpc("remover_usuario", { p_usuario: removendo.id, p_destino: destino }));
            await recarregar();
            setRemovendo(null);
          }}
        />
      )}
    </div>
  );
}
