import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coffee, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Carregando } from "@/components/TelaCarregando";
import { useUsuario } from "@/features/auth/AuthContext";
import { hora } from "@/features/planejamentos/dominio";
import { usePerfis, useVinculos } from "@/lib/consultas";
import type { Tables } from "@/lib/database.types";
import { mensagemDeErro, verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";
import { DIAS_SEMANA } from "./api";

export type HorarioPL = Tables<"horarios_pl">;
type Linha = { dia_semana: number; hora_inicio: string; hora_fim: string };

/** Horários de PL: todos (gestão) ou só os do usuário (professor). */
export function useHorariosPL() {
  return useQuery({
    queryKey: ["horarios-pl"],
    queryFn: async () =>
      verificar(await supabase.from("horarios_pl").select("*").order("dia_semana").order("hora_inicio")),
  });
}

/** Lista curta: "Terça 13:00–14:40 · Quinta 07:30–09:10". */
export function resumoPL(horarios: Pick<HorarioPL, "dia_semana" | "hora_inicio" | "hora_fim">[]): string {
  return horarios.map((h) => `${DIAS_SEMANA[h.dia_semana - 1]} ${hora(h.hora_inicio)}–${hora(h.hora_fim)}`).join(" · ");
}

/** Etiqueta para entregas feitas fora do horário de PL do professor. */
export function EtiquetaForaDoPL() {
  return (
    <span
      title="Entregue fora do horário de planejamento (PL) do professor"
      style={{ fontSize: 11, fontWeight: 700, color: "#6D28D9", background: "#EDE9FE", padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}
    >
      Fora do PL
    </span>
  );
}

/** Gestão: cadastrar os horários de PL de cada professor. */
export function HorariosPLGestao() {
  const eu = useUsuario();
  const perfis = usePerfis();
  const vinculos = useVinculos();
  const pl = useHorariosPL();
  const qc = useQueryClient();
  const [professor, setProfessor] = useState<string>("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const professores = (perfis.data ?? [])
    .filter((p) => p.status === "ativo" && p.papel === "professor")
    .filter(
      (p) =>
        eu.papel !== "coordenador" ||
        (vinculos.data ?? []).some((v) => v.usuario_id === p.id && eu.etapasCoordenadas.includes(v.etapa_id)),
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  if (perfis.error || pl.error) return <Aviso>{mensagemDeErro(perfis.error ?? pl.error)}</Aviso>;
  if (!perfis.data || !pl.data) return <Carregando />;

  async function salvar() {
    setSalvando(true);
    setMensagem(null);
    try {
      verificar(await supabase.rpc("salvar_horarios_pl", { p_professor: professor, p_horarios: linhas }));
      await qc.invalidateQueries({ queryKey: ["horarios-pl"] });
      setMensagem({ tipo: "sucesso", texto: "Horários de PL salvos." });
    } catch (e) {
      setMensagem({ tipo: "erro", texto: mensagemDeErro(e) });
    } finally {
      setSalvando(false);
    }
  }

  // Ao trocar de professor, carrega os horários dele para edição.
  function escolher(id: string) {
    setProfessor(id);
    setMensagem(null);
    setLinhas(
      pl.data!
        .filter((h) => h.usuario_id === id)
        .map((h) => ({ dia_semana: h.dia_semana, hora_inicio: hora(h.hora_inicio), hora_fim: hora(h.hora_fim) })),
    );
  }

  const mudar = (i: number, campo: keyof Linha, valor: string) =>
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: campo === "dia_semana" ? Number(valor) : valor } : l)));

  return (
    <div>
      <p style={{ fontSize: 13.5, color: C.inkSoft, margin: "0 0 14px", maxWidth: 640, lineHeight: 1.6 }}>
        Horários reservados para o planejamento (PL) de cada professor. Quando o planejamento é entregue fora desses
        horários, a entrega recebe a etiqueta <EtiquetaForaDoPL /> — independente de estar no prazo ou não.
      </p>

      <div className="tv-card" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }} htmlFor="sel-prof-pl">Professor</label>
        <select id="sel-prof-pl" className="tv-input" style={{ width: "auto", minWidth: 220 }} value={professor} onChange={(e) => escolher(e.target.value)}>
          <option value="">Escolha um professor</option>
          {professores.map((p) => {
            const dele = pl.data!.filter((h) => h.usuario_id === p.id);
            return (
              <option key={p.id} value={p.id}>
                {p.nome}
                {dele.length ? ` — ${resumoPL(dele)}` : " — sem PL cadastrado"}
              </option>
            );
          })}
        </select>
      </div>

      {professor && (
        <div className="tv-card" style={{ padding: 16 }}>
          {linhas.length === 0 && <p style={{ fontSize: 13, color: C.inkSoft, margin: "0 0 10px" }}>Nenhum horário de PL cadastrado.</p>}
          {linhas.map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
              <select className="tv-input" style={{ width: "auto" }} value={l.dia_semana} onChange={(e) => mudar(i, "dia_semana", e.target.value)} aria-label="Dia">
                {DIAS_SEMANA.map((d, k) => <option key={d} value={k + 1}>{d}</option>)}
              </select>
              <input type="time" className="tv-input" style={{ width: "auto" }} value={l.hora_inicio} onChange={(e) => mudar(i, "hora_inicio", e.target.value)} aria-label="Início" />
              <span style={{ fontSize: 13, color: C.inkSoft }}>às</span>
              <input type="time" className="tv-input" style={{ width: "auto" }} value={l.hora_fim} onChange={(e) => mudar(i, "hora_fim", e.target.value)} aria-label="Fim" />
              <button className="tv-btn-text-danger" style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 12.5 }} onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}>
                <Trash2 size={12} /> Remover
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap", marginTop: 6 }}>
            <button
              className="tv-btn tv-btn-secondary"
              onClick={() => setLinhas((ls) => [...ls, { dia_semana: 1, hora_inicio: "13:00", hora_fim: "14:00" }])}
            >
              <Plus size={14} /> Adicionar horário
            </button>
            <button className="tv-btn tv-btn-primary" disabled={salvando} onClick={() => void salvar()}>
              {salvando ? "Salvando…" : "Salvar horários de PL"}
            </button>
          </div>
          {mensagem && <div style={{ marginTop: 12 }}><Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso></div>}
        </div>
      )}
    </div>
  );
}

/** Professor: os próprios horários de PL (em "Meus horários"). */
export function MeuPL() {
  const eu = useUsuario();
  const pl = useHorariosPL();
  const meus = (pl.data ?? []).filter((h) => h.usuario_id === eu.id);
  if (!pl.data) return null;
  return (
    <div className="tv-card" style={{ padding: "12px 14px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
      <Coffee size={16} color={C.primaryDeep} />
      <strong>Seus horários de PL:</strong>
      <span style={{ color: C.inkSoft }}>{meus.length ? resumoPL(meus) : "ainda não cadastrados pela coordenação."}</span>
    </div>
  );
}
