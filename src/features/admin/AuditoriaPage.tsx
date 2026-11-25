import { ScrollText } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { EmptyState } from "@/components/EmptyState";
import { Carregando } from "@/components/TelaCarregando";
import { formatarData, useAuditoria, useCatalogo, usePerfis, type RegistroAuditoria } from "@/lib/consultas";
import { descrever, type Catalogo } from "@/features/usuarios/vinculos";
import { mensagemDeErro } from "@/lib/erros";
import { C } from "@/styles/tokens";

const ROTULO_TABELA: Record<string, string> = { perfis: "Usuários", turmas: "Turmas", vinculos: "Permissões" };
const ROTULO_ACAO: Record<string, string> = { INSERT: "Criou", UPDATE: "Alterou", DELETE: "Apagou" };
const CAMPOS_TECNICOS = new Set(["definido_por_id", "definido_por_nivel", "definido_em", "aprovado_em", "removido_em"]);

type Objeto = Record<string, unknown>;

const CAMPOS_PESSOA = new Set(["aprovado_por", "removido_por", "usuario_id"]);

/** Descrição legível do registro, ex.: "status: pendente → ativo". */
function detalhes(r: RegistroAuditoria, nome: (id: string) => string, catalogo: Catalogo | null): string {
  const antes = (r.antes ?? {}) as Objeto;
  const depois = (r.depois ?? {}) as Objeto;
  const obj = r.acao === "DELETE" ? antes : depois;
  const valor = (k: string, v: unknown) => (v == null ? "—" : CAMPOS_PESSOA.has(k) ? nome(String(v)) : String(v));

  if (r.tabela === "vinculos") {
    const quem = nome(String(obj.usuario_id));
    const oque = catalogo
      ? descrever({ etapa_id: Number(obj.etapa_id), turma_id: obj.turma_id as number | null, disciplina_id: obj.disciplina_id as number | null, regente: Boolean(obj.regente) }, catalogo)
      : "";
    if (r.acao === "UPDATE" && antes.ativo && !depois.ativo) return `${quem}: retirado ${oque}`;
    return `${quem}: ${oque}`;
  }
  if (r.acao !== "UPDATE") return String(obj.nome ?? obj.email ?? "");
  return Object.keys(depois)
    .filter((k) => !CAMPOS_TECNICOS.has(k) && JSON.stringify(antes[k]) !== JSON.stringify(depois[k]))
    .map((k) => `${k}: ${valor(k, antes[k])} → ${valor(k, depois[k])}`)
    .join(" · ");
}

/** Log de auditoria geral (§5.1, §11) — somente Administrador. */
export function AuditoriaPage() {
  const log = useAuditoria(300);
  const perfis = usePerfis();
  const { catalogo } = useCatalogo();
  const [tabela, setTabela] = useState("");

  if (log.error) return <Aviso>{mensagemDeErro(log.error)}</Aviso>;
  if (!log.data) return <Carregando />;

  const nomeDe = (id: string) => perfis.data?.find((p) => p.id === id)?.nome ?? "usuário";
  const nome = (id: string | null) => (id ? nomeDe(id) : "Sistema");
  const registros = log.data.filter((r) => !tabela || r.tabela === tabela);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <label style={{ fontSize: 13, color: C.inkSoft }} htmlFor="filtro-tabela">Mostrar</label>
        <select id="filtro-tabela" className="tv-input" style={{ width: "auto" }} value={tabela} onChange={(e) => setTabela(e.target.value)}>
          <option value="">Tudo</option>
          {Object.entries(ROTULO_TABELA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span style={{ fontSize: 12.5, color: C.inkSoft }}>Últimos {log.data.length} registros</span>
      </div>

      {registros.length === 0 ? (
        <EmptyState icon={ScrollText} title="Nenhum registro." description="Toda criação, alteração e remoção de usuários, turmas e permissões aparece aqui." />
      ) : (
        <div className="tv-card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F9FAFB", textAlign: "left" }}>
                {["Quando", "Quem", "O quê", "Detalhes"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontWeight: 600, color: C.inkSoft, fontSize: 12.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${C.border}`, verticalAlign: "top" }}>
                  <td style={{ padding: "10px 14px", color: C.inkSoft, whiteSpace: "nowrap" }}>{formatarData(r.em, true)}</td>
                  <td style={{ padding: "10px 14px", color: C.ink }}>{nome(r.ator_id)}</td>
                  <td style={{ padding: "10px 14px", color: C.ink, whiteSpace: "nowrap" }}>
                    {ROTULO_ACAO[r.acao] ?? r.acao} · {ROTULO_TABELA[r.tabela] ?? r.tabela}
                  </td>
                  <td style={{ padding: "10px 14px", color: C.inkSoft, wordBreak: "break-word" }}>{detalhes(r, nomeDe, catalogo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
