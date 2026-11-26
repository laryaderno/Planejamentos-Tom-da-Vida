import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useUsuario } from "@/features/auth/AuthContext";
import { periodoValeParaTurma, useEntregas, usePeriodos, type Entrega, type Periodo } from "@/features/notificacoes/api";
import { useTurmas, useVinculos, type Turma } from "@/lib/consultas";
import { verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";
import { deISO, hojeISO, somarDias } from "./dominio";

const curta = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const diasEntre = (de: string, ate: string) => Math.round((deISO(ate).getTime() - deISO(de).getTime()) / 86_400_000);

/** Faixa vermelha de aviso (prazo próximo ou atrasado). */
export function FaixaAviso({ titulo, detalhe, selo, acao }: { titulo: string; detalhe: ReactNode; selo?: string; acao?: ReactNode }) {
  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", marginBottom: 16, borderRadius: 10,
        background: "#FDECEC", border: "1px solid #F7C4C4", flexWrap: "wrap",
      }}
    >
      <AlertCircle size={20} color={C.red} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 200 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: C.red }}>{titulo}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#7F1D1D" }}>{detalhe}</p>
      </div>
      {selo && (
        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "#E5484D", padding: "4px 10px", borderRadius: 6, whiteSpace: "nowrap" }}>
          {selo}
        </span>
      )}
      {acao}
    </div>
  );
}

interface Pendencia {
  periodo: Periodo;
  turmas: string[];
}

/** Períodos em que o professor ainda não entregou alguma das suas turmas. */
export function pendenciasDoProfessor(
  turmas: Turma[],
  periodos: Periodo[],
  entregas: Entrega[],
  professorId: string,
): Pendencia[] {
  const lista: Pendencia[] = [];
  for (const p of periodos) {
    const faltando = turmas
      .filter((t) => periodoValeParaTurma(p, t))
      .filter((t) => !entregas.some((e) => e.periodo_id === p.id && e.professor_id === professorId && e.turma_id === t.id))
      .map((t) => t.nome);
    if (faltando.length) lista.push({ periodo: p, turmas: faltando });
  }
  return lista.sort((a, b) => a.periodo.prazo.localeCompare(b.periodo.prazo));
}

/** Professor: próximo prazo de entrega (ou o que já venceu sem entrega). */
export function AvisoPrazoProfessor() {
  const eu = useUsuario();
  const turmas = useTurmas();
  const vinculos = useVinculos();
  const periodos = usePeriodos();
  const entregas = useEntregas();
  if (eu.papel !== "professor" || !turmas.data || !vinculos.data || !periodos.data || !entregas.data) return null;

  const minhas = new Set(vinculos.data.filter((v) => v.usuario_id === eu.id).map((v) => v.turma_id));
  const pend = pendenciasDoProfessor(turmas.data.filter((t) => minhas.has(t.id)), periodos.data, entregas.data, eu.id);
  const hoje = hojeISO();
  const linha = (p: Pendencia) =>
    `${p.turmas.length > 1 ? "Turmas" : "Turma"}: ${p.turmas.join(", ")} • Período: ${curta(p.periodo.inicio)} a ${curta(p.periodo.fim)}`;

  // O que venceu nos últimos 30 dias sem entrega e o próximo prazo.
  const atrasado = pend.filter((p) => p.periodo.prazo < hoje && p.periodo.prazo >= somarDias(hoje, -30)).at(-1);
  const proximo = pend.find((p) => p.periodo.prazo >= hoje);
  if (!atrasado && !proximo) return null;
  const dAtraso = atrasado ? diasEntre(atrasado.periodo.prazo, hoje) : 0;
  const dProximo = proximo ? diasEntre(hoje, proximo.periodo.prazo) : 0;
  return (
    <>
      {atrasado && (
        <FaixaAviso titulo="Planejamento atrasado" detalhe={linha(atrasado)} selo={`Venceu há ${dAtraso} ${dAtraso === 1 ? "dia" : "dias"}`} />
      )}
      {proximo && (
        <FaixaAviso
          titulo="Próximo prazo de entrega"
          detalhe={linha(proximo)}
          selo={dProximo === 0 ? "Vence hoje" : `Falta${dProximo === 1 ? "" : "m"} ${dProximo} ${dProximo === 1 ? "dia" : "dias"}`}
        />
      )}
    </>
  );
}

/** Gestão: professores com planejamento não entregue após o prazo (últimos 30 dias). */
/** Relatório de entregas dos prazos que venceram nos últimos 30 dias (Visão geral). */
export function useEntregasUltimos30Dias() {
  const hoje = hojeISO();
  return useQuery({
    queryKey: ["relatorio-entregas", "30-dias", hoje],
    queryFn: async () => verificar(await supabase.rpc("relatorio_entregas", { p_inicio: somarDias(hoje, -30), p_fim: somarDias(hoje, -1) })),
  });
}

/** Atrasos já vistos por este usuário: professor → quantos estavam pendentes ao marcar como visto. */
function lerVistos(chave: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(chave) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function AvisoAtrasosGestao() {
  const eu = useUsuario();
  const atrasos = useEntregasUltimos30Dias();
  const chave = `tv-atrasos-vistos:${eu.id}`;
  const [vistos, setVistos] = useState(() => lerVistos(chave));
  const pendentes = (atrasos.data ?? []).filter((l) => l.nao_entregue > 0).sort((a, b) => b.nao_entregue - a.nao_entregue);
  // Some depois de "Marcar como visto"; volta só se aparecer atraso novo.
  const temNovo = pendentes.some((l) => l.nao_entregue > (vistos[l.professor_id] ?? 0));
  if (pendentes.length === 0 || !temNovo) return null;

  function marcarComoVisto() {
    const novo = Object.fromEntries(pendentes.map((l) => [l.professor_id, l.nao_entregue]));
    localStorage.setItem(chave, JSON.stringify(novo));
    setVistos(novo);
  }

  const total = pendentes.reduce((n, l) => n + l.nao_entregue, 0);
  const nomes = pendentes.slice(0, 3).map((l) => `${l.professor} (${l.nao_entregue})`).join(", ");
  return (
    <FaixaAviso
      titulo="Planejamentos atrasados!"
      detalhe={`${nomes}${pendentes.length > 3 ? ` e mais ${pendentes.length - 3}` : ""} — prazo vencido sem entrega nos últimos 30 dias.`}
      selo={`${total} ${total === 1 ? "pendente" : "pendentes"}`}
      acao={
        <span style={{ display: "inline-flex", gap: 8 }}>
          <Link to="/prazos" className="tv-btn tv-btn-secondary" style={{ padding: "5px 12px", fontSize: 12.5 }}>Ver prazos</Link>
          <button className="tv-btn tv-btn-secondary" style={{ padding: "5px 12px", fontSize: 12.5 }} onClick={marcarComoVisto}>
            <Check size={14} /> Marcar como visto
          </button>
        </span>
      }
    />
  );
}
