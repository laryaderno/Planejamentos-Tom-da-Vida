import { useState } from "react";
import { Modal } from "@/components/Modal";
import { periodoValeParaTurma, usePeriodos } from "@/features/notificacoes/api";
import { dataCurta, somarDias } from "@/features/planejamentos/dominio";
import type { Turma } from "@/lib/consultas";
import { C } from "@/styles/tokens";
import { BotoesExportar } from "./BotoesExportar";
import { carregarPlanejamento } from "./carregar";
import { montarPlanejamento } from "./planejamento";

/** Exportar o planejamento da turma num período (PDF e Word, no formato dos modelos). */
export function ExportarPlanejamentoModal({ turma, semana, onFechar }: { turma: Turma; semana: string; onFechar: () => void }) {
  const periodos = usePeriodos();
  const fimSemana = somarDias(semana, 4);
  const periodo = periodos.data?.find(
    (p) => p.inicio <= fimSemana && p.fim >= semana && periodoValeParaTurma(p, turma),
  );

  const opcoes = [
    { id: "semana", rotulo: `Esta semana (${dataCurta(semana)} – ${dataCurta(fimSemana)})`, inicio: semana, fim: fimSemana },
    ...(periodo && (periodo.inicio !== semana || periodo.fim !== fimSemana)
      ? [{ id: "periodo", rotulo: `Período de entrega (${dataCurta(periodo.inicio)} – ${dataCurta(periodo.fim)})`, inicio: periodo.inicio, fim: periodo.fim }]
      : []),
  ];
  const [escolha, setEscolha] = useState<string>(periodo ? "periodo" : "semana");
  const [inicio, setInicio] = useState(semana);
  const [fim, setFim] = useState(fimSemana);

  const selecionada = opcoes.find((o) => o.id === escolha);
  const intervalo = selecionada ? { inicio: selecionada.inicio, fim: selecionada.fim } : { inicio, fim };
  const valido = intervalo.inicio && intervalo.fim && intervalo.fim >= intervalo.inicio;

  return (
    <Modal titulo={`Exportar planejamento — ${turma.nome}`} subtitulo="No formato dos modelos da escola: uma tabela por dia, com a rotina da grade." onFechar={onFechar}>
      <div role="radiogroup" style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        {[...opcoes, { id: "outro", rotulo: "Outras datas" }].map((o) => (
          <label key={o.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, textTransform: "none" }}>
            <input type="radio" name="periodo-exportar" checked={escolha === o.id} onChange={() => setEscolha(o.id)} />
            <span style={{ textTransform: o.id === "outro" ? "none" : undefined }}>{o.rotulo}</span>
          </label>
        ))}
        {escolha === "outro" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 22 }}>
            <input type="date" className="tv-input" style={{ width: "auto" }} value={inicio} onChange={(e) => setInicio(e.target.value)} aria-label="De" />
            <span style={{ color: C.inkSoft }}>a</span>
            <input type="date" className="tv-input" style={{ width: "auto" }} value={fim} onChange={(e) => setFim(e.target.value)} aria-label="Até" />
          </div>
        )}
      </div>
      <BotoesExportar desabilitado={!valido} montar={async () => montarPlanejamento(await carregarPlanejamento(turma.id, intervalo.inicio, intervalo.fim))} />
    </Modal>
  );
}
