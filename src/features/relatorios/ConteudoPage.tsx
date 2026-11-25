import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { EmptyState } from "@/components/EmptyState";
import { Carregando } from "@/components/TelaCarregando";
import { BotoesExportar } from "@/features/exportacao/BotoesExportar";
import { dataModelo } from "@/features/exportacao/planejamento";
import { montarConteudo } from "@/features/exportacao/relatorios";
import { INTELIGENCIAS, hojeISO } from "@/features/planejamentos/dominio";
import { useMinhasTurmas } from "@/features/planejamentos/PlanejamentosPage";
import { useEtapas } from "@/lib/consultas";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";

type Modo = "mensal" | "bimestral" | "datas";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function ultimoDia(ano: number, mes: number): string {
  const d = new Date(ano, mes, 0).getDate(); // mes 1-12
  return `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Intervalo e rótulo do período escolhido. Bimestral = o mês escolhido e o seguinte. */
export function intervaloDoPeriodo(modo: Modo, mesAno: string, inicio: string, fim: string) {
  if (modo === "datas") return { inicio, fim, rotulo: "Período personalizado" };
  const [a, m] = mesAno.split("-").map(Number) as [number, number];
  if (modo === "mensal") {
    const nome = MESES[m - 1]!;
    return { inicio: `${mesAno}-01`, fim: ultimoDia(a, m), rotulo: `${nome[0]!.toUpperCase()}${nome.slice(1)} de ${a}` };
  }
  const m2 = m === 12 ? 1 : m + 1;
  const a2 = m === 12 ? a + 1 : a;
  return { inicio: `${mesAno}-01`, fim: ultimoDia(a2, m2), rotulo: `Bimestre: ${MESES[m - 1]} e ${MESES[m2 - 1]} de ${a2}` };
}

/** Conteúdo programático da turma (§6.1): Conteúdo e Objetivos de todos os planejamentos do período. */
export function ConteudoPage() {
  const { turmas, erro } = useMinhasTurmas();
  const etapas = useEtapas();
  const [turmaId, setTurmaId] = useState<number | null>(null);
  const [modo, setModo] = useState<Modo>("mensal");
  const [mesAno, setMesAno] = useState(hojeISO().slice(0, 7));
  const [inicio, setInicio] = useState(`${hojeISO().slice(0, 7)}-01`);
  const [fim, setFim] = useState(hojeISO());

  const turma = turmas?.find((t) => t.id === (turmaId ?? turmas[0]?.id)) ?? null;
  const periodo = intervaloDoPeriodo(modo, mesAno, inicio, fim);
  const itens = useQuery({
    queryKey: ["conteudo-programatico", turma?.id, periodo.inicio, periodo.fim],
    enabled: !!turma && periodo.fim >= periodo.inicio,
    queryFn: async () =>
      verificar(await supabase.rpc("conteudo_programatico", { p_turma: turma!.id, p_inicio: periodo.inicio, p_fim: periodo.fim })),
  });

  if (erro) return <Aviso>{mensagemDeErro(erro)}</Aviso>;
  if (!turmas) return <Carregando />;
  if (!turma) return <EmptyState icon={BookOpen} title="Nenhuma turma no seu escopo." description="" />;

  const etapaNome = etapas.data?.find((e) => e.id === turma.etapa_id)?.nome ?? "";
  const lista = itens.data ?? [];
  const disciplinas = [...new Set(lista.map((i) => i.disciplina))].sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <div className="tv-card" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <select className="tv-input" style={{ width: "auto", minWidth: 180 }} value={turma.id} onChange={(e) => setTurmaId(Number(e.target.value))} aria-label="Turma">
          {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <div role="radiogroup" aria-label="Período" style={{ display: "flex", gap: 4 }}>
          {([["mensal", "Mensal"], ["bimestral", "Bimestral"], ["datas", "Outras datas"]] as const).map(([id, rotulo]) => (
            <button
              key={id}
              role="radio"
              aria-checked={modo === id}
              onClick={() => setModo(id)}
              style={{
                fontSize: 12.5, fontWeight: 600, padding: "6px 11px", borderRadius: 999, cursor: "pointer",
                background: modo === id ? C.primary : "transparent", color: modo === id ? "#fff" : C.inkSoft,
                border: `1px solid ${modo === id ? C.primary : C.border}`,
              }}
            >
              {rotulo}
            </button>
          ))}
        </div>
        {modo !== "datas" ? (
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            {modo === "mensal" ? "Mês" : "A partir de"}
            <input type="month" className="tv-input" style={{ width: "auto" }} value={mesAno} onChange={(e) => e.target.value && setMesAno(e.target.value)} />
          </label>
        ) : (
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="date" className="tv-input" style={{ width: "auto" }} value={inicio} onChange={(e) => setInicio(e.target.value)} aria-label="De" />
            <span style={{ color: C.inkSoft }}>a</span>
            <input type="date" className="tv-input" style={{ width: "auto" }} value={fim} onChange={(e) => setFim(e.target.value)} aria-label="Até" />
          </span>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <p style={{ fontSize: 13.5, margin: 0 }}>
          <strong>{periodo.rotulo}</strong>
          <span style={{ color: C.inkSoft }}> · {dataModelo(periodo.inicio)} a {dataModelo(periodo.fim)} · {lista.length} {lista.length === 1 ? "registro" : "registros"}</span>
        </p>
        <BotoesExportar
          desabilitado={!itens.data}
          montar={async () =>
            montarConteudo({
              turma: turma.nome, etapa: etapaNome, rotuloPeriodo: periodo.rotulo, inicio: periodo.inicio, fim: periodo.fim,
              itens: lista, geradoEm: new Date(),
            })
          }
        />
      </div>

      {itens.error && <Aviso>{mensagemDeErro(itens.error)}</Aviso>}
      {itens.isLoading && <Carregando />}
      {itens.data && lista.length === 0 && (
        <EmptyState icon={BookOpen} title="Nenhum conteúdo registrado neste período." description="O conteúdo programático reúne o Conteúdo e os Objetivos de todos os planejamentos da turma no período escolhido." />
      )}
      {disciplinas.map((disc) => (
        <section key={disc} className="tv-card" style={{ padding: 16, marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 10px" }}>{disc}</h2>
          {lista.filter((i) => i.disciplina === disc).map((i, n) => (
            <div key={n} style={{ display: "grid", gridTemplateColumns: "90px 1fr 1.2fr", gap: 12, padding: "8px 0", borderTop: n ? `1px solid ${C.border}` : "none", fontSize: 13 }}>
              <span style={{ color: C.inkSoft }}>{dataModelo(i.data)}</span>
              <span style={{ whiteSpace: "pre-wrap" }}>{i.conteudo || "—"}</span>
              <span style={{ whiteSpace: "pre-wrap", color: C.inkSoft }}>
                {i.habilidades.length > 0 && <span style={{ color: C.primaryDeep }}>{i.habilidades.map((h) => INTELIGENCIAS[h]).join(" · ")}{i.objetivos ? "\n" : ""}</span>}
                {i.objetivos}
              </span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
